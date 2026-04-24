"use client";

import { getCardPortraitSrc } from "@/lib/cardPortraits";
import { cn } from "@/lib/utils";
import type { AttrKey, Card } from "@campeonato/domain";
import Image from "next/image";
import { useMemo, useState } from "react";

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

const POSITION_STYLES: Record<string, string> = {
  DEL: "border-red-300/70 bg-red-500/20 text-red-100",
  MED: "border-emerald-300/70 bg-emerald-500/20 text-emerald-100",
  DEF: "border-sky-300/70 bg-sky-500/20 text-sky-100",
  ARQ: "border-amber-300/70 bg-amber-500/20 text-amber-100",
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
  const portraitSrc = getCardPortraitSrc(card.art.portraitKey);
  const [failedPortraitKey, setFailedPortraitKey] = useState<string | null>(null);
  const imageFailed = failedPortraitKey === card.art.portraitKey;
  const initials = useMemo(() => getInitials(card.name), [card.name]);
  const positionStyle = POSITION_STYLES[card.position] ?? "border-white/30 bg-white/10 text-white";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/10 bg-[var(--bg-elevated)] shadow-2xl select-none",
        "ring-1 ring-black/20",
        compact ? "w-52" : "w-full max-w-sm",
        className,
      )}
    >
      <div
        className={cn("relative overflow-hidden", compact ? "h-44" : "h-72")}
        style={{
          background: `linear-gradient(135deg, ${from}, ${to})`,
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,0.22),transparent_34%),linear-gradient(to_bottom,rgba(5,7,15,0.05),rgba(5,7,15,0.72))]" />
        <div className="absolute inset-x-4 bottom-0 h-px bg-white/25" />

        {portraitSrc && !imageFailed ? (
          <Image
            src={portraitSrc}
            alt={card.name}
            fill
            sizes={compact ? "208px" : "(max-width: 640px) 92vw, 384px"}
            priority={false}
            className="object-cover object-top"
            onError={() => setFailedPortraitKey(card.art.portraitKey)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl font-black text-white/25">{initials}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/12 via-transparent to-black/88" />

        <div
          className={cn(
            "absolute left-3 top-3 grid place-items-center rounded-lg border border-white/25 bg-black/45 backdrop-blur-md shadow-xl",
            compact ? "size-12" : "size-16",
          )}
        >
          <span className="text-[9px] font-black uppercase leading-none text-white/55">OVR</span>
          <span
            className={cn(
              "font-black tabular-nums leading-none",
              compact ? "text-2xl" : "text-3xl",
            )}
          >
            {card.overall}
          </span>
        </div>

        <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
          <span
            className={cn(
              "rounded-md border px-2 py-1 text-[10px] font-black uppercase leading-none backdrop-blur-md",
              positionStyle,
            )}
          >
            {card.position}
          </span>
          <span className="rounded-md border border-white/20 bg-black/35 px-2 py-1 text-[10px] font-black uppercase leading-none text-white/85 backdrop-blur-md">
            {card.country}
          </span>
        </div>

        <div className="absolute inset-x-3 bottom-3">
          <h2
            className={cn(
              "font-black leading-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]",
              compact ? "text-base" : "text-2xl",
            )}
          >
            {card.name}
          </h2>
          {!compact && <div className="mt-2 h-1 w-24 rounded-full bg-white/35" />}
        </div>
      </div>

      <div className={cn("grid grid-cols-2 gap-1.5", compact ? "p-2" : "p-3")}>
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
              aria-pressed={isSelected || isHighlighted}
              onClick={() => interactive && !selectedAttribute && onPickAttribute?.(key)}
              className={cn(
                "relative overflow-hidden rounded-md border bg-white/[0.045] text-left transition",
                compact ? "min-h-10 px-2 py-1.5" : "min-h-12 px-2.5 py-2",
                interactive && !selectedAttribute
                  ? "cursor-pointer border-white/15 hover:border-emerald-300/70 hover:bg-emerald-400/10 active:scale-[0.98]"
                  : "cursor-default border-white/10",
                isSelected &&
                  "border-emerald-300/80 bg-emerald-400/[0.18] shadow-[0_0_18px_rgba(52,211,153,0.22)]",
                isHighlighted &&
                  "border-amber-300/80 bg-amber-400/[0.18] shadow-[0_0_18px_rgba(251,191,36,0.18)]",
                isDisabled && "opacity-40",
              )}
            >
              <span
                className="absolute inset-y-0 left-0 bg-white/[0.08]"
                style={{ width: `${value}%` }}
              />
              <span className="relative flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "font-black uppercase tracking-widest",
                    compact ? "text-[9px]" : "text-[10px]",
                    isSelected
                      ? "text-emerald-200"
                      : isHighlighted
                        ? "text-amber-200"
                        : "text-white/58",
                  )}
                >
                  {label}
                </span>
                <span
                  className={cn(
                    "font-black tabular-nums leading-none",
                    compact ? "text-base" : "text-xl",
                    isSelected
                      ? "text-emerald-100"
                      : isHighlighted
                        ? "text-amber-100"
                        : "text-white",
                  )}
                >
                  {value}
                </span>
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
        "relative overflow-hidden rounded-xl border border-white/10 shadow-xl flex items-center justify-center",
        "w-full max-w-sm aspect-[3/4]",
        className,
      )}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.24),transparent_32%),linear-gradient(135deg,rgba(0,0,0,0.18),rgba(0,0,0,0.58))]" />
      <div className="absolute inset-3 rounded-lg border border-white/[0.18]" />
      <span className="relative text-sm font-black uppercase tracking-[0.35em] text-white/55">
        4Match
      </span>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
