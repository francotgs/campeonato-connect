"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Clock } from "lucide-react";
import { CLIENT_EVENTS } from "@campeonato/domain";
import { useGameStore } from "@/lib/store";
import { useSocket } from "@/hooks/useSocket";
import { getSocket, updateSocketAuth } from "@/lib/socket";
import { DeckPreview } from "@/components/DeckPreview";
import { MatchView } from "@/components/MatchView";
import { WaitingScreen } from "@/components/WaitingScreen";
import { Button } from "@/components/ui/button";

// =============================================================================
// Pantalla: Lobby (esperando que el admin inicie)
// =============================================================================
function LobbyScreen() {
  const store = useGameStore();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0d1117] px-6 text-center gap-8">
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mx-auto size-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
          <Trophy className="size-10 text-emerald-400" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white">
            ¡Estás inscripto!
          </h2>
          <p className="text-white/50 text-sm mt-1">
            Hola, <span className="text-white">{store.playerName}</span>
          </p>
        </div>
        {store.tournament && (
          <div className="bg-white/5 rounded-2xl px-6 py-4 space-y-1">
            <p className="text-white/40 text-xs uppercase tracking-widest">Torneo</p>
            <p className="text-white font-bold">{store.tournament.name}</p>
            <p className="text-white/50 text-sm">
              {store.playersCount} jugador
              {store.playersCount !== 1 ? "es" : ""} inscripto
              {store.playersCount !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </motion.div>

      {/* Spinner de espera */}
      <div className="space-y-2 text-center">
        <motion.div
          className="mx-auto size-10 rounded-full border-2 border-emerald-400/30 border-t-emerald-400"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
        <p className="text-white/40 text-xs">
          Esperando que el organizador inicie el torneo…
        </p>
      </div>

      {/* Botón salir */}
      <Button
        variant="ghost"
        size="sm"
        className="text-white/20 hover:text-white/50 text-xs"
        onClick={() => {
          store.clearAuth();
          window.location.href = "/";
        }}
      >
        Salir
      </Button>
    </div>
  );
}

// =============================================================================
// Pantalla: Esperando próximo rival
// =============================================================================
function WaitingNextScreen() {
  const store = useGameStore();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0d1117] text-white px-6 text-center gap-8">
      <motion.div
        className="space-y-3"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="mx-auto size-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Trophy className="size-10 text-emerald-400" />
        </div>
        <h2 className="text-3xl font-black text-emerald-400">¡Pasaste!</h2>
        <p className="text-white/60 text-sm">
          Esperando al próximo rival…
        </p>
        {store.tournament && (
          <p className="text-white/40 text-xs">{store.tournament.name}</p>
        )}
      </motion.div>
      <motion.div
        className="size-12 rounded-full border-2 border-emerald-400/30 border-t-emerald-400"
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

// =============================================================================
// Pantalla: Eliminado
// =============================================================================
function EliminatedScreen() {
  const store = useGameStore();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0d1117] text-white px-6 text-center gap-6">
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-6xl">😞</div>
        <h2 className="text-3xl font-black text-red-400">Eliminado</h2>
        <p className="text-white/60 text-sm">
          Quedaste en la posición{" "}
          <span className="text-white font-bold">{store.finalPosition ?? "?"}</span>
        </p>
        <p className="text-white/40 text-xs">
          ¡Gracias por participar!
        </p>
      </motion.div>
      <Button
        variant="ghost"
        className="text-white/30 hover:text-white/60"
        onClick={() => {
          store.clearAuth();
          window.location.href = "/";
        }}
      >
        Volver al inicio
      </Button>
    </div>
  );
}

// =============================================================================
// Pantalla: Campeón
// =============================================================================
function ChampionScreen() {
  const store = useGameStore();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0d1117] text-white px-6 text-center gap-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-radial from-yellow-500/10 to-transparent" />

      <motion.div
        className="relative space-y-4"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        <div className="text-8xl">🏆</div>
        <h2 className="text-4xl font-black text-yellow-400">¡CAMPEÓN!</h2>
        <p className="text-white/70 text-lg font-bold">
          {store.playerName}
        </p>
        <p className="text-white/40 text-sm">
          {store.tournament?.name ?? "Campeonato MundIAl 4Match"}
        </p>
      </motion.div>
    </div>
  );
}

// =============================================================================
// Pantalla: Cuenta regresiva antes de empezar
// =============================================================================
function CountdownToStart({ startsAt }: { startsAt: number }) {
  const remaining = Math.max(0, Math.ceil((startsAt - Date.now()) / 1000));
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0d1117] text-white gap-6">
      <motion.div
        className="space-y-2 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <p className="text-white/40 text-xs uppercase tracking-widest">
          La partida empieza en
        </p>
        <motion.div
          key={remaining}
          className="text-[120px] font-black text-emerald-400 leading-none"
          initial={{ scale: 1.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {remaining}
        </motion.div>
      </motion.div>
    </div>
  );
}

// =============================================================================
// Pantalla: Error de conexión
// =============================================================================
function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0d1117] text-white px-6 text-center gap-4">
      <div className="text-4xl">⚠️</div>
      <h2 className="text-xl font-bold text-red-400">Error de conexión</h2>
      <p className="text-white/60 text-sm">{message}</p>
      <Button
        variant="ghost"
        className="text-white/40 hover:text-white"
        onClick={() => window.location.reload()}
      >
        Reintentar
      </Button>
    </div>
  );
}

// =============================================================================
// Página principal /play
// =============================================================================
export default function PlayPage() {
  const router = useRouter();
  const store = useGameStore();
  const socket = useSocket();

  // Restaurar auth desde localStorage al montar
  useEffect(() => {
    const savedToken = localStorage.getItem("4match:token");
    const savedPlayerId = localStorage.getItem("4match:playerId");
    const savedTid = localStorage.getItem("4match:tournamentId");
    const savedName = localStorage.getItem("4match:playerName");

    if (!savedToken || !savedPlayerId || !savedTid) {
      // Sin sesión → redirigir a join
      const tid = savedTid ?? "t-default";
      router.replace(`/join/${tid}`);
      return;
    }

    // Actualizar store si no tiene datos
    if (!store.token) {
      store.setAuth(savedPlayerId, savedToken, savedTid, savedName ?? "");
    }

    // Conectar socket con el token guardado
    updateSocketAuth(savedToken);

    // Intentar reconectar al match si corresponde
    if (socket.connected) {
      socket.emit(
        CLIENT_EVENTS.PLAYER_RECONNECT,
        { msgId: crypto.randomUUID(), token: savedToken },
        (ack: { ok: boolean }) => {
          if (!ack.ok) {
            // Token inválido → forzar re-join
            store.clearAuth();
            router.replace(`/join/${savedTid}`);
          }
        },
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { phase, myCards, opponent, startsAt, socketError } = store;

  // Error de conexión crítico
  if (socketError && phase === "idle") {
    return <ErrorScreen message={socketError} />;
  }

  return (
    <AnimatePresence mode="wait">
      {phase === "idle" || phase === "lobby" ? (
        <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <LobbyScreen />
        </motion.div>
      ) : phase === "previewing" && myCards.length > 0 && opponent ? (
        <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <DeckPreview
            cards={myCards}
            opponentName={opponent.name}
            startsAt={startsAt ?? Date.now() + 3000}
            onReady={() => {
              socket.emit(CLIENT_EVENTS.PLAYER_READY, { msgId: crypto.randomUUID() });
            }}
          />
        </motion.div>
      ) : phase === "waiting_start" && startsAt ? (
        <motion.div key="countdown" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <CountdownToStart startsAt={startsAt} />
        </motion.div>
      ) : phase === "in_match" || phase === "round_result" || phase === "tiebreaker" || phase === "match_ended" ? (
        <motion.div key="match" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <MatchView />
        </motion.div>
      ) : phase === "waiting_next" ? (
        <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <WaitingNextScreen />
        </motion.div>
      ) : phase === "eliminated" ? (
        <motion.div key="eliminated" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <EliminatedScreen />
        </motion.div>
      ) : phase === "champion" ? (
        <motion.div key="champion" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <ChampionScreen />
        </motion.div>
      ) : (
        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <WaitingScreen title="Cargando…" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
