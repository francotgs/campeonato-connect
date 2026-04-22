import type { MatchFsmState } from "./types.js";

// ============================================================================
// Triggers (AGENTS.md §14.2)
// ============================================================================

export const MATCH_TRIGGERS = [
  "match_started",
  "pick_received",
  "pick_timeout",
  "resolve_done",
  "show_done",
  "deck_exhausted",
  "time_up",
  "check_winner_decided",
  "check_winner_tie",
  "tiebreak_round_done",
  "tiebreak_finished",
  "abandon",
] as const;
export type MatchTrigger = (typeof MATCH_TRIGGERS)[number];

// ============================================================================
// Tabla de transiciones
// ============================================================================

type TransitionRow = {
  from: MatchFsmState;
  trigger: MatchTrigger;
  to: MatchFsmState;
};

// Fuente de verdad de la FSM. Todas las transiciones están respaldadas
// por §14.2 de AGENTS.md; los triggers `check_winner_*` y `tiebreak_*`
// desambiguan los caminos condicionales descritos en ese cuadro.
const TRANSITIONS: readonly TransitionRow[] = [
  // WAITING_START
  { from: "WAITING_START", trigger: "match_started", to: "PICKING" },
  { from: "WAITING_START", trigger: "abandon", to: "ENDED" },

  // PICKING
  { from: "PICKING", trigger: "pick_received", to: "RESOLVING" },
  { from: "PICKING", trigger: "pick_timeout", to: "RESOLVING" },
  { from: "PICKING", trigger: "abandon", to: "ENDED" },
  { from: "PICKING", trigger: "time_up", to: "CHECK_WINNER" },

  // RESOLVING
  { from: "RESOLVING", trigger: "resolve_done", to: "SHOWING_RESULT" },
  { from: "RESOLVING", trigger: "abandon", to: "ENDED" },

  // SHOWING_RESULT
  { from: "SHOWING_RESULT", trigger: "show_done", to: "PICKING" },
  { from: "SHOWING_RESULT", trigger: "deck_exhausted", to: "ENDED" },
  { from: "SHOWING_RESULT", trigger: "time_up", to: "CHECK_WINNER" },
  { from: "SHOWING_RESULT", trigger: "abandon", to: "ENDED" },

  // CHECK_WINNER
  { from: "CHECK_WINNER", trigger: "check_winner_decided", to: "ENDED" },
  { from: "CHECK_WINNER", trigger: "check_winner_tie", to: "TIEBREAKER" },
  { from: "CHECK_WINNER", trigger: "abandon", to: "ENDED" },

  // TIEBREAKER (cada ronda extra reusa PICKING → RESOLVING → SHOWING_RESULT)
  { from: "TIEBREAKER", trigger: "tiebreak_round_done", to: "PICKING" },
  { from: "TIEBREAKER", trigger: "tiebreak_finished", to: "ENDED" },
  { from: "TIEBREAKER", trigger: "abandon", to: "ENDED" },
];

// ============================================================================
// API pura
// ============================================================================

export function isTerminalState(state: MatchFsmState): boolean {
  return state === "ENDED";
}

/** Devuelve el próximo estado legal para `(from, trigger)` o `null`. */
export function nextState(from: MatchFsmState, trigger: MatchTrigger): MatchFsmState | null {
  const row = TRANSITIONS.find((r) => r.from === from && r.trigger === trigger);
  return row ? row.to : null;
}

export function canTransition(from: MatchFsmState, trigger: MatchTrigger): boolean {
  return nextState(from, trigger) !== null;
}

/** Lista todos los triggers legales desde un estado. Útil para tests/diagnóstico. */
export function legalTriggers(from: MatchFsmState): MatchTrigger[] {
  return TRANSITIONS.filter((r) => r.from === from).map((r) => r.trigger);
}

/** Lista todos los destinos legales (estado, trigger) desde un estado. */
export function legalTransitions(from: MatchFsmState): ReadonlyArray<{
  trigger: MatchTrigger;
  to: MatchFsmState;
}> {
  return TRANSITIONS.filter((r) => r.from === from).map(({ trigger, to }) => ({ trigger, to }));
}
