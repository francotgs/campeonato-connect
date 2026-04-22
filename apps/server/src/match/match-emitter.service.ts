import { Injectable } from "@nestjs/common";
import { IoRuntimeService } from "../common/io-runtime.service";
import { PlayerService } from "../tournament/player.service";
import type { MatchEmitter } from "./match-emitter";

@Injectable()
export class MatchEmitterService implements MatchEmitter {
  constructor(
    private readonly io: IoRuntimeService,
    private readonly players: PlayerService,
  ) {}

  broadcastToMatch(mid: string, event: string, payload: unknown): void {
    this.io.getServer().to(`match:${mid}`).emit(event, payload);
  }

  emitToPlayer(pid: string, event: string, payload: unknown): void {
    this.io.getServer().to(`player:${pid}`).emit(event, payload);
  }

  async joinMatchRoomForPlayer(pid: string, mid: string): Promise<void> {
    const player = await this.players.get(pid);
    if (!player || !player.socketId) return;
    const socket = this.io.getServer().sockets.sockets.get(player.socketId);
    await socket?.join(`match:${mid}`);
  }
}
