import {
  CLIENT_EVENTS,
  type PlayerReconnectAck,
  SERVER_EVENTS,
  type TournamentStateEvent,
  playerJoinPayloadSchema,
  playerReadyPayloadSchema,
  playerReconnectPayloadSchema,
  socketAuthPayloadSchema,
} from "@campeonato/domain";
import { Logger, UseFilters } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { GameError } from "../common/game-error";
import { IoRuntimeService } from "../common/io-runtime.service";
import { WsExceptionFilter } from "../common/ws-exception.filter";
import { ConfigService } from "../config/config.service";
import { RedisKeys } from "../redis/redis-keys";
import { RedisService } from "../redis/redis.service";
import { SessionService } from "../session/session.service";
import { PlayerService } from "./player.service";
import { TournamentService } from "./tournament.service";

const ROOM = {
  tournament: (tid: string) => `tournament:${tid}` as const,
  bracket: (tid: string) => `bracket:${tid}` as const,
  admin: (tid: string) => `admin:${tid}` as const,
  player: (pid: string) => `player:${pid}` as const,
};

type AuthedSocket = Socket & {
  data: {
    auth: {
      mode: "player" | "admin" | "viewer";
      tournamentId: string;
      playerId: string | null;
      token: string | null;
    };
  };
};

@UseFilters(WsExceptionFilter)
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ["websocket", "polling"],
})
export class TournamentGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(TournamentGateway.name);

  constructor(
    private readonly session: SessionService,
    private readonly tournaments: TournamentService,
    private readonly players: PlayerService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly ioRuntime: IoRuntimeService,
  ) {}

  afterInit(server: Server): void {
    this.ioRuntime.setServer(server);
    this.logger.log("Socket.IO server initialized");
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const authRaw = client.handshake.auth ?? {};
      const auth = socketAuthPayloadSchema.parse(authRaw);

      if (auth.mode === "viewer") {
        const tid = auth.tournamentId ?? this.config.get("BOOTSTRAP_TOURNAMENT_ID");
        await client.join(ROOM.bracket(tid));
        (client as AuthedSocket).data.auth = {
          mode: "viewer",
          tournamentId: tid,
          playerId: null,
          token: null,
        };
        this.logger.debug(`viewer connected socket=${client.id} tid=${tid}`);
        return;
      }

      if (auth.mode === "admin") {
        this.session.validateAdminToken(auth.token);
        const tid = auth.tournamentId ?? this.config.get("BOOTSTRAP_TOURNAMENT_ID");
        await client.join(ROOM.admin(tid));
        await client.join(ROOM.tournament(tid));
        await client.join(ROOM.bracket(tid));
        (client as AuthedSocket).data.auth = {
          mode: "admin",
          tournamentId: tid,
          playerId: null,
          token: auth.token ?? null,
        };
        this.logger.log(`admin connected socket=${client.id} tid=${tid}`);
        await this.emitTournamentStateTo(client, tid);
        return;
      }

      if (!auth.token) {
        // Sin token: dejamos al cliente conectado para que emita `player:join`.
        const tid = auth.tournamentId ?? this.config.get("BOOTSTRAP_TOURNAMENT_ID");
        (client as AuthedSocket).data.auth = {
          mode: "player",
          tournamentId: tid,
          playerId: null,
          token: null,
        };
        await client.join(ROOM.tournament(tid));
        await this.emitTournamentStateTo(client, tid);
        return;
      }

      const payload = this.session.verify(auth.token);
      await this.bindPlayerSocket(client, payload.playerId, payload.tournamentId, auth.token);
    } catch (err) {
      const message = err instanceof Error ? err.message : "connection error";
      this.logger.warn(`handshake rejected: ${message}`);
      client.emit(SERVER_EVENTS.ERROR, {
        code: err instanceof GameError ? err.code : "UNAUTHORIZED",
        message,
      });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const pid = await this.players.playerIdBySocket(client.id);
    if (pid) {
      await this.players.attachSocket(pid, null);
      await this.players.forgetSocket(client.id);
      this.logger.debug(`player ${pid} socket dropped (id=${client.id})`);
    }
  }

  // ==========================================================================
  // Handlers
  // ==========================================================================

  @SubscribeMessage(CLIENT_EVENTS.PLAYER_JOIN)
  async onPlayerJoin(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: true; token: string; playerId: string } | { ok: false; code: string }> {
    const payload = playerJoinPayloadSchema.parse(body);
    if (!(await this.claimMsgId(payload.msgId))) {
      throw new GameError("STALE_MSG", "msgId already processed", payload.msgId);
    }
    const { player, token } = await this.tournaments.registerHuman({
      tid: payload.tournamentId,
      name: payload.name,
      company: payload.company,
    });
    await this.bindPlayerSocket(client, player.id, payload.tournamentId, token);
    await this.broadcastTournamentState(payload.tournamentId);
    return { ok: true, token, playerId: player.id };
  }

  @SubscribeMessage(CLIENT_EVENTS.PLAYER_RECONNECT)
  async onPlayerReconnect(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<PlayerReconnectAck> {
    const payload = playerReconnectPayloadSchema.parse(body);
    if (!(await this.claimMsgId(payload.msgId))) {
      throw new GameError("STALE_MSG", "msgId already processed", payload.msgId);
    }
    const token = payload.token;
    const decoded = this.session.verify(token);

    // Si el player ya no existe (p.ej. el admin reseteó el torneo), devolvemos
    // un ack estructurado `{ ok: false, code: UNAUTHORIZED }` en vez de tirar
    // excepción. Así el cliente dispara su flujo de `clearAuth()` + redirect
    // sin depender de un evento de error genérico.
    const player = await this.players.get(decoded.playerId);
    if (!player) {
      this.logger.log(`player:reconnect pid=${decoded.playerId} rejected (not found)`);
      return { ok: false, code: "UNAUTHORIZED", message: "player no longer exists" };
    }

    await this.bindPlayerSocket(client, player.id, player.tournamentId, token);
    const tournament = await this.tournaments.mustGet(player.tournamentId);
    return {
      ok: true,
      snapshot: {
        tournament: await this.tournaments.toSummary(tournament),
        yourStatus: player.status,
        currentMatchId: player.currentMatchId,
      },
    };
  }

  @SubscribeMessage(CLIENT_EVENTS.PLAYER_READY)
  async onPlayerReady(
    @MessageBody() body: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: true }> {
    const payload = playerReadyPayloadSchema.parse(body);
    const socket = client as AuthedSocket;
    if (!socket.data?.auth?.playerId) {
      throw new GameError("UNAUTHORIZED", "socket has no associated player");
    }
    if (!(await this.claimMsgId(payload.msgId))) {
      throw new GameError("STALE_MSG", "msgId already processed", payload.msgId);
    }
    // En esta fase no hacemos nada especial con `ready` (Fase 4 lo cablea a UI);
    // dejamos el hook listo para evolucionar.
    return { ok: true };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private async bindPlayerSocket(
    client: Socket,
    playerId: string,
    tournamentId: string,
    token: string,
  ): Promise<void> {
    const player = await this.players.mustGet(playerId);
    await this.players.attachSocket(playerId, client.id);
    await this.players.rememberSocket(client.id, playerId);
    await this.players.rememberToken(token, playerId);

    await client.join(ROOM.tournament(tournamentId));
    await client.join(ROOM.player(playerId));
    if (player.currentMatchId) {
      await client.join(`match:${player.currentMatchId}`);
    }

    (client as AuthedSocket).data.auth = {
      mode: "player",
      tournamentId,
      playerId,
      token,
    };
    this.logger.log(`player connected pid=${playerId} socket=${client.id}`);
    await this.emitTournamentStateTo(client, tournamentId, playerId);
  }

  private async claimMsgId(msgId: string): Promise<boolean> {
    return this.redis.claimMsgId("t4m:processed:msgs:tournament", msgId, 10 * 60);
  }

  private async emitTournamentStateTo(
    client: Socket,
    tid: string,
    playerId?: string,
  ): Promise<void> {
    const snapshot = await this.buildSnapshot(tid, playerId);
    client.emit(SERVER_EVENTS.TOURNAMENT_STATE, snapshot);
  }

  async broadcastTournamentState(tid: string): Promise<void> {
    const snapshot = await this.buildSnapshot(tid);
    this.server.to(ROOM.tournament(tid)).emit(SERVER_EVENTS.TOURNAMENT_STATE, snapshot);
    this.server.to(ROOM.bracket(tid)).emit(SERVER_EVENTS.TOURNAMENT_STATE, snapshot);
  }

  private async buildSnapshot(tid: string, playerId?: string): Promise<TournamentStateEvent> {
    // Auto-bootstrap del torneo canónico si por algún motivo la clave se perdió
    // (por ejemplo, Redis reinició o un TTL antiguo expiró). Para torneos no
    // canónicos conservamos el comportamiento estricto de `mustGet`.
    let tournament = await this.tournaments.get(tid);
    if (!tournament && tid === this.config.get("BOOTSTRAP_TOURNAMENT_ID")) {
      tournament = await this.tournaments.ensureBootstrap(tid);
    }
    if (!tournament) {
      tournament = await this.tournaments.mustGet(tid);
    }
    const playersCount = await this.tournaments.countHumans(tid);
    const snapshot: TournamentStateEvent = {
      tournament: await this.tournaments.toSummary(tournament),
      playersCount,
    };
    if (playerId) {
      const player = await this.players.get(playerId);
      if (player) snapshot.yourStatus = player.status;
    }
    return snapshot;
  }

  async emitToPlayer(playerId: string, event: string, payload: unknown): Promise<void> {
    this.server.to(ROOM.player(playerId)).emit(event, payload);
  }

  async joinMatchRoom(socketId: string | null, matchId: string): Promise<void> {
    if (!socketId) return;
    const sock = this.server.sockets.sockets.get(socketId);
    await sock?.join(`match:${matchId}`);
  }

  broadcastToMatch(matchId: string, event: string, payload: unknown): void {
    this.server.to(`match:${matchId}`).emit(event, payload);
  }
}
