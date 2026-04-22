import { msgIdSchema, playerIdSchema, tournamentIdSchema } from "@campeonato/domain";
import { Logger, UseFilters } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from "@nestjs/websockets";
import type { Socket } from "socket.io";
import { z } from "zod";
import { BotService } from "../bot/bot.service";
import { GameError } from "../common/game-error";
import { WsExceptionFilter } from "../common/ws-exception.filter";
import { ConfigService } from "../config/config.service";
import { MatchEngineService } from "../match/match-engine.service";

const debugStartDuelSchema = z.object({
  msgId: msgIdSchema,
  tournamentId: tournamentIdSchema,
  player0Id: playerIdSchema.optional(),
  player1Id: playerIdSchema.optional(),
  player0WithBot: z.boolean().optional(),
});

/**
 * Gateway mínimo de admin para Fase 2. Solo expone `admin:debug_start_duel`
 * para poder disparar una partida 1v1 antes de tener el motor de torneo
 * completo (ese lo cubre Fase 3 con bracket + start_tournament real).
 *
 * Requiere haber hecho handshake con `auth.mode = "admin"` y el
 * `ADMIN_TOKEN` correcto (validado en `TournamentGateway`).
 */
@UseFilters(WsExceptionFilter)
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ["websocket", "polling"],
})
export class AdminGateway {
  private readonly logger = new Logger(AdminGateway.name);

  constructor(
    private readonly engine: MatchEngineService,
    private readonly bots: BotService,
    private readonly config: ConfigService,
  ) {}

  @SubscribeMessage("admin:debug_start_duel")
  async onStartDuel(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: true; matchId: string }> {
    const mode = (client.data?.auth?.mode as string | undefined) ?? "unknown";
    if (mode !== "admin") {
      throw new GameError("UNAUTHORIZED", "admin handshake required");
    }
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
}
