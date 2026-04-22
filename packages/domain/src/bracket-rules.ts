import type { Bracket, BracketMatch, BracketRound, PlayerId, Rng } from "./types.js";

// ============================================================================
// Helpers
// ============================================================================

export function nextPowerOfTwo(n: number): number {
  if (!Number.isFinite(n) || n <= 1) return 2;
  const pow = 2 ** Math.ceil(Math.log2(n));
  return pow < 2 ? 2 : pow;
}

function cloneBracket(b: Bracket): Bracket {
  return {
    size: b.size,
    rounds: b.rounds.map((r) => ({
      index: r.index,
      matches: r.matches.map((m) => ({ ...m })),
    })),
  };
}

function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i] as T;
    copy[i] = copy[j] as T;
    copy[j] = tmp;
  }
  return copy;
}

// ============================================================================
// Generación de bracket (§5.1, §15.1)
// ============================================================================

export type GenerateBracketInput = {
  humans: readonly PlayerId[];
  /** Factoría de IDs de bot; se invoca 0..n veces con índices consecutivos. */
  createBotId: (index: number) => PlayerId;
  rng?: Rng;
};

export type GenerateBracketResult = {
  bracket: Bracket;
  /** IDs generados para los bots, en orden de invocación de `createBotId`. */
  bots: PlayerId[];
};

/**
 * Genera un bracket eliminatorio de potencia de 2.
 *
 * Estrategia de seeding (§5.1):
 *   - Mezcla aleatoriamente a los humanos.
 *   - Asigna humanos primero al slot A de cada par y después al slot B.
 *   - Los bots completan los slots restantes. Garantiza que ningún par
 *     tenga dos bots en ronda 1 siempre que `humans.length ≥ size / 2`.
 *     (Esto se cumple por definición de `nextPowerOfTwo` para `n ≥ 2`.)
 */
export function generateBracket(input: GenerateBracketInput): GenerateBracketResult {
  const { humans, createBotId, rng = Math.random } = input;

  if (humans.length < 1) {
    throw new Error("generateBracket requires at least 1 human");
  }

  const size = nextPowerOfTwo(humans.length);
  const botCount = size - humans.length;
  const pairs = size / 2;

  const shuffledHumans = shuffle(humans, rng);
  const slots: Array<PlayerId | null> = new Array(size).fill(null);

  // Fase 1: llenar slot A de cada par con un humano, en orden de pares.
  let humanIdx = 0;
  for (let p = 0; p < pairs && humanIdx < shuffledHumans.length; p++) {
    const h = shuffledHumans[humanIdx];
    if (h === undefined) break;
    slots[p * 2] = h;
    humanIdx++;
  }

  // Fase 2: llenar slot B de cada par con el siguiente humano disponible.
  for (let p = 0; p < pairs && humanIdx < shuffledHumans.length; p++) {
    const h = shuffledHumans[humanIdx];
    if (h === undefined) break;
    slots[p * 2 + 1] = h;
    humanIdx++;
  }

  // Fase 3: completar con bots los slots vacíos.
  const bots: PlayerId[] = [];
  for (let i = 0; i < size; i++) {
    if (slots[i] === null) {
      const botId = createBotId(bots.length);
      bots.push(botId);
      slots[i] = botId;
    }
  }

  if (bots.length !== botCount) {
    throw new Error(
      `bracket generation mismatch: expected ${botCount} bots, produced ${bots.length}`,
    );
  }

  // Construir ronda 0 con los slots ya asignados.
  const rounds: BracketRound[] = [];
  const round0Matches: BracketMatch[] = [];
  for (let p = 0; p < pairs; p++) {
    const slotA = slots[p * 2] ?? null;
    const slotB = slots[p * 2 + 1] ?? null;
    round0Matches.push({
      slotA,
      slotB,
      matchId: null,
      winnerId: null,
      status: "pending",
    });
  }
  rounds.push({ index: 0, matches: round0Matches });

  // Rondas siguientes: placeholders vacíos hasta llegar a la final (1 match).
  let matchesInRound = pairs / 2;
  let roundIdx = 1;
  while (matchesInRound >= 1) {
    const matches: BracketMatch[] = [];
    for (let p = 0; p < matchesInRound; p++) {
      matches.push({
        slotA: null,
        slotB: null,
        matchId: null,
        winnerId: null,
        status: "pending",
      });
    }
    rounds.push({ index: roundIdx, matches });
    if (matchesInRound === 1) break;
    matchesInRound /= 2;
    roundIdx++;
  }

  return {
    bracket: { size, rounds },
    bots,
  };
}

// ============================================================================
// Avance del bracket (§15.3)
// ============================================================================

export type AdvanceBracketInput = {
  bracket: Bracket;
  roundIndex: number;
  matchIndex: number;
  winnerId: PlayerId;
  /** Opcional: ID del match siguiente ya creado (si aplica). */
  nextMatchId?: string | null;
};

export type AdvanceBracketResult = {
  bracket: Bracket;
  /** Posición destino del ganador; `null` si era la final. */
  nextSlot: {
    roundIndex: number;
    matchIndex: number;
    slot: "A" | "B";
  } | null;
  /** True cuando el ganador acaba de coronar el torneo. */
  isChampion: boolean;
};

export function advanceBracket(input: AdvanceBracketInput): AdvanceBracketResult {
  const { bracket, roundIndex, matchIndex, winnerId } = input;

  const nextBracket = cloneBracket(bracket);
  const round = nextBracket.rounds[roundIndex];
  if (!round) throw new Error(`round ${roundIndex} does not exist`);
  const match = round.matches[matchIndex];
  if (!match) throw new Error(`match ${matchIndex} in round ${roundIndex} does not exist`);

  if (match.slotA !== winnerId && match.slotB !== winnerId) {
    throw new Error(
      `winner ${winnerId} is not a participant of round ${roundIndex} match ${matchIndex}`,
    );
  }

  match.winnerId = winnerId;
  match.status = "finished";

  const nextRound = nextBracket.rounds[roundIndex + 1];
  if (!nextRound) {
    return { bracket: nextBracket, nextSlot: null, isChampion: true };
  }

  const nextMatchIndex = Math.floor(matchIndex / 2);
  const nextMatch = nextRound.matches[nextMatchIndex];
  if (!nextMatch) {
    throw new Error(`next match ${nextMatchIndex} does not exist in round ${roundIndex + 1}`);
  }

  const slot: "A" | "B" = matchIndex % 2 === 0 ? "A" : "B";
  if (slot === "A") nextMatch.slotA = winnerId;
  else nextMatch.slotB = winnerId;

  if (input.nextMatchId !== undefined && nextMatch.slotA && nextMatch.slotB) {
    nextMatch.matchId = input.nextMatchId;
    nextMatch.status = "live";
  }

  return {
    bracket: nextBracket,
    nextSlot: { roundIndex: roundIndex + 1, matchIndex: nextMatchIndex, slot },
    isChampion: false,
  };
}

// ============================================================================
// Utilidades de consulta
// ============================================================================

export function countBracketMatches(bracket: Bracket): {
  total: number;
  pending: number;
  live: number;
  finished: number;
} {
  let total = 0;
  let pending = 0;
  let live = 0;
  let finished = 0;
  for (const round of bracket.rounds) {
    for (const m of round.matches) {
      total++;
      if (m.status === "pending") pending++;
      else if (m.status === "live") live++;
      else finished++;
    }
  }
  return { total, pending, live, finished };
}

/** True si algún match de ronda 0 tiene dos bots enfrentados. Usado en tests. */
export function hasBotVsBotInRoundZero(
  bracket: Bracket,
  isBot: (id: PlayerId) => boolean,
): boolean {
  const round0 = bracket.rounds[0];
  if (!round0) return false;
  for (const m of round0.matches) {
    if (m.slotA && m.slotB && isBot(m.slotA) && isBot(m.slotB)) return true;
  }
  return false;
}
