import catalog from "./catalog.json" with { type: "json" };

// El catálogo final se poblará en Fase 1 (AGENTS.md §6, §20). Por ahora
// solo se exporta el JSON tal cual para que el resto del monorepo pueda
// resolver el import; el tipado fuerte llega con `packages/domain`.
export function loadCatalog(): unknown[] {
  return catalog as unknown[];
}
