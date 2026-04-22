import { describe, expect, it } from "vitest";
import { canTransition, isTerminalState, legalTriggers, nextState } from "../src/match-fsm.js";

describe("match-fsm", () => {
  it("permite las transiciones felices del loop de partida (§14)", () => {
    expect(nextState("WAITING_START", "match_started")).toBe("PICKING");
    expect(nextState("PICKING", "pick_received")).toBe("RESOLVING");
    expect(nextState("PICKING", "pick_timeout")).toBe("RESOLVING");
    expect(nextState("RESOLVING", "resolve_done")).toBe("SHOWING_RESULT");
    expect(nextState("SHOWING_RESULT", "show_done")).toBe("PICKING");
  });

  it("modela fines por tiempo y por eliminación", () => {
    expect(nextState("SHOWING_RESULT", "time_up")).toBe("CHECK_WINNER");
    expect(nextState("SHOWING_RESULT", "deck_exhausted")).toBe("ENDED");
    expect(nextState("CHECK_WINNER", "check_winner_decided")).toBe("ENDED");
    expect(nextState("CHECK_WINNER", "check_winner_tie")).toBe("TIEBREAKER");
    expect(nextState("TIEBREAKER", "tiebreak_finished")).toBe("ENDED");
  });

  it("permite abandono desde cualquier estado no terminal", () => {
    const nonTerminal = [
      "WAITING_START",
      "PICKING",
      "RESOLVING",
      "SHOWING_RESULT",
      "CHECK_WINNER",
      "TIEBREAKER",
    ] as const;
    for (const s of nonTerminal) {
      expect(canTransition(s, "abandon")).toBe(true);
    }
  });

  it("rechaza transiciones inválidas", () => {
    expect(nextState("ENDED", "match_started")).toBeNull();
    expect(nextState("PICKING", "resolve_done")).toBeNull();
    expect(canTransition("RESOLVING", "pick_received")).toBe(false);
  });

  it("isTerminalState sólo es true para ENDED", () => {
    expect(isTerminalState("ENDED")).toBe(true);
    expect(isTerminalState("PICKING")).toBe(false);
  });

  it("legalTriggers lista correctamente", () => {
    const triggers = legalTriggers("SHOWING_RESULT");
    expect(new Set(triggers)).toEqual(
      new Set(["show_done", "deck_exhausted", "time_up", "abandon"]),
    );
  });
});
