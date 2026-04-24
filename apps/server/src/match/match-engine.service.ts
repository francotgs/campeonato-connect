import {
  type AttrKey,
  type BotMatchContext,
  type Card,
  type CardId,
  type MatchEndReason,
  type MatchStats,
  SERVER_EVENTS,
  addToBottom,
  canTransition,
  drawCard,
  lowestAttribute,
  resolveRound,
  winnerByCount,
} from "@campeonato/domain";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { BotService } from "../bot/bot.service";
import { ClockService } from "../common/clock.service";
import { GameError } from "../common/game-error";
import { IdService } from "../common/id.service";
import { ConfigService } from "../config/config.service";
import { MSG_DEDUP_TTL_SECONDS, RedisKeys } from "../redis/redis-keys";
import { RedisService } from "../redis/redis.service";
import { PlayerService } from "../tournament/player.service";
import { CatalogService } from "./catalog.service";
import { buildMatchDecks } from "./deck-builder";
import { MATCH_EMITTER, type MatchEmitter } from "./match-emitter";
import { MatchEventService } from "./match-event.service";
import {
  type PersistedMatchPlayer,
  type PersistedMatchState,
  type PlayerSlot,
  deckSize,
  otherSlot,
  topCardId,
} from "./match-state";

const MATCH_TTL_SECONDS = 4 * 60 * 60;
const SHOW_RESULT_DELAY_MS = 2_500;
const MATCH_STARTING_DELAY_MS = 3_000;
const BOT_PICK_DELAY_MS = 1_400;

type ResolvedWinner = "p0" | "p1" | "draw";

type NextPhase =
  | { kind: "continue" }
  | { kind: "player_out"; loserSlot: PlayerSlot }
  | { kind: "tiebreaker_complete"; winnerSlot: PlayerSlot };

type ApplyPickResult = {
  state: PersistedMatchState;
  chosenBy: PlayerSlot;
  attribute: AttrKey;
  roundNumber: number;
  p0CardId: CardId;
  p1CardId: CardId;
  valueP0: number;
  valueP1: number;
  winner: ResolvedWinner;
  p0DeckSize: number;
  p1DeckSize: number;
  nextPhase: NextPhase;
};

@Injectable()
export class MatchEngineService {
  private readonly logger = new Logger(MatchEngineService.name);
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject(MATCH_EMITTER) private readonly emitter: MatchEmitter,
    private readonly redis: RedisService,
    private readonly clock: ClockService,
    private readonly ids: IdService,
    private readonly catalog: CatalogService,
    private readonly players: PlayerService,
    private readonly bots: BotService,
    private readonly config: ConfigService,
    private readonly matchEvents: MatchEventService,
  ) {}

  // ==========================================================================
  // Creación y control
  // ==========================================================================

  async createMatch(input: {
    tournamentId: string;
    player0Id: string;
    player1Id: string;
    round: number;
    bracketSlot: number;
    mode?: "tournament" | "practice";
  }): Promise<string> {
    const p0Base = await this.players.mustGet(input.player0Id);
    const p1Base = await this.players.mustGet(input.player1Id);

    const cardsPerPlayer = this.config.get("CARDS_PER_PLAYER");
    const { deckP0, deckP1, relaxed } = buildMatchDecks({
      catalog: [...this.catalog.all()],
      cardsPerPlayer,
      player0IsBot: p0Base.isBot,
      player1IsBot: p1Base.isBot,
    });
    if (relaxed) {
      this.logger.warn(
        `deck builder used relaxed avg for ${input.player0Id} vs ${input.player1Id}`,
      );
    }

    const mid = this.ids.matchId();
    const startingChooser: PlayerSlot = Math.random() < 0.5 ? 0 : 1;

    const state: PersistedMatchState = {
      id: mid,
      mode: input.mode ?? "tournament",
      tournamentId: input.tournamentId,
      round: input.round,
      bracketSlot: input.bracketSlot,
      players: [
        this.toMatchPlayer(
          p0Base,
          deckP0.map((c) => c.id),
        ),
        this.toMatchPlayer(
          p1Base,
          deckP1.map((c) => c.id),
        ),
      ],
      fsm: "WAITING_START",
      currentChooser: startingChooser,
      firstChooser: startingChooser,
      currentAttribute: null,
      roundNumber: 0,
      startedAt: 0,
      endsAt: 0,
      deadlineAt: null,
      log: [],
      tiebreaker: { active: false, roundsPlayed: 0, winsP0: 0, winsP1: 0, lastWinner: null },
      winnerId: null,
      endReason: null,
      endedAt: null,
    };

    await this.redis.setJson(RedisKeys.match(mid), state, MATCH_TTL_SECONDS);
    await this.players.setCurrentMatch(p0Base.id, mid);
    await this.players.setCurrentMatch(p1Base.id, mid);
    await this.players.updateStatus(p0Base.id, "in_match");
    await this.players.updateStatus(p1Base.id, "in_match");

    await this.emitter.joinMatchRoomForPlayer(p0Base.id, mid);
    await this.emitter.joinMatchRoomForPlayer(p1Base.id, mid);

    const startsAt = this.clock.now() + MATCH_STARTING_DELAY_MS;
    this.emitMatchStarting(state, 0, startsAt);
    this.emitMatchStarting(state, 1, startsAt);

    this.setTimer(mid, "start", MATCH_STARTING_DELAY_MS, () => {
      void this.startMatch(mid).catch((err) =>
        this.logger.error(`startMatch failed for ${mid}: ${(err as Error).message}`),
      );
    });
    return mid;
  }

  private async startMatch(mid: string): Promise<void> {
    const durationSec = this.config.get("MATCH_DURATION_SECONDS");
    const pickTimeoutSec = this.config.get("TURN_PICK_TIMEOUT_SECONDS");

    const res = await this.redis.mutateJson<PersistedMatchState>(
      RedisKeys.match(mid),
      (cur) => {
        if (!cur || cur.fsm !== "WAITING_START") return null;
        if (!canTransition(cur.fsm, "match_started")) return null;
        const now = this.clock.now();
        const next: PersistedMatchState = {
          ...cur,
          fsm: "PICKING",
          startedAt: now,
          endsAt: now + durationSec * 1_000,
          roundNumber: 1,
          deadlineAt: now + pickTimeoutSec * 1_000,
        };
        return { next, result: next };
      },
      { ttlSeconds: MATCH_TTL_SECONDS },
    );
    if (!res.ok) return;
    const state = res.value;

    this.emitter.broadcastToMatch(mid, SERVER_EVENTS.MATCH_STARTED, {
      matchId: mid,
      startedAt: state.startedAt,
      endsAt: state.endsAt,
    });
    this.emitRoundStarted(state);
    this.scheduleRoundTimers(state);
    this.maybeAutoBotPick(state);
  }

  private async finalizeMatchByTime(mid: string): Promise<void> {
    const res = await this.redis.mutateJson<PersistedMatchState>(
      RedisKeys.match(mid),
      (cur) => {
        if (!cur) return null;
        if (cur.fsm === "ENDED") return null;
        if (cur.tiebreaker.active) return null; // el timer global no aplica en desempate
        if (!canTransition(cur.fsm, "time_up")) return null;
        const next: PersistedMatchState = {
          ...cur,
          fsm: "CHECK_WINNER",
          deadlineAt: null,
        };
        return { next, result: next };
      },
      { ttlSeconds: MATCH_TTL_SECONDS },
    );
    if (!res.ok) return;
    await this.resolveCheckWinner(res.value);
  }

  private async resolveCheckWinner(state: PersistedMatchState): Promise<void> {
    const d0 = state.players[0].deck.length;
    const d1 = state.players[1].deck.length;
    const countWinner = winnerByCount([d0, d1]);
    if (countWinner !== "tie") {
      await this.endMatch(state.id, countWinner === "p0" ? 0 : 1, "time_up");
      return;
    }
    const pickTimeoutSec = this.config.get("TURN_PICK_TIMEOUT_SECONDS");
    const res = await this.redis.mutateJson<PersistedMatchState>(
      RedisKeys.match(state.id),
      (cur) => {
        if (!cur || cur.fsm !== "CHECK_WINNER") return null;
        if (!canTransition(cur.fsm, "check_winner_tie")) return null;
        const next: PersistedMatchState = {
          ...cur,
          fsm: "TIEBREAKER",
          deadlineAt: this.clock.now() + pickTimeoutSec * 1_000,
          tiebreaker: { active: true, roundsPlayed: 0, winsP0: 0, winsP1: 0, lastWinner: null },
          roundNumber: cur.roundNumber + 1,
        };
        return { next, result: next };
      },
      { ttlSeconds: MATCH_TTL_SECONDS },
    );
    if (!res.ok) return;
    const nextState = res.value;
    this.emitter.broadcastToMatch(state.id, SERVER_EVENTS.MATCH_TIEBREAKER_STARTED, {
      matchId: state.id,
      roundsToPlay: 3,
    });
    this.emitRoundStarted(nextState);
    this.scheduleRoundTimers(nextState);
    this.maybeAutoBotPick(nextState);
  }

  // ==========================================================================
  // Handlers de eventos del cliente
  // ==========================================================================

  async handlePick(args: {
    matchId: string;
    playerId: string;
    msgId: string;
    attribute: AttrKey;
    roundNumber: number;
  }): Promise<void> {
    const dedup = await this.redis.claimMsgId(
      RedisKeys.matchProcessedMsgs(args.matchId),
      args.msgId,
      MSG_DEDUP_TTL_SECONDS,
    );
    if (!dedup) throw new GameError("STALE_MSG", "msgId already processed", args.msgId);
    await this.applyPick({
      matchId: args.matchId,
      attribute: args.attribute,
      roundNumber: args.roundNumber,
      originPlayerId: args.playerId,
    });
  }

  async handleSync(args: {
    matchId: string;
    playerId: string;
    msgId: string;
  }): Promise<{
    matchId: string;
    roundNumber: number;
    fsm: string;
    yourDeckSize: number;
    opponentDeckSize: number;
    yourCurrentCard: Card | null;
    chooser: PlayerSlot;
    deadlineAt: number | null;
    endsAt: number;
  }> {
    const state = await this.redis.getJson<PersistedMatchState>(RedisKeys.match(args.matchId));
    if (!state) throw new GameError("MATCH_NOT_ACTIVE", "match not found");
    const slot = this.slotForPlayer(state, args.playerId);
    const me = state.players[slot];
    const other = state.players[otherSlot(slot)];
    return {
      matchId: state.id,
      roundNumber: state.roundNumber,
      fsm: state.fsm,
      yourDeckSize: deckSize(me),
      opponentDeckSize: deckSize(other),
      yourCurrentCard: me.deck.length > 0 ? this.catalog.mustGet(topCardId(me)) : null,
      chooser: state.currentChooser,
      deadlineAt: state.deadlineAt,
      endsAt: state.endsAt,
    };
  }

  async handleLeave(args: {
    matchId: string;
    playerId: string;
    msgId: string;
  }): Promise<void> {
    const dedup = await this.redis.claimMsgId(
      RedisKeys.matchProcessedMsgs(args.matchId),
      args.msgId,
      MSG_DEDUP_TTL_SECONDS,
    );
    if (!dedup) return;
    const state = await this.redis.getJson<PersistedMatchState>(RedisKeys.match(args.matchId));
    if (!state) return;
    const leaver = this.slotForPlayer(state, args.playerId);
    await this.endMatch(args.matchId, otherSlot(leaver), "abandoned");
  }

  // ==========================================================================
  // Mutación atómica de un pick (PICKING → RESOLVING → SHOWING_RESULT)
  // ==========================================================================

  private async applyPick(args: {
    matchId: string;
    attribute: AttrKey;
    roundNumber: number;
    originPlayerId: string | null;
  }): Promise<void> {
    const res = await this.redis.mutateJson<PersistedMatchState, ApplyPickResult>(
      RedisKeys.match(args.matchId),
      (cur) => {
        if (!cur) return null;
        if (cur.fsm !== "PICKING" && cur.fsm !== "TIEBREAKER") return null;
        if (cur.roundNumber !== args.roundNumber) return null;

        const chooserSlot = cur.currentChooser;
        const oppSlot = otherSlot(chooserSlot);
        if (args.originPlayerId !== null) {
          const expected = cur.players[chooserSlot].id;
          if (expected !== args.originPlayerId) {
            throw new GameError("NOT_YOUR_TURN", "player is not the current chooser");
          }
        }

        const chooser = cur.players[chooserSlot];
        const opp = cur.players[oppSlot];
        const chooserCard = this.catalog.mustGet(topCardId(chooser));
        const opponentCard = this.catalog.mustGet(topCardId(opp));
        const outcome = resolveRound(chooserCard, opponentCard, args.attribute);

        const chooserDraw = drawCard(chooser.deck);
        const oppDraw = drawCard(opp.deck);
        if (!chooserDraw || !oppDraw) return null;

        let newChooserDeck: CardId[];
        let newOppDeck: CardId[];

        if (outcome.winner === "chooser") {
          newChooserDeck = addToBottom(chooserDraw.rest, [chooserDraw.top, oppDraw.top]);
          newOppDeck = [...oppDraw.rest];
        } else if (outcome.winner === "opponent") {
          newChooserDeck = [...chooserDraw.rest];
          newOppDeck = addToBottom(oppDraw.rest, [oppDraw.top, chooserDraw.top]);
        } else {
          // Empate (§4.2.4): cada jugador conserva su carta, al fondo del propio mazo.
          newChooserDeck = addToBottom(chooserDraw.rest, [chooserDraw.top]);
          newOppDeck = addToBottom(oppDraw.rest, [oppDraw.top]);
        }

        const nextPlayers: [PersistedMatchPlayer, PersistedMatchPlayer] =
          chooserSlot === 0
            ? [
                { ...chooser, deck: newChooserDeck },
                { ...opp, deck: newOppDeck },
              ]
            : [
                { ...opp, deck: newOppDeck },
                { ...chooser, deck: newChooserDeck },
              ];

        const winnerP: ResolvedWinner =
          outcome.winner === "tie"
            ? "draw"
            : outcome.winner === "chooser"
              ? chooserSlot === 0
                ? "p0"
                : "p1"
              : chooserSlot === 0
                ? "p1"
                : "p0";

        const p0Card = chooserSlot === 0 ? chooserCard : opponentCard;
        const p1Card = chooserSlot === 0 ? opponentCard : chooserCard;
        const valueP0 = p0Card.attributes[args.attribute];
        const valueP1 = p1Card.attributes[args.attribute];

        const logEntry = {
          roundNumber: cur.roundNumber,
          chooser: chooserSlot,
          attribute: args.attribute,
          p0Value: valueP0,
          p1Value: valueP1,
          winner: winnerP,
          p0DeckSizeAfter: nextPlayers[0].deck.length,
          p1DeckSizeAfter: nextPlayers[1].deck.length,
          p0CardId: p0Card.id,
          p1CardId: p1Card.id,
        };

        const nextChooser: PlayerSlot =
          outcome.winner === "chooser"
            ? chooserSlot
            : outcome.winner === "opponent"
              ? oppSlot
              : oppSlot;

        const tiebreakerActive = cur.tiebreaker.active;
        const tb = { ...cur.tiebreaker };
        if (tiebreakerActive) {
          tb.roundsPlayed += 1;
          if (winnerP === "p0") {
            tb.winsP0 += 1;
            tb.lastWinner = 0;
          } else if (winnerP === "p1") {
            tb.winsP1 += 1;
            tb.lastWinner = 1;
          }
        }

        const next: PersistedMatchState = {
          ...cur,
          fsm: "SHOWING_RESULT",
          currentAttribute: args.attribute,
          currentChooser: nextChooser,
          deadlineAt: null,
          log: [...cur.log, logEntry],
          players: nextPlayers,
          tiebreaker: tb,
        };

        let nextPhase: NextPhase;
        if (tiebreakerActive) {
          if (tb.roundsPlayed >= 3) {
            let winnerSlot: PlayerSlot;
            if (tb.winsP0 > tb.winsP1) winnerSlot = 0;
            else if (tb.winsP1 > tb.winsP0) winnerSlot = 1;
            else if (tb.lastWinner !== null) winnerSlot = tb.lastWinner;
            else winnerSlot = cur.firstChooser;
            nextPhase = { kind: "tiebreaker_complete", winnerSlot };
          } else {
            nextPhase = { kind: "continue" };
          }
        } else if (nextPlayers[0].deck.length === 0) {
          nextPhase = { kind: "player_out", loserSlot: 0 };
        } else if (nextPlayers[1].deck.length === 0) {
          nextPhase = { kind: "player_out", loserSlot: 1 };
        } else {
          nextPhase = { kind: "continue" };
        }

        const applyResult: ApplyPickResult = {
          state: next,
          chosenBy: chooserSlot,
          attribute: args.attribute,
          roundNumber: cur.roundNumber,
          p0CardId: p0Card.id,
          p1CardId: p1Card.id,
          valueP0,
          valueP1,
          winner: winnerP,
          p0DeckSize: nextPlayers[0].deck.length,
          p1DeckSize: nextPlayers[1].deck.length,
          nextPhase,
        };
        return { next, result: applyResult };
      },
      { ttlSeconds: MATCH_TTL_SECONDS },
    );
    if (!res.ok) {
      this.logger.debug(`applyPick conflict on ${args.matchId}`);
      return;
    }

    const apply = res.value;
    this.clearTimer(args.matchId, "pick");
    this.clearTimer(args.matchId, "bot");

    this.emitter.broadcastToMatch(args.matchId, SERVER_EVENTS.ROUND_ATTRIBUTE_CHOSEN, {
      roundNumber: apply.roundNumber,
      attribute: apply.attribute,
      chosenBy: apply.chosenBy,
    });

    const p0Card = this.catalog.mustGet(apply.p0CardId);
    const p1Card = this.catalog.mustGet(apply.p1CardId);
    for (const slot of [0, 1] as const) {
      const player = apply.state.players[slot];
      const yourValue = slot === 0 ? apply.valueP0 : apply.valueP1;
      const opponentValue = slot === 0 ? apply.valueP1 : apply.valueP0;
      const mine: ResolvedWinner = slot === 0 ? "p0" : "p1";
      const winner: "you" | "opponent" | "tie" =
        apply.winner === "draw" ? "tie" : apply.winner === mine ? "you" : "opponent";
      const revealedOpponentCard = slot === 0 ? p1Card : p0Card;
      this.emitter.emitToPlayer(player.id, SERVER_EVENTS.ROUND_RESULT, {
        roundNumber: apply.roundNumber,
        attribute: apply.attribute,
        yourValue,
        opponentValue,
        winner,
        yourDeckSize: slot === 0 ? apply.p0DeckSize : apply.p1DeckSize,
        opponentDeckSize: slot === 0 ? apply.p1DeckSize : apply.p0DeckSize,
        revealedOpponentCard,
      });
    }

    this.setTimer(args.matchId, "show", SHOW_RESULT_DELAY_MS, () => {
      void this.afterShow(args.matchId, apply.nextPhase).catch((err) =>
        this.logger.error(`afterShow failed: ${(err as Error).message}`),
      );
    });
  }

  private async afterShow(mid: string, nextPhase: NextPhase): Promise<void> {
    if (nextPhase.kind === "player_out") {
      await this.endMatch(mid, otherSlot(nextPhase.loserSlot), "elimination");
      return;
    }
    if (nextPhase.kind === "tiebreaker_complete") {
      await this.endMatch(mid, nextPhase.winnerSlot, "tiebreaker");
      return;
    }
    const pickTimeoutSec = this.config.get("TURN_PICK_TIMEOUT_SECONDS");
    const res = await this.redis.mutateJson<PersistedMatchState>(
      RedisKeys.match(mid),
      (cur) => {
        if (!cur) return null;
        if (cur.fsm !== "SHOWING_RESULT") return null;

        const now = this.clock.now();
        if (!cur.tiebreaker.active && now >= cur.endsAt) {
          if (!canTransition(cur.fsm, "time_up")) return null;
          const next: PersistedMatchState = { ...cur, fsm: "CHECK_WINNER", deadlineAt: null };
          return { next, result: next };
        }

        if (!canTransition(cur.fsm, "show_done")) return null;
        const next: PersistedMatchState = {
          ...cur,
          fsm: "PICKING",
          roundNumber: cur.roundNumber + 1,
          deadlineAt: now + pickTimeoutSec * 1_000,
          currentAttribute: null,
        };
        return { next, result: next };
      },
      { ttlSeconds: MATCH_TTL_SECONDS },
    );
    if (!res.ok) return;
    const state = res.value;
    if (state.fsm === "CHECK_WINNER") {
      await this.resolveCheckWinner(state);
      return;
    }
    this.emitRoundStarted(state);
    this.scheduleRoundTimers(state);
    this.maybeAutoBotPick(state);
  }

  private async handlePickTimeout(mid: string, roundNumber: number): Promise<void> {
    const state = await this.redis.getJson<PersistedMatchState>(RedisKeys.match(mid));
    if (!state) return;
    if (state.fsm !== "PICKING" && state.fsm !== "TIEBREAKER") return;
    if (state.roundNumber !== roundNumber) return;

    const chooserCard = this.catalog.mustGet(topCardId(state.players[state.currentChooser]));
    const attribute = lowestAttribute(chooserCard);
    await this.applyPick({ matchId: mid, attribute, roundNumber, originPlayerId: null });
  }

  // ==========================================================================
  // Fin de partida
  // ==========================================================================

  private async endMatch(
    mid: string,
    winnerSlot: PlayerSlot,
    reason: MatchEndReason,
  ): Promise<void> {
    const res = await this.redis.mutateJson<PersistedMatchState>(
      RedisKeys.match(mid),
      (cur) => {
        if (!cur || cur.fsm === "ENDED") return null;
        const winnerId = cur.players[winnerSlot].id;
        const next: PersistedMatchState = {
          ...cur,
          fsm: "ENDED",
          deadlineAt: null,
          winnerId,
          endReason: reason,
          endedAt: this.clock.now(),
        };
        return { next, result: next };
      },
      { ttlSeconds: MATCH_TTL_SECONDS },
    );
    if (!res.ok) return;
    const state = res.value;
    this.clearAllTimers(mid);

    const stats: MatchStats = {
      roundsPlayed: state.log.length,
      roundsWonByP0: state.log.filter((e) => e.winner === "p0").length,
      roundsWonByP1: state.log.filter((e) => e.winner === "p1").length,
      ties: state.log.filter((e) => e.winner === "draw").length,
      finalDeckSizes: [state.players[0].deck.length, state.players[1].deck.length],
    };

    this.emitter.broadcastToMatch(mid, SERVER_EVENTS.MATCH_ENDED, {
      matchId: mid,
      winnerId: state.winnerId,
      reason,
      stats,
    });

    for (const slot of [0, 1] as const) {
      const pid = state.players[slot].id;
      await this.players.setCurrentMatch(pid, null);
      if (state.mode === "practice") {
        await this.players.updateStatus(pid, "registered");
        continue;
      }
      const isWinner = slot === winnerSlot;
      await this.players.updateStatus(pid, isWinner ? "waiting_next_match" : "eliminated");
      if (!isWinner) {
        this.emitter.emitToPlayer(pid, SERVER_EVENTS.PLAYER_ELIMINATED, {
          finalPosition: state.round + 1,
          eliminatedBy: state.players[winnerSlot].id,
        });
      } else {
        this.emitter.emitToPlayer(pid, SERVER_EVENTS.PLAYER_WAITING_NEXT, {});
      }
    }

    if (state.mode === "practice") return;

    // Notificar al BracketService via event bus (sin circular dep)
    this.matchEvents.emitMatchEnded({
      matchId: mid,
      tournamentId: state.tournamentId,
      winnerId: state.winnerId ?? state.players[winnerSlot].id,
      round: state.round,
      bracketSlot: state.bracketSlot,
    });
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private toMatchPlayer(
    p: { id: string; name: string; company: string; isBot: boolean },
    deck: CardId[],
  ): PersistedMatchPlayer {
    return { id: p.id, name: p.name, company: p.company, isBot: p.isBot, deck };
  }

  private slotForPlayer(state: PersistedMatchState, playerId: string): PlayerSlot {
    if (state.players[0].id === playerId) return 0;
    if (state.players[1].id === playerId) return 1;
    throw new GameError("UNAUTHORIZED", "player not in this match");
  }

  private emitMatchStarting(state: PersistedMatchState, slot: PlayerSlot, startsAt: number): void {
    const me = state.players[slot];
    const other = state.players[otherSlot(slot)];
    const myCards = me.deck.map((id) => this.catalog.mustGet(id));
    this.emitter.emitToPlayer(me.id, SERVER_EVENTS.MATCH_STARTING, {
      matchId: state.id,
      opponent: { id: other.id, name: other.name, company: other.company },
      myCards,
      startingChooser: state.currentChooser,
      mySlot: slot,
      startsAt,
    });
  }

  private emitRoundStarted(state: PersistedMatchState): void {
    for (const slot of [0, 1] as const) {
      const me = state.players[slot];
      const other = state.players[otherSlot(slot)];
      if (me.deck.length === 0 || other.deck.length === 0) continue;
      const topCard = this.catalog.mustGet(topCardId(me));
      const opponentTop = this.catalog.mustGet(topCardId(other));
      this.emitter.emitToPlayer(me.id, SERVER_EVENTS.ROUND_STARTED, {
        roundNumber: state.roundNumber,
        chooser: state.currentChooser,
        myCurrentCard: topCard,
        opponentCardBack: { gradient: opponentTop.art.gradient },
        deadlineAt: state.deadlineAt ?? this.clock.now(),
      });
    }
  }

  private scheduleRoundTimers(state: PersistedMatchState): void {
    const now = this.clock.now();
    const pickDelay = Math.max(0, (state.deadlineAt ?? now) - now);
    this.setTimer(state.id, "pick", pickDelay, () => {
      void this.handlePickTimeout(state.id, state.roundNumber).catch((err) =>
        this.logger.error(`pickTimeout failed: ${(err as Error).message}`),
      );
    });
    if (!state.tiebreaker.active && state.endsAt > now) {
      const remaining = state.endsAt - now;
      this.setTimer(state.id, "matchEnd", remaining, () => {
        void this.finalizeMatchByTime(state.id).catch((err) =>
          this.logger.error(`finalizeMatchByTime failed: ${(err as Error).message}`),
        );
      });
    }
  }

  private maybeAutoBotPick(state: PersistedMatchState): void {
    const chooser = state.players[state.currentChooser];
    if (!chooser.isBot) return;
    const humanSlot = otherSlot(state.currentChooser);
    const ctx: BotMatchContext = {
      tournamentRound: state.round,
      bracketSize: 16,
      deckDiffAgainstHuman: chooser.deck.length - state.players[humanSlot].deck.length,
    };
    const botCard = this.catalog.mustGet(topCardId(chooser));
    const attribute = this.bots.pickAttribute(botCard, ctx);
    this.setTimer(state.id, "bot", BOT_PICK_DELAY_MS, () => {
      void this.applyPick({
        matchId: state.id,
        attribute,
        roundNumber: state.roundNumber,
        originPlayerId: chooser.id,
      }).catch((err) => this.logger.error(`bot pick failed: ${(err as Error).message}`));
    });
  }

  private setTimer(mid: string, kind: string, ms: number, fn: () => void): void {
    this.clearTimer(mid, kind);
    const key = `${mid}:${kind}`;
    const handle = setTimeout(() => {
      this.timers.delete(key);
      fn();
    }, ms);
    this.timers.set(key, handle);
  }

  private clearTimer(mid: string, kind: string): void {
    const key = `${mid}:${kind}`;
    const existing = this.timers.get(key);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(key);
    }
  }

  private clearAllTimers(mid: string): void {
    for (const [key, handle] of this.timers) {
      if (key.startsWith(`${mid}:`)) {
        clearTimeout(handle);
        this.timers.delete(key);
      }
    }
  }
}
