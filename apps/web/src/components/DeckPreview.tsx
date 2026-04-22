"use client";

import { motion } from "framer-motion";
import type { Card } from "@campeonato/domain";
import { PlayerCard } from "./PlayerCard";
import { Button } from "@/components/ui/button";

interface DeckPreviewProps {
  cards: Card[];
  opponentName: string;
  startsAt: number;
  onReady?: () => void;
}

export function DeckPreview({ cards, opponentName, onReady }: DeckPreviewProps) {
  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white px-4 py-6">
      {/* Header */}
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">
          ¡Próxima partida!
        </p>
        <h2 className="text-2xl font-black">
          vs{" "}
          <span className="text-emerald-300">{opponentName}</span>
        </h2>
        <p className="text-white/50 text-sm mt-1">Estas son tus {cards.length} cartas</p>
      </motion.div>

      {/* Cards scroll */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-6">
        {cards.map((card, i) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <PlayerCard card={card} />
          </motion.div>
        ))}
      </div>

      {/* CTA */}
      <motion.div
        className="pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <Button
          size="lg"
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black text-base"
          onClick={onReady}
        >
          ¡Listo para jugar!
        </Button>
      </motion.div>
    </div>
  );
}
