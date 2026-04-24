"use client";

import { BrandBackground, BrandHeader, StatusPill } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useCountdown } from "@/hooks/useCountdown";
import type { Card } from "@campeonato/domain";
import { motion } from "framer-motion";
import { CheckCircle2, Clock3, Swords } from "lucide-react";
import { useState } from "react";
import { PlayerCard } from "./PlayerCard";

const PREVIEW_WINDOW_MS = 20_000;

interface DeckPreviewProps {
  cards: Card[];
  opponentName: string;
  startsAt: number;
  onReady?: () => void;
}

export function DeckPreview({ cards, opponentName, startsAt, onReady }: DeckPreviewProps) {
  const [ready, setReady] = useState(false);
  const { remaining, fraction } = useCountdown(startsAt, PREVIEW_WINDOW_MS);
  const progress = Math.max(0, Math.min(100, (1 - fraction) * 100));

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
            La partida empieza automáticamente. Usá este tiempo para mirar tu mazo.
          </p>
          <div className="mt-4 mx-auto w-full max-w-xs rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-white/55">
              <span className="inline-flex items-center gap-2">
                <Clock3 className="size-3.5 text-emerald-300" />
                Inicio
              </span>
              <span className="text-emerald-300">{remaining}s</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400 transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
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
            disabled={ready}
            onClick={() => {
              setReady(true);
              onReady?.();
            }}
          >
            {ready ? (
              <>
                <CheckCircle2 className="size-4" />
                Listo, esperando inicio
              </>
            ) : (
              "Estoy listo"
            )}
          </Button>
        </motion.div>
      </div>
    </BrandBackground>
  );
}
