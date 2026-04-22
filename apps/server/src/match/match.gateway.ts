import {
  CLIENT_EVENTS,
  type MatchSyncAck,
  matchLeavePayloadSchema,
  matchPickAttributePayloadSchema,
  matchSyncPayloadSchema,
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
import { GameError } from "../common/game-error";
import { WsExceptionFilter } from "../common/ws-exception.filter";
import { PlayerService } from "../tournament/player.service";
import { MatchEngineService } from "./match-engine.service";

@UseFilters(WsExceptionFilter)
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ["websocket", "polling"],
})
export class MatchGateway {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(MatchGateway.name);

  constructor(
    private readonly engine: MatchEngineService,
    private readonly players: PlayerService,
  ) {}

  @SubscribeMessage(CLIENT_EVENTS.MATCH_PICK_ATTRIBUTE)
  async onPick(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: true }> {
    const payload = matchPickAttributePayloadSchema.parse(body);
    const pid = await this.requirePlayer(client);
    await this.engine.handlePick({
      matchId: payload.matchId,
      playerId: pid,
      msgId: payload.msgId,
      attribute: payload.attribute,
      roundNumber: payload.roundNumber,
    });
    return { ok: true };
  }

  @SubscribeMessage(CLIENT_EVENTS.MATCH_SYNC)
  async onSync(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<MatchSyncAck> {
    const payload = matchSyncPayloadSchema.parse(body);
    const pid = await this.requirePlayer(client);
    const state = await this.engine.handleSync({
      matchId: payload.matchId,
      playerId: pid,
      msgId: payload.msgId,
    });
    return { ok: true, state };
  }

  @SubscribeMessage(CLIENT_EVENTS.MATCH_LEAVE)
  async onLeave(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: true }> {
    const payload = matchLeavePayloadSchema.parse(body);
    const pid = await this.requirePlayer(client);
    await this.engine.handleLeave({
      matchId: payload.matchId,
      playerId: pid,
      msgId: payload.msgId,
    });
    return { ok: true };
  }

  private async requirePlayer(client: Socket): Promise<string> {
    const pid = await this.players.playerIdBySocket(client.id);
    if (!pid) throw new GameError("UNAUTHORIZED", "socket has no associated player");
    return pid;
  }
}
