import { type Bracket, SERVER_EVENTS, advanceBracket, generateBracket } from "@campeonato/domain";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { BotService } from "../bot/bot.service";
import { ClockService } from "../common/clock.service";
import { GameError } from "../common/game-error";
import { IdService } from "../common/id.service";
import { IoRuntimeService } from "../common/io-runtime.service";
import { MatchEngineService } from "../match/match-engine.service";
import type { MatchEndedEvent } from "../match/match-event.service";
import { MatchEventService } from "../match/match-event.service";
import { RedisKeys } from "../redis/redis-keys";
import { RedisService } from "../redis/redis.service";
import { PlayerService } from "../tournament/player.service";
import { TournamentService } from "../tournament/tournament.service";

const BRACKET_TTL_SECONDS = 4 * 60 * 60;

/**
 * Gestiona el ciclo de vida del bracket: generación, avance de rondas,
 * declaración de campeón y reset/pausa del torneo.
 */
@Injectable()
export class BracketService implements OnModuleInit {
  private readonly logger = new Logger(BracketService.name);

  constructor(
    private readonly matchEvents: MatchEventService,
    private readonly engine: MatchEngineService,
    private readonly tournaments: TournamentService,
    private readonly players: PlayerService,
    private readonly bots: BotService,
    private readonly redis: RedisService,
    private readonly clock: ClockService,
    private readonly ids: IdService,
    private readonly ioRuntime: IoRuntimeService,
  ) {}

  onModuleInit(): void {
    this.matchEvents.onMatchEnded((event) => this.handleMatchEnded(event));
  }

  // ==========================================================================
  // Acciones admin
  // ==========================================================================

  /**
   * Cierra el registro, genera el bracket (rellenando con bots hasta la
   * siguiente potencia de 2), lanza las partidas de la ronda 0 y emite
   * `bracket:updated`.
   *
   * Reglas:
   *  - Se requiere al menos 1 humano inscripto.
   *  - El tamaño del bracket es `nextPowerOfTwo(humanos)`. Ej: 1→2, 3→4, 6→8.
   *  - Los slots faltantes se completan automáticamente con bots, para que
   *    todas las partidas puedan jugarse. Un humano solo juega vs bot.
   */
  async startTournament(tid: string): Promise<Bracket> {
    const tournament = await this.tournaments.mustGet(tid);
    if (tournament.status !== "registration_open") {
      throw new GameError("TOURNAMENT_STARTED", "tournament is already started or finished");
    }

    const humanIds = await this.redis.client.smembers(RedisKeys.tournamentHumans(tid));
    if (humanIds.length === 0) {
      throw new GameError("INVALID_PAYLOAD", "no humans registered, cannot start");
    }

    // Limpiar bots huérfanos (de intentos previos o resets parciales) para que
    // el bracket se arme desde cero solo con los bots estrictamente necesarios.
    await this.cleanupBots(tid);

    // Generar bracket. `generateBracket` completa con bots hasta la siguiente
    // potencia de 2, garantizando que ningún par de la ronda 0 sean 2 bots
    // (siempre que haya al menos size/2 humanos, cosa que cumple la formula).
    let botIndex = 0;
    const createdBotIds: string[] = [];
    const { bracket, bots: botIds } = generateBracket({
      humans: humanIds,
      createBotId: () => {
        const label = `Bot ${String(++botIndex).padStart(2, "0")}`;
        return label; // ID provisional; se reemplaza abajo
      },
    });

    // Registrar bots reales en Redis y reasignar sus IDs en el bracket
    if (botIds.length > 0) {
      const registeredBots = await this.bots.ensureBracketBots(tid, botIds.length);
      for (let i = 0; i < botIds.length; i++) {
        const provisionalId = botIds[i];
        const realBot = registeredBots[i];
        if (!provisionalId || !realBot) continue;
        this.replaceBotId(bracket, provisionalId, realBot.id);
        createdBotIds.push(realBot.id);
      }
    }

    // Guardar bracket
    await this.redis.setJson(RedisKeys.tournamentBracket(tid), bracket, BRACKET_TTL_SECONDS);
    await this.redis.client.set(
      RedisKeys.tournamentCurrentRound(tid),
      "0",
      "EX",
      BRACKET_TTL_SECONDS,
    );

    // Cambiar estado del torneo
    await this.tournaments.updateStatus(tid, "running");

    // Marcar los partidos de ronda 0 como live y crear las partidas
    await this.launchRoundMatches(tid, bracket, 0);

    this.logger.log(
      `tournament ${tid} started: ${humanIds.length} humans + ${createdBotIds.length} bots, size=${bracket.size}`,
    );
    return bracket;
  }

  async openRegistration(tid: string): Promise<void> {
    const tournament = await this.tournaments.mustGet(tid);
    if (tournament.status === "finished") {
      throw new GameError("TOURNAMENT_STARTED", "tournament already finished");
    }
    await this.tournaments.updateStatus(tid, "registration_open");
  }

  async pauseTournament(tid: string): Promise<void> {
    await this.tournaments.mustGet(tid);
    await this.tournaments.updateStatus(tid, "paused");
  }

  async resumeTournament(tid: string): Promise<void> {
    await this.tournaments.mustGet(tid);
    await this.tournaments.updateStatus(tid, "running");
  }

  /**
   * Borra todo el estado del torneo y lo recrea en `registration_open`.
   * Útil solo para testing pre-evento.
   */
  async resetTournament(tid: string): Promise<void> {
    const tournament = await this.tournaments.mustGet(tid);

    // Eliminar todos los jugadores
    const allPlayerIds = await this.redis.client.smembers(RedisKeys.tournamentPlayers(tid));
    for (const pid of allPlayerIds) {
      await this.redis.client.del(RedisKeys.player(pid));
    }

    // Limpiar sets de jugadores
    await this.redis.client.del(
      RedisKeys.tournamentPlayers(tid),
      RedisKeys.tournamentHumans(tid),
      RedisKeys.tournamentBots(tid),
      RedisKeys.tournamentNames(tid),
      RedisKeys.tournamentBracket(tid),
      RedisKeys.tournamentCurrentRound(tid),
    );

    // Resetear tournament
    await this.redis.setJson(
      RedisKeys.tournament(tid),
      {
        ...tournament,
        status: "registration_open",
        startedAt: null,
        finishedAt: null,
        championId: null,
      },
      BRACKET_TTL_SECONDS,
    );
    this.logger.log(`tournament ${tid} reset`);
  }

  /**
   * Elimina todos los bots previamente registrados en el torneo (si los hay)
   * tanto del set de bots como del set general de jugadores y de Redis.
   * Se ejecuta al iniciar un torneo para evitar bots huérfanos que no
   * participen del bracket.
   */
  private async cleanupBots(tid: string): Promise<void> {
    const botIds = await this.redis.client.smembers(RedisKeys.tournamentBots(tid));
    if (botIds.length === 0) return;
    for (const pid of botIds) {
      await this.redis.client.del(RedisKeys.player(pid));
    }
    await this.redis.client.del(RedisKeys.tournamentBots(tid));
    await this.redis.client.srem(RedisKeys.tournamentPlayers(tid), ...botIds);
    this.logger.log(`cleaned up ${botIds.length} orphan bot(s) for ${tid}`);
  }

  // ==========================================================================
  // Avance de bracket tras fin de partida
  // ==========================================================================

  async handleMatchEnded(event: MatchEndedEvent): Promise<void> {
    const {
      matchId,
      tournamentId: tid,
      winnerId,
      round: roundIndex,
      bracketSlot: matchIndex,
    } = event;

    this.logger.log(
      `match ended: mid=${matchId} winner=${winnerId} round=${roundIndex} slot=${matchIndex}`,
    );

    const bracketRaw = await this.redis.getJson<Bracket>(RedisKeys.tournamentBracket(tid));
    if (!bracketRaw) {
      // Partida fuera del bracket (ej: debug_start_duel sin torneo)
      this.logger.debug(`no bracket for tournament ${tid}, skipping advance`);
      return;
    }

    const tournament = await this.tournaments.get(tid);
    if (!tournament || tournament.status !== "running") return;

    // Avanzar bracket
    const advanced = advanceBracket({
      bracket: bracketRaw,
      roundIndex,
      matchIndex,
      winnerId,
    });

    // Persistir
    await this.redis.setJson(
      RedisKeys.tournamentBracket(tid),
      advanced.bracket,
      BRACKET_TTL_SECONDS,
    );

    // Emitir bracket:updated
    this.broadcastBracketUpdated(tid, advanced.bracket, roundIndex);

    if (advanced.isChampion) {
      await this.handleChampion(tid, winnerId, advanced.bracket);
      return;
    }

    // Bot vs Bot en rondas siguientes — §15.4
    const { nextSlot } = advanced;
    if (!nextSlot) return;
    const nextRound = advanced.bracket.rounds[nextSlot.roundIndex];
    if (!nextRound) return;
    const nextMatch = nextRound.matches[nextSlot.matchIndex];
    if (!nextMatch) return;

    if (nextMatch.slotA && nextMatch.slotB) {
      // Ambos slots llenos: arrancar partida
      await this.tryStartNextMatch(tid, advanced.bracket, nextSlot.roundIndex, nextSlot.matchIndex);
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private async launchRoundMatches(
    tid: string,
    bracket: Bracket,
    roundIndex: number,
  ): Promise<void> {
    const round = bracket.rounds[roundIndex];
    if (!round) return;

    for (let i = 0; i < round.matches.length; i++) {
      const m = round.matches[i];
      if (!m || !m.slotA || !m.slotB) continue;
      await this.tryStartNextMatch(tid, bracket, roundIndex, i);
    }
  }

  private async tryStartNextMatch(
    tid: string,
    bracket: Bracket,
    roundIndex: number,
    matchIndex: number,
  ): Promise<void> {
    const round = bracket.rounds[roundIndex];
    if (!round) return;
    const match = round.matches[matchIndex];
    if (!match || !match.slotA || !match.slotB) return;

    const p0 = await this.players.get(match.slotA);
    const p1 = await this.players.get(match.slotB);
    if (!p0 || !p1) {
      this.logger.warn(`tryStartNextMatch: player not found (${match.slotA} / ${match.slotB})`);
      return;
    }

    // Bot vs Bot — simular instantáneamente (§15.4)
    if (p0.isBot && p1.isBot) {
      this.logger.warn(`bot vs bot at round ${roundIndex} match ${matchIndex} — instant result`);
      const winnerSlot = Math.random() < 0.5 ? 0 : 1;
      const instantWinnerId = winnerSlot === 0 ? p0.id : p1.id;
      await this.handleMatchEnded({
        matchId: `bot-vs-bot-${this.ids.matchId()}`,
        tournamentId: tid,
        winnerId: instantWinnerId,
        round: roundIndex,
        bracketSlot: matchIndex,
      });
      return;
    }

    const mid = await this.engine.createMatch({
      tournamentId: tid,
      player0Id: p0.id,
      player1Id: p1.id,
      round: roundIndex,
      bracketSlot: matchIndex,
    });

    // Actualizar bracket con matchId y status live
    const latestBracket = await this.redis.getJson<Bracket>(RedisKeys.tournamentBracket(tid));
    if (!latestBracket) return;
    const latestRound = latestBracket.rounds[roundIndex];
    const latestMatch = latestRound?.matches[matchIndex];
    if (latestMatch) {
      latestMatch.matchId = mid;
      latestMatch.status = "live";
      await this.redis.setJson(
        RedisKeys.tournamentBracket(tid),
        latestBracket,
        BRACKET_TTL_SECONDS,
      );
      this.broadcastBracketUpdated(tid, latestBracket, roundIndex);
    }
  }

  private async handleChampion(tid: string, championId: string, bracket: Bracket): Promise<void> {
    await this.tournaments.updateStatus(tid, "finished");
    await this.tournaments.setChampion(tid, championId);
    await this.players.updateStatus(championId, "champion");

    // Determinar podio: el campeón ganó la final; el runner-up fue su rival
    const finalRound = bracket.rounds[bracket.rounds.length - 1];
    const finalMatch = finalRound?.matches[0];
    const runnerUpId =
      finalMatch?.slotA === championId
        ? (finalMatch?.slotB ?? championId)
        : (finalMatch?.slotA ?? championId);

    // Semifinalistas: los dos perdedores de las semifinales
    const sfRound = bracket.rounds[bracket.rounds.length - 2];
    const sf: string[] = [];
    if (sfRound) {
      for (const m of sfRound.matches) {
        if (!m.winnerId) continue;
        const loser = m.slotA === m.winnerId ? m.slotB : m.slotA;
        if (loser) sf.push(loser);
      }
    }
    const [sf1, sf2] = sf;
    const safeSf1 = sf1 ?? championId;
    const safeSf2 = sf2 ?? championId;

    const io = this.ioRuntime.getServer();
    io.to(`tournament:${tid}`).emit(SERVER_EVENTS.TOURNAMENT_FINISHED, {
      championId,
      podium: {
        champion: championId,
        runnerUp: runnerUpId,
        semifinalists: [safeSf1, safeSf2] as [string, string],
      },
    });
    this.logger.log(`tournament ${tid} finished! champion=${championId}`);
    this.broadcastBracketUpdated(tid, bracket, bracket.rounds.length - 1);
  }

  private broadcastBracketUpdated(tid: string, bracket: Bracket, round: number): void {
    const io = this.ioRuntime.getServer();
    const payload = { bracket, round };
    io.to(`tournament:${tid}`).emit(SERVER_EVENTS.BRACKET_UPDATED, payload);
    io.to(`bracket:${tid}`).emit(SERVER_EVENTS.BRACKET_UPDATED, payload);
    io.to(`admin:${tid}`).emit(SERVER_EVENTS.BRACKET_UPDATED, payload);
  }

  private replaceBotId(bracket: Bracket, oldId: string, newId: string): void {
    for (const round of bracket.rounds) {
      for (const match of round.matches) {
        if (match.slotA === oldId) match.slotA = newId;
        if (match.slotB === oldId) match.slotB = newId;
      }
    }
  }

  async getBracket(tid: string): Promise<Bracket | null> {
    return this.redis.getJson<Bracket>(RedisKeys.tournamentBracket(tid));
  }
}
