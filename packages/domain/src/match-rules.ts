import { ATTR_KEYS, type AttrKey, type Card, type CardId, type Rng } from "./types.js";

// ============================================================================
// Resolución de una ronda (§4.2)
// ============================================================================

export type RoundOutcome = {
  attribute: AttrKey;
  valueChooser: number;
  valueOpponent: number;
  winner: "chooser" | "opponent" | "tie";
};

export function resolveRound(
  chooserCard: Card,
  opponentCard: Card,
  attribute: AttrKey,
): RoundOutcome {
  const valueChooser = chooserCard.attributes[attribute];
  const valueOpponent = opponentCard.attributes[attribute];
  let winner: RoundOutcome["winner"];
  if (valueChooser > valueOpponent) winner = "chooser";
  else if (valueChooser < valueOpponent) winner = "opponent";
  else winner = "tie";
  return { attribute, valueChooser, valueOpponent, winner };
}

// ============================================================================
// Ordenamientos deterministas de atributos
// ============================================================================

// Desempate por nombre de atributo (orden de ATTR_KEYS) para hacer la elección
// reproducible en tests y en el auto-pick por timeout (§4.2).
function attrIndex(key: AttrKey): number {
  return ATTR_KEYS.indexOf(key);
}

export function sortAttributesAsc(card: Card): AttrKey[] {
  const entries = ATTR_KEYS.map((k) => [k, card.attributes[k]] as const);
  return [...entries]
    .sort((a, b) => {
      if (a[1] !== b[1]) return a[1] - b[1];
      return attrIndex(a[0]) - attrIndex(b[0]);
    })
    .map(([k]) => k);
}

export function lowestAttribute(card: Card): AttrKey {
  const sorted = sortAttributesAsc(card);
  // Array is guaranteed length 8 because Card schema validates all 8 keys.
  const first = sorted[0];
  if (!first) throw new Error("card has no attributes");
  return first;
}

// ============================================================================
// Operaciones sobre el mazo (§4.2, §4.3)
// ============================================================================

export type DrawResult = {
  top: CardId;
  rest: readonly CardId[];
} | null;

export function drawCard(deck: readonly CardId[]): DrawResult {
  if (deck.length === 0) return null;
  const [top, ...rest] = deck;
  if (top === undefined) return null;
  return { top, rest };
}

// Al ganar, las cartas ganadas van al fondo del mazo del ganador (§4.2, paso 6).
export function addToBottom(deck: readonly CardId[], cards: readonly CardId[]): CardId[] {
  return [...deck, ...cards];
}

// ============================================================================
// Fin de partida por conteo (§4.3)
// ============================================================================

export type CountWinner = "p0" | "p1" | "tie";

export function winnerByCount(deckSizes: readonly [number, number]): CountWinner {
  const [a, b] = deckSizes;
  if (a > b) return "p0";
  if (a < b) return "p1";
  return "tie";
}

// ============================================================================
// Bot pick (§16.2)
// ============================================================================

export type BotMatchContext = {
  /** Ronda del torneo (0-indexed). Cuartos ≈ round 3 si bracket=16, etc. */
  tournamentRound: number;
  /** Tamaño total del bracket (potencia de 2). */
  bracketSize: number;
  /** Diferencia de cartas contra el humano (botDeck − humanDeck). */
  deckDiffAgainstHuman: number;
};

/**
 * Modo "piadoso": el bot deja de jugar bien. Se activa cuando el bot ya
 * avanzó demasiado (≥ cuartos) o cuando está ganando por paliza (+3 cartas).
 * Ver AGENTS.md §16.1 y §16.2.
 */
export function isMercifulMode(ctx: BotMatchContext): boolean {
  const quartersRound = Math.max(0, Math.log2(ctx.bracketSize) - 3);
  if (ctx.tournamentRound >= quartersRound) return true;
  if (ctx.deckDiffAgainstHuman >= 3) return true;
  return false;
}

/**
 * Elige el atributo que el bot va a jugar cuando le toca pickear.
 * Sigue exactamente la política de AGENTS.md §16.2.
 */
export function pickBotAttribute(
  botCard: Card,
  ctx: BotMatchContext,
  rng: Rng = Math.random,
): AttrKey {
  const asc = sortAttributesAsc(botCard);

  if (isMercifulMode(ctx)) {
    const chosen = asc[0];
    if (!chosen) throw new Error("bot card has no attributes");
    return chosen;
  }

  if (rng() < 0.7) {
    // Segundo atributo más bajo: apenas por encima del peor.
    const chosen = asc[1] ?? asc[0];
    if (!chosen) throw new Error("bot card has no attributes");
    return chosen;
  }

  const low4 = asc.slice(0, 4);
  if (low4.length === 0) throw new Error("bot card has no attributes");
  const idx = Math.floor(rng() * low4.length);
  const chosen = low4[Math.min(idx, low4.length - 1)];
  if (!chosen) throw new Error("sample index out of range");
  return chosen;
}
