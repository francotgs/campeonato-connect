import { CLIENT_EVENTS, SERVER_EVENTS, practiceStartPayloadSchema } from "@campeonato/domain";
import { Logger, UseFilters } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import type { Socket } from "socket.io";
import { GameError } from "../common/game-error";
import { WsExceptionFilter } from "../common/ws-exception.filter";
import { RedisService } from "../redis/redis.service";
import { SessionService } from "../session/session.service";
import { PlayerService } from "../tournament/player.service";
import { TournamentService } from "../tournament/tournament.service";
import { MatchEngineService } from "./match-engine.service";

@UseFilters(WsExceptionFilter)
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ["websocket", "polling"],
})
export class PracticeGateway {
  private readonly logger = new Logger(PracticeGateway.name);

  constructor(
    private readonly tournaments: TournamentService,
    private readonly players: PlayerService,
    private readonly session: SessionService,
    private readonly engine: MatchEngineService,
    private readonly redis: RedisService,
  ) {}

  @SubscribeMessage(CLIENT_EVENTS.PRACTICE_START)
  async onPracticeStart(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: true; token: string; playerId: string; matchId: string }> {
    const payload = practiceStartPayloadSchema.parse(body);
    if (!(await this.claimMsgId(payload.msgId))) {
      throw new GameError("STALE_MSG", "msgId already processed", payload.msgId);
    }

    await this.tournaments.ensureBootstrap(payload.tournamentId);
    const playerName = payload.name?.trim() || "Jugador invitado";

    const human = await this.players.create({
      tournamentId: payload.tournamentId,
      name: playerName,
      company: "Práctica",
      isBot: false,
      token: "pending",
    });
    const token = this.session.issueForPlayer(human.id, payload.tournamentId, "player");
    await this.players.updateToken(human.id, token);
    await this.players.rememberToken(token, human.id);
    await this.players.attachSocket(human.id, client.id);
    await this.players.rememberSocket(client.id, human.id);
    await client.join(`tournament:${payload.tournamentId}`);
    await client.join(`player:${human.id}`);
    client.data.auth = {
      mode: "player",
      tournamentId: payload.tournamentId,
      playerId: human.id,
      token,
    };

    const bot = await this.players.create({
      tournamentId: payload.tournamentId,
      name: "Bot de práctica",
      company: "CPU",
      isBot: true,
      token: "bot:practice",
    });

    const matchId = await this.engine.createMatch({
      tournamentId: payload.tournamentId,
      player0Id: human.id,
      player1Id: bot.id,
      round: 0,
      bracketSlot: -1,
      mode: "practice",
    });

    client.emit(SERVER_EVENTS.TOURNAMENT_STATE, {
      tournament: await this.tournaments.toSummary(
        await this.tournaments.mustGet(payload.tournamentId),
      ),
      playersCount: await this.tournaments.countHumans(payload.tournamentId),
      yourStatus: "in_match",
    });

    this.logger.log(`practice:start pid=${human.id} bot=${bot.id} mid=${matchId}`);
    return { ok: true, token, playerId: human.id, matchId };
  }

  private async claimMsgId(msgId: string): Promise<boolean> {
    return this.redis.claimMsgId("t4m:processed:msgs:practice", msgId, 10 * 60);
  }
}
