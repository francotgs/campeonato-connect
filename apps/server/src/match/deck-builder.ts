import type { Card, Rng } from "@campeonato/domain";

export type DeckBuilderInput = {
  catalog: Card[];
  cardsPerPlayer: number;
  player0IsBot: boolean;
  player1IsBot: boolean;
  rng?: Rng;
};

export type DeckBuilderResult = {
  deckP0: Card[];
  deckP1: Card[];
  relaxed: boolean;
};

const MIN_AVG = 70;
const MAX_AVG = 85;
const MAX_ATTEMPTS = 50;

/**
 * Construye dos mazos disjuntos para una partida 1v1 (AGENTS.md §6.3):
 * - 30 cartas del catálogo, 15 por jugador (configurable).
 * - Overall promedio de cada mazo entre 70 y 85 (o tolerancia relajada tras 50
 *   intentos fallidos).
 * - Para bots: pool restringido a overall ≤72, con fallback a ≤78 si no
 *   alcanzan cartas (AGENTS.md §16.3).
 */
export function buildMatchDecks(input: DeckBuilderInput): DeckBuilderResult {
  const rng = input.rng ?? Math.random;
  const total = input.cardsPerPlayer * 2;

  const poolP0 = poolFor(input.catalog, input.player0IsBot, input.cardsPerPlayer);
  const poolP1 = poolFor(input.catalog, input.player1IsBot, input.cardsPerPlayer);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const attempted = attemptSample({
      poolP0,
      poolP1,
      cardsPerPlayer: input.cardsPerPlayer,
      total,
      rng,
      minAvg: MIN_AVG,
      maxAvg: MAX_AVG,
    });
    if (attempted) return { ...attempted, relaxed: false };
  }
  // Fallback sin restricción de overall promedio.
  const relaxed = attemptSample({
    poolP0,
    poolP1,
    cardsPerPlayer: input.cardsPerPlayer,
    total,
    rng,
    minAvg: 0,
    maxAvg: 100,
  });
  if (!relaxed) {
    throw new Error("deck builder: not enough distinct cards in the catalog");
  }
  return { ...relaxed, relaxed: true };
}

function poolFor(catalog: Card[], isBot: boolean, needed: number): Card[] {
  if (!isBot) return catalog.slice();
  const strict = catalog.filter((c) => c.overall <= 72);
  if (strict.length >= needed * 2) return strict;
  const relaxed = catalog.filter((c) => c.overall <= 78);
  if (relaxed.length >= needed * 2) return relaxed;
  return catalog.slice();
}

type AttemptArgs = {
  poolP0: Card[];
  poolP1: Card[];
  cardsPerPlayer: number;
  total: number;
  rng: Rng;
  minAvg: number;
  maxAvg: number;
};

function attemptSample(args: AttemptArgs): { deckP0: Card[]; deckP1: Card[] } | null {
  const shuffledP0 = shuffle(args.poolP0, args.rng);
  const pickedIds = new Set<string>();
  const deckP0: Card[] = [];
  for (const card of shuffledP0) {
    if (deckP0.length === args.cardsPerPlayer) break;
    if (pickedIds.has(card.id)) continue;
    pickedIds.add(card.id);
    deckP0.push(card);
  }
  if (deckP0.length < args.cardsPerPlayer) return null;

  const shuffledP1 = shuffle(
    args.poolP1.filter((c) => !pickedIds.has(c.id)),
    args.rng,
  );
  const deckP1: Card[] = [];
  for (const card of shuffledP1) {
    if (deckP1.length === args.cardsPerPlayer) break;
    deckP1.push(card);
  }
  if (deckP1.length < args.cardsPerPlayer) return null;

  const avg0 = averageOverall(deckP0);
  const avg1 = averageOverall(deckP1);
  if (avg0 < args.minAvg || avg0 > args.maxAvg) return null;
  if (avg1 < args.minAvg || avg1 > args.maxAvg) return null;

  return { deckP0, deckP1 };
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = arr[i];
    const b = arr[j];
    if (a === undefined || b === undefined) continue;
    arr[i] = b;
    arr[j] = a;
  }
  return arr;
}

function averageOverall(deck: Card[]): number {
  if (deck.length === 0) return 0;
  const sum = deck.reduce((acc, c) => acc + c.overall, 0);
  return sum / deck.length;
}
