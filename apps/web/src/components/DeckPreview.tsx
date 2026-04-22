"use client";

import { BrandBackground, BrandHeader, StatusPill } from "@/components/brand";
import { Button } from "@/components/ui/button";
import type { Card } from "@campeonato/domain";
import { motion } from "framer-motion";
import { Swords } from "lucide-react";
import { PlayerCard } from "./PlayerCard";

interface DeckPreviewProps {
  cards: Card[];
  opponentName: string;
  startsAt: number;
  onReady?: () => void;
}

export function DeckPreview({ cards, opponentName, onReady }: DeckPreviewProps) {
  return (
    <BrandBackground variant="subtle">
      <div className="flex flex-col min-h-screen">
        <BrandHeader
          title="Próxima partida"
          subtitle={`vs ${opponentName}`}
          right={
            <StatusPill tone="gold" pulse>
              Preparate
            </StatusPill>
          }
        />

        <motion.div
          className="text-center py-5 px-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="inline-flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-[0.25em]">
            <Swords className="size-3.5" />
            Tu mazo
          </div>
          <h2 className="text-2xl font-black mt-2">
            Revisá tus <span className="text-emerald-400">{cards.length} cartas</span>
          </h2>
          <p className="text-white/50 text-sm mt-1">
            Cuando estés listo, tocá el botón para confirmar.
          </p>
        </motion.div>

        <div className="flex-1 overflow-y-auto space-y-4 px-4 pb-6">
          {cards.map((card, i) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <PlayerCard card={card} />
            </motion.div>
          ))}
        </div>

        <motion.div
          className="sticky bottom-0 left-0 right-0 px-4 pt-3 pb-5 bg-gradient-to-t from-[var(--bg-deep)] via-[var(--bg-deep)]/95 to-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Button
            size="lg"
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-base gap-2"
            onClick={onReady}
          >
            ¡Listo para jugar!
          </Button>
        </motion.div>
      </div>
    </BrandBackground>
  );
}
