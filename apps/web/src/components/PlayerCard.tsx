"use client";

import type { AttrKey, Card } from "@campeonato/domain";
import { cn } from "@/lib/utils";

// Orden y etiquetas de los 8 atributos
const ATTRIBUTES: { key: AttrKey; label: string }[] = [
  { key: "velocidad", label: "VEL" },
  { key: "tiro", label: "TIR" },
  { key: "dribbling", label: "DRI" },
  { key: "pase", label: "PAS" },
  { key: "defensa", label: "DEF" },
  { key: "fisico", label: "FIS" },
  { key: "regate", label: "REG" },
  { key: "reflejos", label: "REF" },
];

const POSITION_COLORS: Record<string, string> = {
  DEL: "bg-red-500",
  MED: "bg-green-500",
  DEF: "bg-blue-500",
  ARQ: "bg-yellow-500",
};

interface PlayerCardProps {
  card: Card;
  /** Si true, los atributos son tappables (turno de elección). */
  interactive?: boolean;
  /** Atributo ya elegido (deshabilita los demás). */
  selectedAttribute?: AttrKey | null;
  /** Atributo que el oponente eligió (para mostrar resultado). */
  highlightAttribute?: AttrKey | null;
  onPickAttribute?: (attr: AttrKey) => void;
  className?: string;
  /** Si true, muestra la carta compacta (para overlay de resultado). */
  compact?: boolean;
}

export function PlayerCard({
  card,
  interactive = false,
  selectedAttribute = null,
  highlightAttribute = null,
  onPickAttribute,
  className,
  compact = false,
}: PlayerCardProps) {
  const [from, to] = card.art.gradient;
  const posColor = POSITION_COLORS[card.position] ?? "bg-slate-500";

  return (
    <div
      className={cn(
        "rounded-2xl overflow-hidden shadow-2xl select-none",
        compact ? "w-48" : "w-full max-w-sm",
        className,
      )}
    >
      {/* Header con gradiente */}
      <div
        className="relative px-4 pt-4 pb-6"
        style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      >
        {/* Overall */}
        <div className="absolute top-3 right-3 flex flex-col items-center">
          <span className="text-white/70 text-[10px] font-semibold uppercase leading-none">
            OVR
          </span>
          <span className="text-white text-2xl font-black leading-tight">
            {card.overall}
          </span>
        </div>

        {/* Posición */}
        <span
          className={cn(
            "inline-block text-white text-[10px] font-bold px-2 py-0.5 rounded-full mb-2",
            posColor,
          )}
        >
          {card.position}
        </span>

        {/* Nombre */}
        <h2
          className={cn(
            "text-white font-black leading-tight drop-shadow",
            compact ? "text-base" : "text-xl",
          )}
        >
          {card.name}
        </h2>

        {/* País */}
        <p className="text-white/70 text-xs mt-0.5">{card.country}</p>
      </div>

      {/* Atributos */}
      <div className="bg-[#0d1117] divide-y divide-white/5">
        {ATTRIBUTES.map(({ key, label }) => {
          const value = card.attributes[key];
          const isSelected = selectedAttribute === key;
          const isHighlighted = highlightAttribute === key;
          const isDisabled = interactive && !!selectedAttribute && !isSelected;

          return (
            <button
              key={key}
              type="button"
              disabled={!interactive || isDisabled || !!selectedAttribute}
              onClick={() => interactive && !selectedAttribute && onPickAttribute?.(key)}
              className={cn(
                "w-full flex items-center justify-between px-4 transition-colors",
                compact ? "py-1.5" : "py-2.5",
                interactive && !selectedAttribute
                  ? "cursor-pointer hover:bg-white/10 active:bg-white/20"
                  : "cursor-default",
                isSelected && "bg-emerald-900/40 border-l-2 border-emerald-400",
                isHighlighted && "bg-amber-900/40 border-l-2 border-amber-400",
                isDisabled && "opacity-40",
              )}
            >
              <span
                className={cn(
                  "text-xs font-bold tracking-widest uppercase",
                  isSelected
                    ? "text-emerald-400"
                    : isHighlighted
                      ? "text-amber-400"
                      : "text-white/50",
                )}
              >
                {label}
              </span>
              <span
                className={cn(
                  "text-lg font-black tabular-nums",
                  isSelected
                    ? "text-emerald-300"
                    : isHighlighted
                      ? "text-amber-300"
                      : "text-white",
                )}
              >
                {value}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Carta del reverso (rival — solo gradiente, sin datos). */
export function CardBack({
  gradient,
  className,
}: {
  gradient: [string, string];
  className?: string;
}) {
  const [from, to] = gradient;
  return (
    <div
      className={cn(
        "rounded-2xl shadow-xl flex items-center justify-center",
        "w-full max-w-sm aspect-[3/4]",
        className,
      )}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <span className="text-4xl opacity-30">?</span>
    </div>
  );
}
