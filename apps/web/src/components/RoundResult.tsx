"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { RoundResultEvent } from "@campeonato/domain";
import { PlayerCard } from "./PlayerCard";
import type { Card } from "@campeonato/domain";
import { cn } from "@/lib/utils";

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
  /** Carta revelada del rival. */
  opponentCard: Card;
  /** ¿Soy el ganador de esta ronda? */
  iWon: boolean;
  visible: boolean;
}

export function RoundResult({ result, opponentCard, iWon, visible }: RoundResultProps) {
  const isDraw = result.winner === "tie";

  const outcomeText = isDraw ? "EMPATE" : iWon ? "GANASTE" : "PERDISTE";
  const outcomeColor = isDraw
    ? "text-yellow-400"
    : iWon
      ? "text-emerald-400"
      : "text-red-400";
  const bgOverlay = isDraw
    ? "from-yellow-900/80"
    : iWon
      ? "from-emerald-900/80"
      : "from-red-900/80";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={cn(
            "fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 px-6",
            "bg-gradient-to-b to-[#0d1117]/95",
            bgOverlay,
          )}
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {/* Atributo elegido */}
          <p className="text-white/60 text-xs tracking-widest uppercase">
            {ATTR_LABELS[result.attribute] ?? result.attribute}
          </p>

          {/* Valores */}
          <div className="flex items-center gap-6">
            <motion.span
              className={cn(
                "text-6xl font-black tabular-nums",
                iWon && !isDraw ? "text-emerald-300" : isDraw ? "text-yellow-300" : "text-red-300",
              )}
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
            >
              {result.yourValue}
            </motion.span>
            <span className="text-white/40 text-2xl font-bold">vs</span>
            <motion.span
              className="text-6xl font-black tabular-nums text-white/60"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
            >
              {result.opponentValue}
            </motion.span>
          </div>

          {/* Banner */}
          <motion.div
            className={cn("text-4xl font-black tracking-wider", outcomeColor)}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.3 }}
          >
            {outcomeText}
          </motion.div>

          {/* Carta revelada del rival */}
          {!isDraw && (
            <div className="mt-2 w-full max-w-xs">
              <p className="text-white/40 text-[10px] text-center mb-2 uppercase tracking-widest">
                Carta del rival
              </p>
              <PlayerCard
                card={opponentCard}
                highlightAttribute={result.attribute}
                compact
              />
            </div>
          )}

          {/* Mazos */}
          <div className="flex gap-8 mt-2 text-center">
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-widest">Tu mazo</p>
              <p className="text-white text-2xl font-bold">{result.yourDeckSize}</p>
            </div>
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-widest">Rival</p>
              <p className="text-white text-2xl font-bold">{result.opponentDeckSize}</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
