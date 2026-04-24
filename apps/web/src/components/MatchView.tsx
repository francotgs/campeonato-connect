"use client";

import { BrandBackground, Panel, StatusPill } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { getSocket } from "@/lib/socket";
import { useGameStore } from "@/lib/store";
import type { AttrKey, MatchEndReason } from "@campeonato/domain";
import { CLIENT_EVENTS } from "@campeonato/domain";
import { AnimatePresence, motion } from "framer-motion";
import { Clock3, Home, LogOut, Swords } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { MatchTimer } from "./MatchTimer";
import { CardBack, PlayerCard } from "./PlayerCard";
import { RoundResult } from "./RoundResult";

export function MatchView() {
  const store = useGameStore();
  const abandonSentRef = useRef(false);
  const socket = getSocket();
  const router = useRouter();

  const {
    matchId,
    mySlot,
    opponent,
    myCurrentCard,
    opponentCardBack,
    endsAt,
    deadlineAt,
    roundNumber,
    chooser,
    myDeckSize,
    opponentDeckSize,
    chosenAttribute,
    pickSent,
    tiebreakerActive,
    tiebreakerRoundsToPlay,
    tiebreakerStartRound,
    phase,
    lastResult,
    matchResult,
  } = store;

  const isMyTurn = mySlot !== null && chooser === mySlot;
  const isWinner = matchResult?.winnerId === store.playerId;
  const isPractice = store.sessionMode === "practice";
  const tiebreakerRound =
    tiebreakerActive && tiebreakerStartRound !== null
      ? Math.max(1, Math.min(tiebreakerRoundsToPlay, roundNumber - tiebreakerStartRound + 1))
      : null;

  const handlePickAttribute = useCallback(
    (attr: AttrKey) => {
      if (!matchId || !roundNumber || pickSent) return;
      store.markPickSent();
      socket.emit(
        CLIENT_EVENTS.MATCH_PICK_ATTRIBUTE,
        { msgId: crypto.randomUUID(), matchId, roundNumber, attribute: attr },
        () => {},
      );
    },
    [matchId, roundNumber, pickSent, socket, store],
  );

  const handleAbandon = useCallback(() => {
    if (!matchId || abandonSentRef.current) return;
    abandonSentRef.current = true;
    socket.emit(CLIENT_EVENTS.MATCH_LEAVE, { msgId: crypto.randomUUID(), matchId }, () => {});
  }, [matchId, socket]);

  const handleBackToStart = useCallback(() => {
    const tid = store.tournamentId ?? "t-default";
    store.clearAuth();
    router.replace(`/join/${tid}`);
  }, [router, store]);

  useEffect(() => {
    if (phase === "match_ended") abandonSentRef.current = false;
  }, [phase]);

  if (phase === "match_ended" && matchResult) {
    const myFinalDeckSize =
      mySlot === 1 ? matchResult.stats.finalDeckSizes[1] : matchResult.stats.finalDeckSizes[0];
    const opponentFinalDeckSize =
      mySlot === 1 ? matchResult.stats.finalDeckSizes[0] : matchResult.stats.finalDeckSizes[1];

    return (
      <BrandBackground variant={isWinner ? "celebrate" : "subtle"}>
        <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-6">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="space-y-3"
          >
            <p className="text-white/50 text-[10px] uppercase tracking-[0.3em] font-bold">
              Partida terminada
            </p>
            <h2
              className={`text-6xl font-black drop-shadow-[0_0_24px_currentColor] ${isWinner ? "text-emerald-400" : "text-red-400"}`}
            >
              {isWinner ? "¡GANASTE!" : "PERDISTE"}
            </h2>
            <p className="text-white/60 text-sm">
              Motivo:{" "}
              <span className="text-white font-medium">
                {formatMatchEndReason(matchResult.reason)}
              </span>{" "}
              · Rondas jugadas:{" "}
              <span className="text-white font-medium">{matchResult.stats.roundsPlayed}</span>
            </p>
          </motion.div>

          <Panel className="px-6 py-4 flex gap-10 text-center">
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-widest">Tu mazo</p>
              <p className="text-2xl font-black tabular-nums">{myFinalDeckSize}</p>
            </div>
            <div className="w-px bg-white/10" />
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-widest">Rival</p>
              <p className="text-2xl font-black tabular-nums">{opponentFinalDeckSize}</p>
            </div>
          </Panel>

          {isPractice && (
            <Button
              size="lg"
              className="w-full max-w-xs h-12 bg-emerald-500 hover:bg-emerald-400 text-black font-black gap-2"
              onClick={handleBackToStart}
            >
              <Home className="size-4" />
              Volver al inicio
            </Button>
          )}
        </div>
      </BrandBackground>
    );
  }

  return (
    <BrandBackground variant="subtle">
      <div className="flex flex-col min-h-screen select-none">
        {/* Header con info del rival, timer, ronda */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-subtle bg-[rgba(11,16,32,0.65)] backdrop-blur">
          <div className="text-left min-w-0">
            <p className="text-white/40 text-[10px] uppercase tracking-widest">Rival</p>
            <p className="text-white font-bold text-sm truncate max-w-[140px]">
              {opponent?.name ?? "—"}
            </p>
          </div>

          {tiebreakerActive ? (
            <div className="flex flex-col items-center gap-1">
              <StatusPill tone="warning">Desempate</StatusPill>
              {tiebreakerRound !== null && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/45">
                  {tiebreakerRound}/{tiebreakerRoundsToPlay}
                </span>
              )}
            </div>
          ) : (
            endsAt && <MatchTimer endsAt={endsAt} totalMs={120_000} />
          )}

          <div className="text-right">
            <p className="text-white/40 text-[10px] uppercase tracking-widest">Ronda</p>
            <p className="text-white font-bold text-sm tabular-nums">{roundNumber}</p>
          </div>
        </div>

        {/* Contadores de mazo */}
        <div className="flex items-center justify-between px-6 py-3">
          <div className="inline-flex items-center gap-2 text-xs text-white/60">
            <div className="size-2 rounded-full bg-emerald-400" />
            Tu mazo <span className="text-white font-bold tabular-nums ml-0.5">{myDeckSize}</span>
          </div>
          <Swords className="size-3.5 text-white/30" />
          <div className="inline-flex items-center gap-2 text-xs text-white/60">
            Rival{" "}
            <span className="text-white font-bold tabular-nums ml-0.5">{opponentDeckSize}</span>
            <div className="size-2 rounded-full bg-red-400" />
          </div>
        </div>

        {tiebreakerActive && (
          <motion.div
            className="mx-4 mb-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-center"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="inline-flex items-center gap-2 text-amber-300 text-xs font-black uppercase tracking-widest">
              <Clock3 className="size-3.5" />
              Tiempo cumplido
            </div>
            <p className="mt-1 text-white/70 text-sm">
              Empate en cartas: se juegan 3 rondas extra para definir la partida.
            </p>
          </motion.div>
        )}

        {/* Turno */}
        <div className="text-center pb-3 min-h-[32px]">
          <AnimatePresence mode="wait">
            {isMyTurn ? (
              <motion.div
                key="your-turn"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <StatusPill tone="primary" pulse>
                  ¡Tu turno! Elegí un atributo
                </StatusPill>
              </motion.div>
            ) : chosenAttribute ? (
              <motion.div
                key="resolving"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <StatusPill tone="warning">Rival eligió · Resolviendo…</StatusPill>
              </motion.div>
            ) : (
              <motion.div
                key="waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <StatusPill tone="muted">Esperando al rival…</StatusPill>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Carta del rival (reverso) */}
        <div className="px-6 mb-4">
          {opponentCardBack ? (
            <CardBack
              gradient={opponentCardBack.gradient}
              className="w-full max-w-sm mx-auto !aspect-auto h-16 ring-1 ring-white/10"
            />
          ) : (
            <div className="h-16 bg-white/5 rounded-xl mx-auto max-w-sm" />
          )}
        </div>

        {/* Carta propia */}
        <div className="flex-1 px-4 overflow-y-auto pb-24">
          {myCurrentCard ? (
            <PlayerCard
              card={myCurrentCard}
              interactive={isMyTurn && !pickSent}
              selectedAttribute={pickSent ? (chosenAttribute ?? null) : null}
              onPickAttribute={handlePickAttribute}
              className="mx-auto"
            />
          ) : (
            <div className="flex items-center justify-center h-40 text-white/30">
              Cargando carta…
            </div>
          )}
        </div>

        {/* Botón abandonar (sticky bottom) */}
        <div className="fixed bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-[var(--bg-deep)] via-[var(--bg-deep)]/85 to-transparent">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-white/30 hover:text-red-400 hover:bg-red-950/30 text-xs gap-1.5"
            onClick={handleAbandon}
          >
            <LogOut className="size-3" />
            Abandonar partida
          </Button>
        </div>

        {/* Overlay resultado de ronda */}
        {lastResult && myCurrentCard && (
          <RoundResult
            result={lastResult}
            opponentCard={lastResult.revealedOpponentCard}
            iWon={lastResult.winner === "you"}
            visible={phase === "round_result"}
          />
        )}

        {/* Timer de deadline (urgente) */}
        {deadlineAt && isMyTurn && !pickSent && (
          <motion.div
            className="fixed top-24 right-4 z-40"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="rounded-full bg-[rgba(11,16,32,0.85)] backdrop-blur border border-red-500/40 p-1 shadow-xl">
              <MatchTimer endsAt={deadlineAt} totalMs={10_000} />
            </div>
          </motion.div>
        )}
      </div>
    </BrandBackground>
  );
}

function formatMatchEndReason(reason: MatchEndReason): string {
  const labels: Record<MatchEndReason, string> = {
    elimination: "Un jugador se quedó sin cartas",
    time_up: "Fin del tiempo",
    tiebreaker: "Desempate",
    walkover: "Victoria por ausencia del rival",
    abandoned: "Abandono",
    double_disconnect: "Doble desconexión",
  };
  return labels[reason];
}
