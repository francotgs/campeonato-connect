import { Injectable } from "@nestjs/common";

export type MatchEndedEvent = {
  matchId: string;
  tournamentId: string;
  winnerId: string;
  /** Índice de ronda del bracket (0 = primera ronda). */
  round: number;
  /** Índice de la partida dentro de esa ronda. */
  bracketSlot: number;
};

type MatchEndedHandler = (event: MatchEndedEvent) => void | Promise<void>;

/**
 * Bus de eventos ligero para notificar a BracketService cuando termina una
 * partida, sin crear una dependencia circular entre MatchModule y BracketModule.
 *
 * MatchEngineService publica vía `emitMatchEnded`.
 * BracketService suscribe en `onModuleInit` vía `onMatchEnded`.
 */
@Injectable()
export class MatchEventService {
  private readonly handlers: MatchEndedHandler[] = [];

  onMatchEnded(handler: MatchEndedHandler): void {
    this.handlers.push(handler);
  }

  emitMatchEnded(event: MatchEndedEvent): void {
    for (const h of this.handlers) {
      void Promise.resolve(h(event)).catch(() => undefined);
    }
  }
}
