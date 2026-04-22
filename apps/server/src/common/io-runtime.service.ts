import { Injectable } from "@nestjs/common";
import type { Server } from "socket.io";

/**
 * Sostiene el `Server` de Socket.IO para servicios que lo necesiten fuera de
 * los gateways (por ejemplo el motor de partida). La primera gateway en
 * inicializar invoca `setServer(...)` y el resto consume via `getServer()`.
 */
@Injectable()
export class IoRuntimeService {
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  getServer(): Server {
    if (!this.server) throw new Error("Socket.IO server is not initialized yet");
    return this.server;
  }

  ready(): boolean {
    return this.server !== null;
  }
}
