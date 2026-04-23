import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  adminAddBotsPayloadSchema,
  adminOpenRegistrationPayloadSchema,
  adminPausePayloadSchema,
  adminResetPayloadSchema,
  adminResumePayloadSchema,
  adminStartTournamentPayloadSchema,
  msgIdSchema,
  playerIdSchema,
  tournamentIdSchema,
} from "@campeonato/domain";
import { Logger, UseFilters } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { BotService } from "../bot/bot.service";
import { BracketService } from "../bracket/bracket.service";
import { GameError } from "../common/game-error";
import { WsExceptionFilter } from "../common/ws-exception.filter";
import { ConfigService } from "../config/config.service";
import { MatchEngineService } from "../match/match-engine.service";
import { TournamentService } from "../tournament/tournament.service";

const debugStartDuelSchema = z.object({
  msgId: msgIdSchema,
  tournamentId: tournamentIdSchema,
  player0Id: playerIdSchema.optional(),
  player1Id: playerIdSchema.optional(),
  player0WithBot: z.boolean().optional(),
});

@UseFilters(WsExceptionFilter)
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ["websocket", "polling"],
})
export class AdminGateway {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(AdminGateway.name);

  constructor(
    private readonly engine: MatchEngineService,
    private readonly bots: BotService,
    private readonly bracket: BracketService,
    private readonly tournaments: TournamentService,
    private readonly config: ConfigService,
  ) {}

  // ==========================================================================
  // Fase 3: motor de torneo
  // ==========================================================================

  @SubscribeMessage(CLIENT_EVENTS.ADMIN_START_TOURNAMENT)
  async onStartTournament(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: true; bracketSize: number }> {
    this.requireAdmin(client);
    const payload = adminStartTournamentPayloadSchema.parse(body);
    const b = await this.bracket.startTournament(payload.tournamentId);
    this.logger.log(`admin:start_tournament tid=${payload.tournamentId} size=${b.size}`);

    // Notificar estado del torneo a todos los conectados
    await this.broadcastTournamentState(payload.tournamentId);
    return { ok: true, bracketSize: b.size };
  }

  @SubscribeMessage(CLIENT_EVENTS.ADMIN_OPEN_REGISTRATION)
  async onOpenRegistration(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: true }> {
    this.requireAdmin(client);
    const payload = adminOpenRegistrationPayloadSchema.parse(body);
    await this.bracket.openRegistration(payload.tournamentId);
    await this.broadcastTournamentState(payload.tournamentId);
    this.logger.log(`admin:open_registration tid=${payload.tournamentId}`);
    return { ok: true };
  }

  @SubscribeMessage(CLIENT_EVENTS.ADMIN_RESET)
  async onReset(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: true }> {
    this.requireAdmin(client);
    const payload = adminResetPayloadSchema.parse(body);
    await this.bracket.resetTournament(payload.tournamentId);
    await this.broadcastTournamentState(payload.tournamentId);
    this.logger.log(`admin:reset tid=${payload.tournamentId}`);
    return { ok: true };
  }

  @SubscribeMessage(CLIENT_EVENTS.ADMIN_PAUSE)
  async onPause(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: true }> {
    this.requireAdmin(client);
    const payload = adminPausePayloadSchema.parse(body);
    await this.bracket.pauseTournament(payload.tournamentId);
    await this.broadcastTournamentState(payload.tournamentId);
    this.logger.log(`admin:pause tid=${payload.tournamentId}`);
    return { ok: true };
  }

  @SubscribeMessage(CLIENT_EVENTS.ADMIN_RESUME)
  async onResume(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: true }> {
    this.requireAdmin(client);
    const payload = adminResumePayloadSchema.parse(body);
    await this.bracket.resumeTournament(payload.tournamentId);
    await this.broadcastTournamentState(payload.tournamentId);
    this.logger.log(`admin:resume tid=${payload.tournamentId}`);
    return { ok: true };
  }

  /**
   * Agrega N bots al torneo. Util para:
   *  - Probar el flujo completo con un solo humano (ej: 1 humano + 1 bot).
   *  - Completar cupo cuando faltan jugadores para llegar a una potencia de 2
   *    sin esperar a que se llene el bracket con bots automaticos al iniciar.
   * Solo permitido en `registration_open`.
   */
  @SubscribeMessage(CLIENT_EVENTS.ADMIN_ADD_BOTS)
  async onAddBots(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: true; added: number; totalPlayers: number }> {
    this.requireAdmin(client);
    const payload = adminAddBotsPayloadSchema.parse(body);
    const tournament = await this.tournaments.mustGet(payload.tournamentId);
    if (tournament.status !== "registration_open") {
      throw new GameError(
        "TOURNAMENT_STARTED",
        "bots can only be added while registration is open",
      );
    }
    const added = await this.bots.ensureBots(payload.tournamentId, payload.count);
    await this.broadcastTournamentState(payload.tournamentId);
    const totalPlayers = (await this.tournaments.listPlayerIds(payload.tournamentId)).length;
    this.logger.log(
      `admin:add_bots tid=${payload.tournamentId} count=${payload.count} added=${added.length} total=${totalPlayers}`,
    );
    return { ok: true, added: added.length, totalPlayers };
  }

  // ==========================================================================
  // Fase 2: debug duel (testing pre-bracket)
  // ==========================================================================

  @SubscribeMessage("admin:debug_start_duel")
  async onStartDuel(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: true; matchId: string }> {
    this.requireAdmin(client);
    const payload = debugStartDuelSchema.parse(body);
    let { player0Id, player1Id } = payload;

    if (!player0Id || !player1Id) {
      if (!payload.player0WithBot) {
        throw new GameError(
          "INVALID_PAYLOAD",
          "player0Id + player1Id required (or player0WithBot=true)",
        );
      }
      if (!player0Id) {
        throw new GameError("INVALID_PAYLOAD", "player0Id required");
      }
      const [bot] = await this.bots.ensureBots(payload.tournamentId, 1);
      if (!bot) throw new GameError("INTERNAL", "failed to create bot");
      player1Id = bot.id;
    }

    const matchId = await this.engine.createMatch({
      tournamentId: payload.tournamentId,
      player0Id,
      player1Id,
      round: 0,
      bracketSlot: 0,
    });
    this.logger.log(
      `debug_start_duel tid=${payload.tournamentId} p0=${player0Id} p1=${player1Id} mid=${matchId}`,
    );
    return { ok: true, matchId };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private requireAdmin(client: Socket): void {
    const mode = (client.data?.auth?.mode as string | undefined) ?? "unknown";
    if (mode !== "admin") {
      throw new GameError("UNAUTHORIZED", "admin handshake required");
    }
  }

  private async broadcastTournamentState(tid: string): Promise<void> {
    const tournament = await this.tournaments.mustGet(tid);
    const playersCount = await this.tournaments.countHumans(tid);
    this.server.to(`tournament:${tid}`).emit(SERVER_EVENTS.TOURNAMENT_STATE, {
      tournament: await this.tournaments.toSummary(tournament),
      playersCount,
    });
  }
}
