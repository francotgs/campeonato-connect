export const MATCH_EMITTER = "MATCH_EMITTER";

export interface MatchEmitter {
  /** Emite un evento al room `match:{mid}` (ambos jugadores). */
  broadcastToMatch(mid: string, event: string, payload: unknown): void;
  /** Emite un evento directo a un jugador específico (room `player:{pid}`). */
  emitToPlayer(pid: string, event: string, payload: unknown): void;
  /** Fuerza al socket del jugador (si está online) a unirse al room de una partida. */
  joinMatchRoomForPlayer(pid: string, mid: string): Promise<void>;
}
