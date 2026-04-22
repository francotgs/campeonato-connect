import type { Card, CardAttributes } from "../src/types.js";

export function makeCard(
  id: string,
  attributes: CardAttributes,
  overrides: Partial<Card> = {},
): Card {
  return {
    id,
    name: id,
    country: "AR",
    position: "MED",
    overall: 80,
    attributes,
    art: {
      portraitKey: id,
      gradient: ["#000000", "#FFFFFF"],
    },
    ...overrides,
  };
}

/** Atributos todo-en-50 como base para variar sólo lo que importa en cada test. */
export function attrs(overrides: Partial<CardAttributes> = {}): CardAttributes {
  return {
    velocidad: 50,
    tiro: 50,
    dribbling: 50,
    pase: 50,
    defensa: 50,
    fisico: 50,
    regate: 50,
    reflejos: 50,
    ...overrides,
  };
}

/** RNG pseudo-aleatorio determinista (mulberry32) para tests reproducibles. */
export function seededRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
