import { type Card, cardSchema } from "@campeonato/domain";
import catalog from "./catalog.json";

let cached: readonly Card[] | null = null;

/**
 * Devuelve el catálogo validado con Zod. Se cachea tras la primera llamada.
 * Si el JSON tiene algún error de shape el parse lanza y delata el problema
 * en el bootstrap, no durante una partida.
 */
export function loadCatalog(): readonly Card[] {
  if (cached) return cached;
  const parsed = cardSchema.array().min(1).parse(catalog);
  cached = Object.freeze(parsed);
  return cached;
}

/** Accesor alternativo; retorna un array nuevo por si el consumidor quiere mutarlo. */
export function getCatalog(): Card[] {
  return [...loadCatalog()];
}

/** Filtro conveniente para construir pools de mazos (ver AGENTS.md §6.3, §16.3). */
export function filterByMaxOverall(max: number): Card[] {
  return loadCatalog().filter((c) => c.overall <= max);
}
