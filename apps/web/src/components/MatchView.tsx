"use client";

import { useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AttrKey } from "@campeonato/domain";
import { CLIENT_EVENTS } from "@campeonato/domain";
import { useGameStore } from "@/lib/store";
import { getSocket } from "@/lib/socket";
import { PlayerCard, CardBack } from "./PlayerCard";
import { RoundResult } from "./RoundResult";
import { MatchTimer } from "./MatchTimer";
import { Button } from "@/components/ui/button";

export function MatchView() {
  const store = useGameStore();
  const abandonSentRef = useRef(false);
  const socket = getSocket();

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
    phase,
    lastResult,
    matchResult,
  } = store;

  const isMyTurn = mySlot !== null && chooser === mySlot;
  const isWinner = matchResult?.winnerId === store.playerId;

  const handlePickAttribute = useCallback(
    (attr: AttrKey) => {
      if (!matchId || !roundNumber || pickSent) return;
      store.markPickSent();

      socket.emit(
        CLIENT_EVENTS.MATCH_PICK_ATTRIBUTE,
        { msgId: crypto.randomUUID(), matchId, roundNumber, attribute: attr },
        () => { /* ack received */ },
      );
    },
    [matchId, roundNumber, pickSent, socket, store],
  );

  const handleAbandon = useCallback(() => {
    if (!matchId || abandonSentRef.current) return;
    abandonSentRef.current = true;
    socket.emit(
      CLIENT_EVENTS.MATCH_LEAVE,
      { msgId: crypto.randomUUID(), matchId },
      () => { /* ack received */ },
    );
  }, [matchId, socket]);

  // Cuando el estado de la partida es round_result, volvemos a in_match
  // automáticamente cuando llega el próximo round:started (manejado en store).

  // Reset de abandonSentRef cuando termina la partida
  useEffect(() => {
    if (phase === "match_ended") {
      abandonSentRef.current = false;
    }
  }, [phase]);

  // Pantalla de partida terminada
  if (phase === "match_ended" && matchResult) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0d1117] text-white px-6 text-center gap-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 250 }}
          className="space-y-3"
        >
          <p className="text-white/50 text-xs uppercase tracking-widest">Partida terminada</p>
          <h2
            className={`text-5xl font-black ${isWinner ? "text-emerald-400" : "text-red-400"}`}
          >
            {isWinner ? "¡GANASTE!" : "PERDISTE"}
          </h2>
          <p className="text-white/60 text-sm">
            Razón: {matchResult.reason} · Rondas: {matchResult.stats.roundsPlayed}
          </p>
        </motion.div>
        <div className="flex gap-8 text-center">
          <div>
            <p className="text-white/40 text-[10px] uppercase tracking-widest">Tu mazo</p>
            <p className="text-2xl font-bold">{matchResult.stats.finalDeckSizes[0]}</p>
          </div>
          <div>
            <p className="text-white/40 text-[10px] uppercase tracking-widest">Rival</p>
            <p className="text-2xl font-bold">{matchResult.stats.finalDeckSizes[1]}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0d1117] text-white select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="text-left">
          <p className="text-white/40 text-[10px] uppercase tracking-widest">Rival</p>
          <p className="text-white font-bold text-sm truncate max-w-[140px]">
            {opponent?.name ?? "—"}
          </p>
        </div>

        {endsAt && (
          <MatchTimer endsAt={endsAt} totalMs={120_000} />
        )}

        <div className="text-right">
          <p className="text-white/40 text-[10px] uppercase tracking-widest">Ronda</p>
          <p className="text-white font-bold text-sm">{roundNumber}</p>
        </div>
      </div>

      {/* Contador de mazos */}
      <div className="flex justify-between px-6 pb-3">
        <span className="text-xs text-white/50">
          Tu mazo:{" "}
          <span className="text-white font-bold">{myDeckSize}</span>
        </span>
        <span className="text-xs text-white/50">
          Rival:{" "}
          <span className="text-white font-bold">{opponentDeckSize}</span>
        </span>
      </div>

      {/* Turno */}
      <div className="text-center pb-2">
        {isMyTurn ? (
          <AnimatePresence mode="wait">
            <motion.p
              key="your-turn"
              className="text-emerald-400 text-xs font-bold uppercase tracking-widest"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              ¡Tu turno! Elige un atributo
            </motion.p>
          </AnimatePresence>
        ) : chosenAttribute ? (
          <p className="text-amber-400 text-xs uppercase tracking-widest">
            Rival eligió · Resolviendo…
          </p>
        ) : (
          <p className="text-white/40 text-xs uppercase tracking-widest">
            Esperando al rival…
          </p>
        )}
      </div>

      {/* Carta del rival (reverso) */}
      <div className="px-6 mb-4">
        {opponentCardBack ? (
          <CardBack
            gradient={opponentCardBack.gradient}
            className="w-full max-w-sm mx-auto h-16"
          />
        ) : (
          <div className="h-16 bg-white/5 rounded-xl mx-auto max-w-sm" />
        )}
      </div>

      {/* Carta propia */}
      <div className="flex-1 px-4 overflow-y-auto">
        {myCurrentCard ? (
          <PlayerCard
            card={myCurrentCard}
            interactive={isMyTurn && !pickSent}
            selectedAttribute={pickSent ? (chosenAttribute ?? null) : null}
            onPickAttribute={handlePickAttribute}
          />
        ) : (
          <div className="flex items-center justify-center h-40 text-white/30">
            Cargando…
          </div>
        )}
      </div>

      {/* Botón abandonar */}
      <div className="px-4 py-4">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-white/30 hover:text-red-400 hover:bg-red-950/30 text-xs"
          onClick={handleAbandon}
        >
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

      {/* Timer de deadline */}
      {deadlineAt && isMyTurn && !pickSent && (
        <div className="fixed top-4 right-4 z-40">
          <div className="bg-[#0d1117]/80 rounded-full p-1">
            <MatchTimer endsAt={deadlineAt} totalMs={10_000} />
          </div>
        </div>
      )}
    </div>
  );
}
