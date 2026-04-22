import { z } from "zod";

// ============================================================================
// Utilidades
// ============================================================================

/** Función de números pseudo-aleatorios (`Math.random`-compatible). */
export type Rng = () => number;

// ============================================================================
// Primitivas de identidad
// ============================================================================

export const playerIdSchema = z.string().min(1);
export type PlayerId = z.infer<typeof playerIdSchema>;

export const matchIdSchema = z.string().min(1);
export type MatchId = z.infer<typeof matchIdSchema>;

export const tournamentIdSchema = z.string().min(1);
export type TournamentId = z.infer<typeof tournamentIdSchema>;

export const msgIdSchema = z.string().uuid();
export type MsgId = z.infer<typeof msgIdSchema>;

// ============================================================================
// Cartas (AGENTS.md §4.4, §6.2)
// ============================================================================

export const ATTR_KEYS = [
  "velocidad",
  "tiro",
  "dribbling",
  "pase",
  "defensa",
  "fisico",
  "regate",
  "reflejos",
] as const;

export const attrKeySchema = z.enum(ATTR_KEYS);
export type AttrKey = z.infer<typeof attrKeySchema>;

export const POSITIONS = ["DEL", "MED", "DEF", "ARQ"] as const;
export const positionSchema = z.enum(POSITIONS);
export type Position = z.infer<typeof positionSchema>;

const attributeValueSchema = z.number().int().min(1).max(99);

export const cardAttributesSchema = z.object({
  velocidad: attributeValueSchema,
  tiro: attributeValueSchema,
  dribbling: attributeValueSchema,
  pase: attributeValueSchema,
  defensa: attributeValueSchema,
  fisico: attributeValueSchema,
  regate: attributeValueSchema,
  reflejos: attributeValueSchema,
});
export type CardAttributes = z.infer<typeof cardAttributesSchema>;

export const cardArtSchema = z.object({
  portraitKey: z.string().min(1),
  gradient: z.tuple([z.string(), z.string()]),
});
export type CardArt = z.infer<typeof cardArtSchema>;

export const cardIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9_]+$/, "cardId must be lowercase alphanumeric with underscores");
export type CardId = z.infer<typeof cardIdSchema>;

export const cardSchema = z.object({
  id: cardIdSchema,
  name: z.string().min(1),
  country: z.string().length(2),
  position: positionSchema,
  overall: z.number().int().min(1).max(99),
  attributes: cardAttributesSchema,
  art: cardArtSchema,
});
export type Card = z.infer<typeof cardSchema>;

// ============================================================================
// Tournament
// ============================================================================

export const tournamentStatusSchema = z.enum([
  "registration_open",
  "running",
  "finished",
  "paused",
]);
export type TournamentStatus = z.infer<typeof tournamentStatusSchema>;

export const tournamentSummarySchema = z.object({
  id: tournamentIdSchema,
  name: z.string().min(1),
  status: tournamentStatusSchema,
  cupoMax: z.number().int().positive(),
  matchDuration: z.number().int().positive(),
  cardsPerPlayer: z.number().int().positive(),
});
export type TournamentSummary = z.infer<typeof tournamentSummarySchema>;

// ============================================================================
// Player
// ============================================================================

export const playerStatusSchema = z.enum([
  "registered",
  "in_match",
  "waiting_next_match",
  "eliminated",
  "champion",
]);
export type PlayerStatus = z.infer<typeof playerStatusSchema>;

// ============================================================================
// Bracket (AGENTS.md §15.2)
// ============================================================================

export const bracketMatchStatusSchema = z.enum(["pending", "live", "finished"]);
export type BracketMatchStatus = z.infer<typeof bracketMatchStatusSchema>;

export const bracketMatchSchema = z.object({
  slotA: playerIdSchema.nullable(),
  slotB: playerIdSchema.nullable(),
  matchId: matchIdSchema.nullable(),
  winnerId: playerIdSchema.nullable(),
  status: bracketMatchStatusSchema,
});
export type BracketMatch = z.infer<typeof bracketMatchSchema>;

export const bracketRoundSchema = z.object({
  index: z.number().int().nonnegative(),
  matches: z.array(bracketMatchSchema),
});
export type BracketRound = z.infer<typeof bracketRoundSchema>;

export const bracketSchema = z.object({
  size: z.number().int().positive(),
  rounds: z.array(bracketRoundSchema),
});
export type Bracket = z.infer<typeof bracketSchema>;

// ============================================================================
// Match FSM (AGENTS.md §14)
// ============================================================================

export const MATCH_FSM_STATES = [
  "WAITING_START",
  "PICKING",
  "RESOLVING",
  "SHOWING_RESULT",
  "CHECK_WINNER",
  "TIEBREAKER",
  "ENDED",
] as const;
export const matchFsmStateSchema = z.enum(MATCH_FSM_STATES);
export type MatchFsmState = z.infer<typeof matchFsmStateSchema>;

// ============================================================================
// Match state (AGENTS.md §12.3)
// ============================================================================

export const roundWinnerSchema = z.enum(["you", "opponent", "tie"]);
export type RoundWinner = z.infer<typeof roundWinnerSchema>;

export const roundLogEntrySchema = z.object({
  roundNumber: z.number().int().positive(),
  chooser: z.union([z.literal(0), z.literal(1)]),
  attribute: attrKeySchema,
  valueP0: z.number().int().min(1).max(99),
  valueP1: z.number().int().min(1).max(99),
  winner: z.union([z.literal(0), z.literal(1), z.literal("tie")]),
  at: z.number().int().nonnegative(),
});
export type RoundLogEntry = z.infer<typeof roundLogEntrySchema>;

export const matchPlayerSchema = z.object({
  id: playerIdSchema,
  deck: z.array(cardIdSchema),
  currentCardIdx: z.number().int().nonnegative(),
});
export type MatchPlayer = z.infer<typeof matchPlayerSchema>;

export const matchEndReasonSchema = z.enum([
  "elimination",
  "time_up",
  "tiebreaker",
  "walkover",
  "abandoned",
  "double_disconnect",
]);
export type MatchEndReason = z.infer<typeof matchEndReasonSchema>;

export const matchStatsSchema = z.object({
  roundsPlayed: z.number().int().nonnegative(),
  roundsWonByP0: z.number().int().nonnegative(),
  roundsWonByP1: z.number().int().nonnegative(),
  ties: z.number().int().nonnegative(),
  finalDeckSizes: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
});
export type MatchStats = z.infer<typeof matchStatsSchema>;

export const matchStateSchema = z.object({
  id: matchIdSchema,
  tournamentId: tournamentIdSchema,
  round: z.number().int().nonnegative(),
  bracketSlot: z.number().int().nonnegative(),
  players: z.tuple([matchPlayerSchema, matchPlayerSchema]),
  fsm: matchFsmStateSchema,
  currentChooser: z.union([z.literal(0), z.literal(1)]),
  currentAttribute: attrKeySchema.nullable(),
  roundNumber: z.number().int().positive(),
  startedAt: z.number().int().nonnegative(),
  endsAt: z.number().int().nonnegative(),
  deadlineAt: z.number().int().nonnegative().nullable(),
  log: z.array(roundLogEntrySchema),
  isTiebreaker: z.boolean(),
  tiebreakerRoundsPlayed: z.number().int().nonnegative(),
});
export type MatchState = z.infer<typeof matchStateSchema>;

// ============================================================================
// Errores (AGENTS.md §13.5)
// ============================================================================

export const ERROR_CODES = [
  "INVALID_PAYLOAD",
  "UNAUTHORIZED",
  "TOURNAMENT_NOT_FOUND",
  "TOURNAMENT_STARTED",
  "TOURNAMENT_FULL",
  "DUPLICATE_NAME",
  "NOT_YOUR_TURN",
  "ALREADY_PICKED",
  "MATCH_NOT_ACTIVE",
  "UNKNOWN_ATTRIBUTE",
  "STALE_MSG",
  "INTERNAL",
] as const;
export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

// ============================================================================
// Auth (AGENTS.md §13.2)
// ============================================================================

export const authModeSchema = z.enum(["player", "admin", "viewer"]);
export type AuthMode = z.infer<typeof authModeSchema>;

export const socketAuthPayloadSchema = z.object({
  token: z.string().nullable(),
  mode: authModeSchema,
});
export type SocketAuthPayload = z.infer<typeof socketAuthPayloadSchema>;
