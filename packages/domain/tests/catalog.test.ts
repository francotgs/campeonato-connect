import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cardSchema } from "../src/types.js";

// Leemos el JSON con fs en lugar de `import` para no crear una dependencia
// TypeScript de packages/domain hacia packages/cards (§11: domain no importa
// de ningún otro paquete del monorepo).
const here = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(here, "../../cards/src/catalog.json");
const catalogRaw = JSON.parse(readFileSync(catalogPath, "utf-8")) as unknown;

describe("catalogo de cartas (§6)", () => {
  it("pasa la validación Zod de cardSchema", () => {
    const parsed = cardSchema.array().parse(catalogRaw);
    expect(parsed.length).toBeGreaterThanOrEqual(30);
    expect(parsed.length).toBeLessThanOrEqual(40);
  });

  it("cumple los mínimos de §6.1 (8+ países, mix de posiciones)", () => {
    const parsed = cardSchema.array().parse(catalogRaw);

    const countries = new Set(parsed.map((c) => c.country));
    expect(countries.size).toBeGreaterThanOrEqual(8);

    const countBy = (pos: string) => parsed.filter((c) => c.position === pos).length;
    expect(countBy("DEL")).toBeGreaterThanOrEqual(5);
    expect(countBy("MED")).toBeGreaterThanOrEqual(5);
    expect(countBy("DEF")).toBeGreaterThanOrEqual(5);
    expect(countBy("ARQ")).toBeGreaterThanOrEqual(3);
  });

  it("tiene IDs únicos", () => {
    const parsed = cardSchema.array().parse(catalogRaw);
    const ids = parsed.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tiene al menos un pool de bots no trivial (overall ≤ 78)", () => {
    const parsed = cardSchema.array().parse(catalogRaw);
    const botPool = parsed.filter((c) => c.overall <= 78);
    // Un match humano-vs-bot necesita 30 cartas distintas; con ≤78 debe haber
    // al menos ~15 para construir mazos razonables (AGENTS.md §6.3, §16.3).
    expect(botPool.length).toBeGreaterThanOrEqual(10);
  });
});
