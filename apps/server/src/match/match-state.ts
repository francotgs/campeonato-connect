import type { AttrKey, CardId, MatchEndReason, MatchFsmState } from "@campeonato/domain";

export type PlayerSlot = 0 | 1;

/**
 * Forma exacta del JSON guardado en `t4m:match:{mid}`. Es un superset de
 * `MatchState` del dominio (que representa lo que se expone por WS) porque
 * incluye campos operacionales (tiebreaker, processedMsgs, firstChooser).
 */
export type PersistedMatchPlayer = {
  id: string;
  name: string;
  company: string;
  isBot: boolean;
  deck: CardId[];
};

export type PersistedRoundLogEntry = {
  roundNumber: number;
  chooser: PlayerSlot;
  attribute: AttrKey | null;
  p0Value: number | null;
  p1Value: number | null;
  winner: "p0" | "p1" | "draw";
  p0DeckSizeAfter: number;
  p1DeckSizeAfter: number;
  p0CardId: CardId;
  p1CardId: CardId;
};

export type TiebreakerState = {
  active: boolean;
  roundsPlayed: number;
  winsP0: number;
  winsP1: number;
  lastWinner: PlayerSlot | null;
};

export type PersistedMatchState = {
  id: string;
  tournamentId: string;
  round: number;
  bracketSlot: number;
  players: [PersistedMatchPlayer, PersistedMatchPlayer];
  fsm: MatchFsmState;
  currentChooser: PlayerSlot;
  firstChooser: PlayerSlot;
  currentAttribute: AttrKey | null;
  roundNumber: number;
  startedAt: number;
  endsAt: number;
  deadlineAt: number | null;
  log: PersistedRoundLogEntry[];
  tiebreaker: TiebreakerState;
  winnerId: string | null;
  endReason: MatchEndReason | null;
  endedAt: number | null;
};

export function topCardId(player: PersistedMatchPlayer): CardId {
  const id = player.deck[0];
  if (!id) throw new Error(`player ${player.id} deck is empty`);
  return id;
}

export function deckSize(player: PersistedMatchPlayer): number {
  return player.deck.length;
}

export function otherSlot(slot: PlayerSlot): PlayerSlot {
  return slot === 0 ? 1 : 0;
}
