"use client";

import type {
  Card,
  MatchEndedEvent,
  MatchStartingEvent,
  MatchStartedEvent,
  PlayerEliminatedEvent,
  PlayerWaitingNextEvent,
  RoundAttributeChosenEvent,
  RoundResultEvent,
  RoundStartedEvent,
  TournamentFinishedEvent,
  TournamentStateEvent,
  AttrKey,
} from "@campeonato/domain";
import { create } from "zustand";

// ============================================================================
// Fases de juego del jugador
// ============================================================================

export type GamePhase =
  | "idle"            // sin conexión / sin token
  | "lobby"           // inscripto, esperando inicio de torneo
  | "previewing"      // recibió match:starting, ve su mazo antes de la partida
  | "waiting_start"   // cuenta regresiva hasta que empieza la partida
  | "in_match"        // partida activa
  | "round_result"    // mostrando resultado de ronda (2-3 s)
  | "tiebreaker"      // se activó tiebreaker
  | "match_ended"     // partida terminada, mostrando pantalla de resultado
  | "waiting_next"    // ganó, esperando próximo rival
  | "eliminated"      // eliminado del torneo
  | "champion";       // campeón del torneo

// ============================================================================
// Tipo del store
// ============================================================================

export interface GameStore {
  // ── Auth ──────────────────────────────────────────────────────
  playerId: string | null;
  token: string | null;
  tournamentId: string | null;
  playerName: string | null;

  // ── Torneo ────────────────────────────────────────────────────
  tournament: TournamentStateEvent["tournament"] | null;
  playersCount: number;

  // ── Preview de mazo (match:starting) ──────────────────────────
  matchId: string | null;
  mySlot: 0 | 1 | null;
  opponent: MatchStartingEvent["opponent"] | null;
  myCards: Card[];         // mazo completo (preview)
  startingChooser: 0 | 1 | null;
  startsAt: number | null;

  // ── Partida activa ────────────────────────────────────────────
  endsAt: number | null;
  roundNumber: number;
  chooser: 0 | 1 | null;       // slot que elige en esta ronda
  myCurrentCard: Card | null;
  opponentCardBack: { gradient: [string, string] } | null;
  deadlineAt: number | null;
  myDeckSize: number;
  opponentDeckSize: number;
  chosenAttribute: AttrKey | null;  // atributo que el chooser ya eligió
  pickSent: boolean;               // para evitar doble envío

  // ── Resultado de ronda ────────────────────────────────────────
  lastResult: RoundResultEvent | null;

  // ── Fin de partida ────────────────────────────────────────────
  matchResult: MatchEndedEvent | null;

  // ── Post-partida ──────────────────────────────────────────────
  eliminatedBy: string | null;
  finalPosition: number | null;
  champion: TournamentFinishedEvent | null;

  // ── Fase ──────────────────────────────────────────────────────
  phase: GamePhase;

  // ── Errores de conexión ───────────────────────────────────────
  socketError: string | null;

  // ── Acciones ──────────────────────────────────────────────────
  setAuth: (playerId: string, token: string, tournamentId: string, name: string) => void;
  clearAuth: () => void;
  setPhase: (phase: GamePhase) => void;
  setSocketError: (msg: string | null) => void;
  markPickSent: () => void;
  clearPickSent: () => void;

  onTournamentState: (data: TournamentStateEvent) => void;
  onMatchStarting: (data: MatchStartingEvent) => void;
  onMatchStarted: (data: MatchStartedEvent) => void;
  onRoundStarted: (data: RoundStartedEvent) => void;
  onRoundAttributeChosen: (data: RoundAttributeChosenEvent) => void;
  onRoundResult: (data: RoundResultEvent) => void;
  onMatchTiebreakerStarted: () => void;
  onMatchEnded: (data: MatchEndedEvent) => void;
  onPlayerWaitingNext: (data: PlayerWaitingNextEvent) => void;
  onPlayerEliminated: (data: PlayerEliminatedEvent) => void;
  onTournamentFinished: (data: TournamentFinishedEvent) => void;
}

// ============================================================================
// Store
// ============================================================================

export const useGameStore = create<GameStore>((set, get) => ({
  // ── Auth ──────────────────────────────────────────────────────
  playerId: null,
  token: null,
  tournamentId: null,
  playerName: null,

  // ── Torneo ────────────────────────────────────────────────────
  tournament: null,
  playersCount: 0,

  // ── Preview ───────────────────────────────────────────────────
  matchId: null,
  mySlot: null,
  opponent: null,
  myCards: [],
  startingChooser: null,
  startsAt: null,

  // ── Partida ───────────────────────────────────────────────────
  endsAt: null,
  roundNumber: 0,
  chooser: null,
  myCurrentCard: null,
  opponentCardBack: null,
  deadlineAt: null,
  myDeckSize: 0,
  opponentDeckSize: 0,
  chosenAttribute: null,
  pickSent: false,

  // ── Resultado ─────────────────────────────────────────────────
  lastResult: null,

  // ── Fin ───────────────────────────────────────────────────────
  matchResult: null,

  // ── Post ──────────────────────────────────────────────────────
  eliminatedBy: null,
  finalPosition: null,
  champion: null,

  // ── Fase ──────────────────────────────────────────────────────
  phase: "idle",

  socketError: null,

  // ── Acciones de autenticación ─────────────────────────────────
  setAuth: (playerId, token, tournamentId, name) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("4match:token", token);
      localStorage.setItem("4match:playerId", playerId);
      localStorage.setItem("4match:tournamentId", tournamentId);
      localStorage.setItem("4match:playerName", name);
    }
    set({ playerId, token, tournamentId, playerName: name, phase: "lobby" });
  },

  clearAuth: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("4match:token");
      localStorage.removeItem("4match:playerId");
      localStorage.removeItem("4match:tournamentId");
      localStorage.removeItem("4match:playerName");
    }
    set({
      playerId: null, token: null, tournamentId: null, playerName: null,
      phase: "idle",
    });
  },

  setPhase: (phase) => set({ phase }),
  setSocketError: (msg) => set({ socketError: msg }),
  markPickSent: () => set({ pickSent: true }),
  clearPickSent: () => set({ pickSent: false }),

  // ── Handlers de eventos del servidor ─────────────────────────
  onTournamentState: (data) => {
    const { phase } = get();
    set({
      tournament: data.tournament,
      playersCount: data.playersCount,
      // solo actualizamos fase a lobby si estábamos idle
      phase: phase === "idle" ? "lobby" : phase,
    });
  },

  onMatchStarting: (data) => {
    set({
      matchId: data.matchId,
      mySlot: data.mySlot,
      opponent: data.opponent,
      myCards: data.myCards,
      startingChooser: data.startingChooser,
      startsAt: data.startsAt,
      myDeckSize: data.myCards.length,
      phase: "previewing",
      lastResult: null,
      matchResult: null,
      chosenAttribute: null,
      pickSent: false,
    });
  },

  onMatchStarted: (data) => {
    set({ endsAt: data.endsAt, phase: "waiting_start" });
  },

  onRoundStarted: (data) => {
    set({
      roundNumber: data.roundNumber,
      chooser: data.chooser,
      myCurrentCard: data.myCurrentCard,
      opponentCardBack: data.opponentCardBack,
      deadlineAt: data.deadlineAt,
      phase: "in_match",
      lastResult: null,
      chosenAttribute: null,
      pickSent: false,
    });
  },

  onRoundAttributeChosen: (data) => {
    set({ chosenAttribute: data.attribute });
  },

  onRoundResult: (data) => {
    set({
      lastResult: data,
      myDeckSize: data.yourDeckSize,
      opponentDeckSize: data.opponentDeckSize,
      phase: "round_result",
    });
  },

  onMatchTiebreakerStarted: () => {
    set({ phase: "tiebreaker" });
    // vuelve a in_match cuando llegue el próximo round:started
  },

  onMatchEnded: (data) => {
    set({ matchResult: data, phase: "match_ended" });
  },

  onPlayerWaitingNext: (_data) => {
    set({ phase: "waiting_next" });
  },

  onPlayerEliminated: (data) => {
    set({
      eliminatedBy: data.eliminatedBy,
      finalPosition: data.finalPosition,
      phase: "eliminated",
    });
  },

  onTournamentFinished: (data) => {
    const { playerId } = get();
    set({
      champion: data,
      phase: data.championId === playerId ? "champion" : "eliminated",
    });
  },
}));
