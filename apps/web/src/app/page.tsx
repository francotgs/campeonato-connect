import { Trophy } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Trophy className="size-16 text-primary" strokeWidth={1.5} />
      <div className="space-y-2">
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">
          Campeonato MundIAl 4Match
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Fase 0 del monorepo inicializada. Próximo paso: dominio puro y catálogo.
        </p>
      </div>
      <code className="bg-muted text-muted-foreground rounded-md px-3 py-1 text-xs">
        apps/web · Next.js 15 · Tailwind v4
      </code>
    </main>
  );
}
