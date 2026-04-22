import { describe, expect, it } from "vitest";
import {
  advanceBracket,
  countBracketMatches,
  generateBracket,
  hasBotVsBotInRoundZero,
  nextPowerOfTwo,
} from "../src/bracket-rules.js";
import { seededRng } from "./fixtures.js";

describe("nextPowerOfTwo", () => {
  it("respeta el piso de 2 slots", () => {
    expect(nextPowerOfTwo(0)).toBe(2);
    expect(nextPowerOfTwo(1)).toBe(2);
    expect(nextPowerOfTwo(2)).toBe(2);
    expect(nextPowerOfTwo(3)).toBe(4);
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(129)).toBe(256);
    expect(nextPowerOfTwo(256)).toBe(256);
  });
});

describe("generateBracket", () => {
  const makeHumans = (n: number) => Array.from({ length: n }, (_, i) => `h-${i}`);
  const createBot = (i: number) => `bot-${i}`;
  const isBot = (id: string) => id.startsWith("bot-");

  it("arma un bracket de 256 para 247 humanos con 9 bots (§5.1)", () => {
    const { bracket, bots } = generateBracket({
      humans: makeHumans(247),
      createBotId: createBot,
      rng: seededRng(123),
    });
    expect(bracket.size).toBe(256);
    expect(bots).toHaveLength(9);
    // Ronda 0 = 128 partidas; los logs del bracket van desde ronda 0 hasta la final.
    expect(bracket.rounds[0]?.matches).toHaveLength(128);
    expect(bracket.rounds.at(-1)?.matches).toHaveLength(1);
    expect(bracket.rounds).toHaveLength(8); // 256→128→64→32→16→8→4→2→1 = 9 niveles

    // Todos los humanos aparecen exactamente una vez en ronda 0.
    const round0Humans = new Set<string>();
    for (const m of bracket.rounds[0]?.matches ?? []) {
      if (m.slotA && !isBot(m.slotA)) round0Humans.add(m.slotA);
      if (m.slotB && !isBot(m.slotB)) round0Humans.add(m.slotB);
    }
    expect(round0Humans.size).toBe(247);
  });

  it("el seeding impide bot-vs-bot en ronda 0 (§5.1)", () => {
    // 9 cupos de bots distintos, repitiendo con distintas semillas.
    for (const seed of [1, 7, 42, 99, 314159]) {
      const { bracket } = generateBracket({
        humans: makeHumans(247),
        createBotId: createBot,
        rng: seededRng(seed),
      });
      expect(hasBotVsBotInRoundZero(bracket, isBot)).toBe(false);
    }
  });

  it("maneja casos borde: 1 humano → bracket de 2 con 1 bot", () => {
    const { bracket, bots } = generateBracket({
      humans: ["solo"],
      createBotId: createBot,
    });
    expect(bracket.size).toBe(2);
    expect(bots).toHaveLength(1);
    // Para tamaño 2 la única ronda es la propia final.
    expect(bracket.rounds).toHaveLength(1);
    expect(bracket.rounds[0]?.matches).toHaveLength(1);
  });
});

describe("advanceBracket", () => {
  const makeHumans = (n: number) => Array.from({ length: n }, (_, i) => `h-${i}`);

  it("promueve al ganador al siguiente match en el slot correcto", () => {
    const { bracket } = generateBracket({
      humans: makeHumans(8),
      createBotId: (i) => `bot-${i}`,
      rng: seededRng(1),
    });
    const round0 = bracket.rounds[0]!;
    const firstMatch = round0.matches[0]!;
    const winner = firstMatch.slotA!;

    const result = advanceBracket({
      bracket,
      roundIndex: 0,
      matchIndex: 0,
      winnerId: winner,
    });

    expect(result.isChampion).toBe(false);
    expect(result.nextSlot).toEqual({ roundIndex: 1, matchIndex: 0, slot: "A" });
    expect(result.bracket.rounds[0]?.matches[0]?.winnerId).toBe(winner);
    expect(result.bracket.rounds[0]?.matches[0]?.status).toBe("finished");
    expect(result.bracket.rounds[1]?.matches[0]?.slotA).toBe(winner);
  });

  it("marca al ganador como campeón cuando se resuelve la final", () => {
    const { bracket } = generateBracket({
      humans: makeHumans(2),
      createBotId: (i) => `bot-${i}`,
      rng: seededRng(1),
    });
    // Bracket de 2 → solo ronda 0 con 1 match y un wrapper "final" con 1 match más.
    // La función genera rondas hasta `matchesInRound === 1` inclusive, entonces:
    // rounds[0] = final directa. Al resolverla, es campeón.
    const finalMatch = bracket.rounds[0]!.matches[0]!;
    const winner = finalMatch.slotA!;
    const result = advanceBracket({
      bracket,
      roundIndex: 0,
      matchIndex: 0,
      winnerId: winner,
    });
    expect(result.isChampion).toBe(true);
    expect(result.nextSlot).toBeNull();
  });

  it("rechaza avanzar con un winnerId que no participó", () => {
    const { bracket } = generateBracket({
      humans: makeHumans(4),
      createBotId: (i) => `bot-${i}`,
      rng: seededRng(1),
    });
    expect(() =>
      advanceBracket({
        bracket,
        roundIndex: 0,
        matchIndex: 0,
        winnerId: "no-existe",
      }),
    ).toThrow(/not a participant/);
  });

  it("countBracketMatches refleja el avance", () => {
    const { bracket } = generateBracket({
      humans: makeHumans(4),
      createBotId: (i) => `bot-${i}`,
      rng: seededRng(1),
    });
    const before = countBracketMatches(bracket);
    expect(before.finished).toBe(0);

    const w = bracket.rounds[0]!.matches[0]!.slotA!;
    const { bracket: after } = advanceBracket({
      bracket,
      roundIndex: 0,
      matchIndex: 0,
      winnerId: w,
    });
    const stats = countBracketMatches(after);
    expect(stats.finished).toBe(1);
  });
});
