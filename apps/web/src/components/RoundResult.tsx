"use client";

import { cn } from "@/lib/utils";
import type { RoundResultEvent } from "@campeonato/domain";
import type { Card } from "@campeonato/domain";
import { AnimatePresence, motion } from "framer-motion";
import { PlayerCard } from "./PlayerCard";

const ATTR_LABELS: Record<string, string> = {
  velocidad: "VELOCIDAD",
  tiro: "TIRO",
  dribbling: "DRIBBLING",
  pase: "PASE",
  defensa: "DEFENSA",
  fisico: "FÍSICO",
  regate: "REGATE",
  reflejos: "REFLEJOS",
};

interface RoundResultProps {
  result: RoundResultEvent;
  opponentCard: Card;
  iWon: boolean;
  visible: boolean;
}

export function RoundResult({ result, opponentCard, iWon, visible }: RoundResultProps) {
  const isDraw = result.winner === "tie";

  const outcomeText = isDraw ? "EMPATE" : iWon ? "GANASTE" : "PERDISTE";
  const outcomeColor = isDraw ? "text-amber-400" : iWon ? "text-emerald-400" : "text-red-400";
  const bgOverlay = isDraw ? "from-amber-900/70" : iWon ? "from-emerald-900/70" : "from-red-900/70";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={cn(
            "fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 px-6",
            "bg-gradient-to-b to-[var(--bg-deep)]/95 backdrop-blur-sm",
            bgOverlay,
          )}
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-white/60 text-[10px] tracking-[0.3em] uppercase font-bold">
            {ATTR_LABELS[result.attribute] ?? result.attribute}
          </p>

          <div className="flex items-center gap-6">
            <motion.span
              className={cn(
                "text-7xl font-black tabular-nums drop-shadow-[0_0_24px_currentColor]",
                iWon && !isDraw ? "text-emerald-300" : isDraw ? "text-amber-300" : "text-red-300",
              )}
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
            >
              {result.yourValue}
            </motion.span>
            <span className="text-white/40 text-2xl font-bold">vs</span>
            <motion.span
              className="text-7xl font-black tabular-nums text-white/60"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
            >
              {result.opponentValue}
            </motion.span>
          </div>

          <motion.div
            className={cn("text-4xl font-black tracking-[0.15em]", outcomeColor)}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.3 }}
          >
            {outcomeText}
          </motion.div>

          {!isDraw && (
            <div className="mt-2 w-full max-w-xs">
              <p className="text-white/40 text-[10px] text-center mb-2 uppercase tracking-[0.25em] font-bold">
                Carta del rival
              </p>
              <PlayerCard
                card={opponentCard}
                highlightAttribute={result.attribute}
                compact
                className="mx-auto"
              />
            </div>
          )}

          <div className="flex gap-10 mt-2 text-center">
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-widest">Tu mazo</p>
              <p className="text-white text-2xl font-black tabular-nums">{result.yourDeckSize}</p>
            </div>
            <div className="w-px bg-white/15" />
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-widest">Rival</p>
              <p className="text-white text-2xl font-black tabular-nums">
                {result.opponentDeckSize}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
