import { z } from "zod";
import {
  attrKeySchema,
  bracketSchema,
  cardSchema,
  errorCodeSchema,
  matchEndReasonSchema,
  matchIdSchema,
  matchStatsSchema,
  msgIdSchema,
  playerIdSchema,
  playerStatusSchema,
  roundWinnerSchema,
  tournamentIdSchema,
  tournamentSummarySchema,
} from "./types.js";

// ============================================================================
// Nombres de eventos (AGENTS.md §13.3, §13.4)
// ============================================================================

export const CLIENT_EVENTS = {
  PLAYER_JOIN: "player:join",
  PLAYER_RECONNECT: "player:reconnect",
  PLAYER_READY: "player:ready",
  MATCH_PICK_ATTRIBUTE: "match:pick_attribute",
  MATCH_SYNC: "match:sync",
  MATCH_LEAVE: "match:leave",
  ADMIN_OPEN_REGISTRATION: "admin:open_registration",
  ADMIN_START_TOURNAMENT: "admin:start_tournament",
  ADMIN_RESET: "admin:reset",
  ADMIN_PAUSE: "admin:pause",
  ADMIN_RESUME: "admin:resume",
} as const;
export type ClientEventName = (typeof CLIENT_EVENTS)[keyof typeof CLIENT_EVENTS];

export const SERVER_EVENTS = {
  TOURNAMENT_STATE: "tournament:state",
  TOURNAMENT_RESET: "tournament:reset",
  BRACKET_UPDATED: "bracket:updated",
  MATCH_STARTING: "match:starting",
  MATCH_STARTED: "match:started",
  ROUND_STARTED: "round:started",
  ROUND_ATTRIBUTE_CHOSEN: "round:attribute_chosen",
  ROUND_RESULT: "round:result",
  MATCH_TIEBREAKER_STARTED: "match:tiebreaker_started",
  MATCH_ENDED: "match:ended",
  PLAYER_WAITING_NEXT: "player:waiting_next",
  PLAYER_ELIMINATED: "player:eliminated",
  TOURNAMENT_FINISHED: "tournament:finished",
  ERROR: "error",
} as const;
export type ServerEventName = (typeof SERVER_EVENTS)[keyof typeof SERVER_EVENTS];

// ============================================================================
// ACKs genéricos
// ============================================================================

export const okAckSchema = z.object({ ok: z.literal(true) });
export type OkAck = z.infer<typeof okAckSchema>;

export const errorAckSchema = z.object({
  ok: z.literal(false),
  code: errorCodeSchema,
  message: z.string().optional(),
});
export type ErrorAck = z.infer<typeof errorAckSchema>;

export const simpleAckSchema = z.discriminatedUnion("ok", [okAckSchema, errorAckSchema]);
export type SimpleAck = z.infer<typeof simpleAckSchema>;

// ============================================================================
// Cliente → Servidor
// Todos los payloads llevan msgId (§13.3) para idempotencia.
// ============================================================================

export const playerJoinPayloadSchema = z.object({
  msgId: msgIdSchema,
  tournamentId: tournamentIdSchema,
  name: z.string().min(1).max(40),
  company: z.string().min(1).max(40),
});
export type PlayerJoinPayload = z.infer<typeof playerJoinPayloadSchema>;

export const playerJoinAckSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    token: z.string().min(1),
    playerId: playerIdSchema,
  }),
  errorAckSchema,
]);
export type PlayerJoinAck = z.infer<typeof playerJoinAckSchema>;

export const playerReconnectPayloadSchema = z.object({
  msgId: msgIdSchema,
  token: z.string().min(1),
});
export type PlayerReconnectPayload = z.infer<typeof playerReconnectPayloadSchema>;

export const playerReconnectAckSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    snapshot: z.object({
      tournament: tournamentSummarySchema,
      yourStatus: playerStatusSchema,
      currentMatchId: matchIdSchema.nullable(),
    }),
  }),
  errorAckSchema,
]);
export type PlayerReconnectAck = z.infer<typeof playerReconnectAckSchema>;

export const playerReadyPayloadSchema = z.object({ msgId: msgIdSchema });
export type PlayerReadyPayload = z.infer<typeof playerReadyPayloadSchema>;

export const matchPickAttributePayloadSchema = z.object({
  msgId: msgIdSchema,
  matchId: matchIdSchema,
  roundNumber: z.number().int().positive(),
  attribute: attrKeySchema,
});
export type MatchPickAttributePayload = z.infer<typeof matchPickAttributePayloadSchema>;

export const matchSyncPayloadSchema = z.object({
  msgId: msgIdSchema,
  matchId: matchIdSchema,
});
export type MatchSyncPayload = z.infer<typeof matchSyncPayloadSchema>;

export const matchSyncAckSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    state: z.object({
      matchId: matchIdSchema,
      roundNumber: z.number().int().positive(),
      fsm: z.string(), // serialización simple del MatchFsmState
      yourDeckSize: z.number().int().nonnegative(),
      opponentDeckSize: z.number().int().nonnegative(),
      yourCurrentCard: cardSchema.nullable(),
      chooser: z.union([z.literal(0), z.literal(1)]),
      deadlineAt: z.number().int().nonnegative().nullable(),
      endsAt: z.number().int().nonnegative(),
    }),
  }),
  errorAckSchema,
]);
export type MatchSyncAck = z.infer<typeof matchSyncAckSchema>;

export const matchLeavePayloadSchema = z.object({
  msgId: msgIdSchema,
  matchId: matchIdSchema,
});
export type MatchLeavePayload = z.infer<typeof matchLeavePayloadSchema>;

// Admin
const adminBasePayloadSchema = z.object({
  msgId: msgIdSchema,
  tournamentId: tournamentIdSchema,
});

export const adminOpenRegistrationPayloadSchema = adminBasePayloadSchema;
export type AdminOpenRegistrationPayload = z.infer<typeof adminOpenRegistrationPayloadSchema>;

export const adminStartTournamentPayloadSchema = adminBasePayloadSchema;
export type AdminStartTournamentPayload = z.infer<typeof adminStartTournamentPayloadSchema>;

export const adminResetPayloadSchema = adminBasePayloadSchema;
export type AdminResetPayload = z.infer<typeof adminResetPayloadSchema>;

export const adminPausePayloadSchema = adminBasePayloadSchema;
export type AdminPausePayload = z.infer<typeof adminPausePayloadSchema>;

export const adminResumePayloadSchema = adminBasePayloadSchema;
export type AdminResumePayload = z.infer<typeof adminResumePayloadSchema>;

// ============================================================================
// Servidor → Cliente
// ============================================================================

export const tournamentStateEventSchema = z.object({
  tournament: tournamentSummarySchema,
  playersCount: z.number().int().nonnegative(),
  yourStatus: playerStatusSchema.optional(),
});
export type TournamentStateEvent = z.infer<typeof tournamentStateEventSchema>;

export const tournamentResetEventSchema = z.object({
  tournamentId: tournamentIdSchema,
});
export type TournamentResetEvent = z.infer<typeof tournamentResetEventSchema>;

export const bracketUpdatedEventSchema = z.object({
  bracket: bracketSchema,
  round: z.number().int().nonnegative(),
});
export type BracketUpdatedEvent = z.infer<typeof bracketUpdatedEventSchema>;

export const matchStartingEventSchema = z.object({
  matchId: matchIdSchema,
  opponent: z.object({
    id: playerIdSchema,
    name: z.string().min(1),
    company: z.string().min(1),
  }),
  myCards: z.array(cardSchema),
  startingChooser: z.union([z.literal(0), z.literal(1)]),
  /** Slot del propio jugador en la partida (0 = primer jugador, 1 = segundo). */
  mySlot: z.union([z.literal(0), z.literal(1)]),
  startsAt: z.number().int().nonnegative(),
});
export type MatchStartingEvent = z.infer<typeof matchStartingEventSchema>;

export const matchStartedEventSchema = z.object({
  matchId: matchIdSchema,
  startedAt: z.number().int().nonnegative(),
  endsAt: z.number().int().nonnegative(),
});
export type MatchStartedEvent = z.infer<typeof matchStartedEventSchema>;

export const roundStartedEventSchema = z.object({
  roundNumber: z.number().int().positive(),
  chooser: z.union([z.literal(0), z.literal(1)]),
  myCurrentCard: cardSchema,
  opponentCardBack: z.object({
    gradient: z.tuple([z.string(), z.string()]),
  }),
  deadlineAt: z.number().int().nonnegative(),
});
export type RoundStartedEvent = z.infer<typeof roundStartedEventSchema>;

export const roundAttributeChosenEventSchema = z.object({
  roundNumber: z.number().int().positive(),
  attribute: attrKeySchema,
  chosenBy: z.union([z.literal(0), z.literal(1)]),
});
export type RoundAttributeChosenEvent = z.infer<typeof roundAttributeChosenEventSchema>;

export const roundResultEventSchema = z.object({
  roundNumber: z.number().int().positive(),
  attribute: attrKeySchema,
  yourValue: z.number().int().min(1).max(99),
  opponentValue: z.number().int().min(1).max(99),
  winner: roundWinnerSchema,
  yourDeckSize: z.number().int().nonnegative(),
  opponentDeckSize: z.number().int().nonnegative(),
  revealedOpponentCard: cardSchema,
});
export type RoundResultEvent = z.infer<typeof roundResultEventSchema>;

export const matchTiebreakerStartedEventSchema = z.object({
  matchId: matchIdSchema,
  roundsToPlay: z.literal(3),
});
export type MatchTiebreakerStartedEvent = z.infer<typeof matchTiebreakerStartedEventSchema>;

export const matchEndedEventSchema = z.object({
  matchId: matchIdSchema,
  winnerId: playerIdSchema.nullable(),
  reason: matchEndReasonSchema,
  stats: matchStatsSchema,
});
export type MatchEndedEvent = z.infer<typeof matchEndedEventSchema>;

export const playerWaitingNextEventSchema = z.object({
  nextMatchETA: z.number().int().nonnegative().optional(),
});
export type PlayerWaitingNextEvent = z.infer<typeof playerWaitingNextEventSchema>;

export const playerEliminatedEventSchema = z.object({
  finalPosition: z.number().int().positive(),
  eliminatedBy: playerIdSchema,
});
export type PlayerEliminatedEvent = z.infer<typeof playerEliminatedEventSchema>;

export const tournamentFinishedEventSchema = z.object({
  championId: playerIdSchema,
  podium: z.object({
    champion: playerIdSchema,
    runnerUp: playerIdSchema,
    semifinalists: z.tuple([playerIdSchema, playerIdSchema]),
  }),
});
export type TournamentFinishedEvent = z.infer<typeof tournamentFinishedEventSchema>;

export const errorEventSchema = z.object({
  code: errorCodeSchema,
  message: z.string().min(1),
  msgId: msgIdSchema.optional(),
});
export type ErrorEvent = z.infer<typeof errorEventSchema>;

// ============================================================================
// Mapa de eventos (útil para tipar el gateway/servidor y el cliente)
// ============================================================================

export const CLIENT_EVENT_SCHEMAS = {
  [CLIENT_EVENTS.PLAYER_JOIN]: playerJoinPayloadSchema,
  [CLIENT_EVENTS.PLAYER_RECONNECT]: playerReconnectPayloadSchema,
  [CLIENT_EVENTS.PLAYER_READY]: playerReadyPayloadSchema,
  [CLIENT_EVENTS.MATCH_PICK_ATTRIBUTE]: matchPickAttributePayloadSchema,
  [CLIENT_EVENTS.MATCH_SYNC]: matchSyncPayloadSchema,
  [CLIENT_EVENTS.MATCH_LEAVE]: matchLeavePayloadSchema,
  [CLIENT_EVENTS.ADMIN_OPEN_REGISTRATION]: adminOpenRegistrationPayloadSchema,
  [CLIENT_EVENTS.ADMIN_START_TOURNAMENT]: adminStartTournamentPayloadSchema,
  [CLIENT_EVENTS.ADMIN_RESET]: adminResetPayloadSchema,
  [CLIENT_EVENTS.ADMIN_PAUSE]: adminPausePayloadSchema,
  [CLIENT_EVENTS.ADMIN_RESUME]: adminResumePayloadSchema,
} as const;

export const SERVER_EVENT_SCHEMAS = {
  [SERVER_EVENTS.TOURNAMENT_STATE]: tournamentStateEventSchema,
  [SERVER_EVENTS.TOURNAMENT_RESET]: tournamentResetEventSchema,
  [SERVER_EVENTS.BRACKET_UPDATED]: bracketUpdatedEventSchema,
  [SERVER_EVENTS.MATCH_STARTING]: matchStartingEventSchema,
  [SERVER_EVENTS.MATCH_STARTED]: matchStartedEventSchema,
  [SERVER_EVENTS.ROUND_STARTED]: roundStartedEventSchema,
  [SERVER_EVENTS.ROUND_ATTRIBUTE_CHOSEN]: roundAttributeChosenEventSchema,
  [SERVER_EVENTS.ROUND_RESULT]: roundResultEventSchema,
  [SERVER_EVENTS.MATCH_TIEBREAKER_STARTED]: matchTiebreakerStartedEventSchema,
  [SERVER_EVENTS.MATCH_ENDED]: matchEndedEventSchema,
  [SERVER_EVENTS.PLAYER_WAITING_NEXT]: playerWaitingNextEventSchema,
  [SERVER_EVENTS.PLAYER_ELIMINATED]: playerEliminatedEventSchema,
  [SERVER_EVENTS.TOURNAMENT_FINISHED]: tournamentFinishedEventSchema,
  [SERVER_EVENTS.ERROR]: errorEventSchema,
} as const;
