"use client";

import { useCountdown } from "@/hooks/useCountdown";
import { cn } from "@/lib/utils";

interface MatchTimerProps {
  endsAt: number;
  totalMs?: number;
  className?: string;
}

const SIZE = 72;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

export function MatchTimer({ endsAt, totalMs = 120_000, className }: MatchTimerProps) {
  const { remaining, fraction } = useCountdown(endsAt, totalMs);

  const dash = C * fraction;
  const isUrgent = remaining <= 20;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const label = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={SIZE}
        height={SIZE}
        className="-rotate-90"
        role="img"
        aria-label={`Tiempo restante: ${label}`}
      >
        <title>{`Tiempo restante: ${label}`}</title>
        {/* Track */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          className="text-white/10"
        />
        {/* Progress */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          className={cn(
            "transition-[stroke-dasharray] duration-200",
            isUrgent ? "text-red-400" : "text-emerald-400",
          )}
        />
      </svg>
      <span
        className={cn(
          "absolute text-sm font-bold tabular-nums",
          isUrgent ? "text-red-400" : "text-white",
        )}
      >
        {label}
      </span>
    </div>
  );
}
