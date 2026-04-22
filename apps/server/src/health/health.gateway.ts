import { SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server } from "socket.io";

// Gateway mínimo para validar el canal Socket.IO extremo-a-extremo en Fase 0.
// Los gateways reales (tournament/match/admin, §13.1) se agregan en fases
// posteriores y reemplazan este ping.
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  },
})
export class HealthGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage("health:ping")
  handlePing(): { ok: true; ts: number } {
    return { ok: true, ts: Date.now() };
  }
}
