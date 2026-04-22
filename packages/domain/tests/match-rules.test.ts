import { describe, expect, it } from "vitest";
import {
  addToBottom,
  drawCard,
  isMercifulMode,
  lowestAttribute,
  pickBotAttribute,
  resolveRound,
  sortAttributesAsc,
  winnerByCount,
} from "../src/match-rules.js";
import { attrs, makeCard, seededRng } from "./fixtures.js";

describe("resolveRound", () => {
  it("asigna la carta al chooser si su atributo es mayor", () => {
    const chooser = makeCard("chooser", attrs({ velocidad: 90 }));
    const opponent = makeCard("opponent", attrs({ velocidad: 60 }));
    const out = resolveRound(chooser, opponent, "velocidad");
    expect(out).toEqual({
      attribute: "velocidad",
      valueChooser: 90,
      valueOpponent: 60,
      winner: "chooser",
    });
  });

  it("asigna la carta al oponente si el atributo es mayor en su carta", () => {
    const chooser = makeCard("chooser", attrs({ tiro: 40 }));
    const opponent = makeCard("opponent", attrs({ tiro: 88 }));
    const out = resolveRound(chooser, opponent, "tiro");
    expect(out.winner).toBe("opponent");
    expect(out.valueChooser).toBe(40);
    expect(out.valueOpponent).toBe(88);
  });

  it("empata cuando los atributos coinciden (§4.2 paso 4)", () => {
    const c = makeCard("a", attrs({ dribbling: 77 }));
    const o = makeCard("b", attrs({ dribbling: 77 }));
    expect(resolveRound(c, o, "dribbling").winner).toBe("tie");
  });
});

describe("ordenamientos de atributos", () => {
  it("sortAttributesAsc es determinista y estable por nombre", () => {
    // Dos atributos con el mismo valor deben resolver por orden de ATTR_KEYS.
    const card = makeCard("x", attrs({ velocidad: 30, tiro: 30, dribbling: 40, pase: 99 }));
    const asc = sortAttributesAsc(card);
    // ATTR_KEYS = [velocidad, tiro, dribbling, pase, defensa, fisico, regate, reflejos]
    // velocidad y tiro están empatados con 30, velocidad viene primero por índice.
    expect(asc[0]).toBe("velocidad");
    expect(asc[1]).toBe("tiro");
    expect(asc.at(-1)).toBe("pase");
  });

  it("lowestAttribute coincide con el primero del sort asc", () => {
    const card = makeCard("x", attrs({ reflejos: 8, velocidad: 99 }));
    expect(lowestAttribute(card)).toBe("reflejos");
  });
});

describe("operaciones sobre el mazo", () => {
  it("drawCard saca el tope y devuelve el resto", () => {
    const deck = ["a", "b", "c"];
    const r = drawCard(deck);
    expect(r).not.toBeNull();
    expect(r?.top).toBe("a");
    expect(r?.rest).toEqual(["b", "c"]);
  });

  it("drawCard devuelve null si el mazo está vacío", () => {
    expect(drawCard([])).toBeNull();
  });

  it("addToBottom agrega al final sin mutar el original", () => {
    const deck = ["a", "b"];
    const next = addToBottom(deck, ["c", "d"]);
    expect(next).toEqual(["a", "b", "c", "d"]);
    expect(deck).toEqual(["a", "b"]);
  });

  it("winnerByCount respeta mayorías y empate", () => {
    expect(winnerByCount([8, 4])).toBe("p0");
    expect(winnerByCount([3, 9])).toBe("p1");
    expect(winnerByCount([5, 5])).toBe("tie");
  });
});

describe("bot policy (§16.2)", () => {
  it("modo piadoso activa por ronda ≥ cuartos", () => {
    // Bracket 16 → 4 rondas → cuartos = ronda 1 (log2(16)-3 = 1).
    expect(isMercifulMode({ tournamentRound: 1, bracketSize: 16, deckDiffAgainstHuman: 0 })).toBe(
      true,
    );
    expect(isMercifulMode({ tournamentRound: 0, bracketSize: 16, deckDiffAgainstHuman: 0 })).toBe(
      false,
    );
  });

  it("modo piadoso activa si la diferencia contra el humano es ≥ 3", () => {
    expect(isMercifulMode({ tournamentRound: 0, bracketSize: 256, deckDiffAgainstHuman: 3 })).toBe(
      true,
    );
  });

  it("en modo piadoso el bot elige el atributo más bajo (perder a propósito)", () => {
    const card = makeCard("bot", attrs({ velocidad: 20, reflejos: 10, tiro: 80 }));
    const attr = pickBotAttribute(
      card,
      { tournamentRound: 5, bracketSize: 16, deckDiffAgainstHuman: 0 },
      seededRng(42),
    );
    expect(attr).toBe("reflejos");
  });

  it("en modo normal siempre elige entre los 4 atributos más bajos", () => {
    const card = makeCard(
      "bot",
      attrs({
        velocidad: 20,
        tiro: 25,
        dribbling: 30,
        pase: 35,
        defensa: 60,
        fisico: 70,
        regate: 80,
        reflejos: 15,
      }),
    );
    const low4 = new Set(["reflejos", "velocidad", "tiro", "dribbling"]);
    const rng = seededRng(7);
    for (let i = 0; i < 30; i++) {
      const a = pickBotAttribute(
        card,
        { tournamentRound: 0, bracketSize: 256, deckDiffAgainstHuman: 0 },
        rng,
      );
      expect(low4.has(a)).toBe(true);
    }
  });
});
