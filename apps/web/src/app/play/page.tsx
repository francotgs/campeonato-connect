"use client";

import { DeckPreview } from "@/components/DeckPreview";
import { MatchView } from "@/components/MatchView";
import { WaitingScreen } from "@/components/WaitingScreen";
import { BrandBackground, BrandLogo, BrandSpinner, Panel } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useSocket } from "@/hooks/useSocket";
import { updateSocketAuth } from "@/lib/socket";
import { useGameStore } from "@/lib/store";
import { CLIENT_EVENTS } from "@campeonato/domain";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  LogOut,
  MousePointerClick,
  Repeat2,
  Scale,
  ShieldCheck,
  Trophy,
  UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// =============================================================================
// LobbyScreen — inscripto, esperando inicio
// =============================================================================
function LobbyScreen() {
  const store = useGameStore();
  return (
    <BrandBackground>
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-8">
        <motion.div
          className="w-full max-w-sm space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex flex-col items-center gap-4">
            <motion.div
              className="relative size-20 rounded-3xl bg-emerald-500/15 ring-1 ring-emerald-400/30 flex items-center justify-center"
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
              <CheckCircle2 className="size-10 text-emerald-400" strokeWidth={1.75} />
            </motion.div>
            <div>
              <h2 className="text-3xl font-black text-white">¡Estás inscripto!</h2>
              <p className="text-white/50 text-sm mt-1">
                Hola, <span className="text-white font-bold">{store.playerName}</span>
              </p>
            </div>
          </div>

          {store.tournament && (
            <Panel className="px-6 py-4 space-y-1">
              <p className="text-white/40 text-[10px] uppercase tracking-widest">Torneo</p>
              <p className="text-white font-bold">{store.tournament.name}</p>
              <p className="text-white/50 text-xs">
                {store.playersCount} jugador{store.playersCount !== 1 ? "es" : ""} inscripto
                {store.playersCount !== 1 ? "s" : ""}
              </p>
            </Panel>
          )}
        </motion.div>

        <div className="flex flex-col items-center gap-3">
          <BrandSpinner size={44} />
          <p className="text-white/45 text-xs uppercase tracking-widest">
            Esperando que inicie el torneo…
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-white/30 hover:text-white/60 hover:bg-white/5 text-xs gap-1.5"
          onClick={() => {
            store.clearAuth();
            window.location.href = "/";
          }}
        >
          <LogOut className="size-3" />
          Salir del torneo
        </Button>
      </div>
    </BrandBackground>
  );
}

// =============================================================================
// WaitingNextScreen — pasaste, esperando rival de la próxima ronda
// =============================================================================
function WaitingNextScreen() {
  const store = useGameStore();
  return (
    <BrandBackground>
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-8">
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            className="mx-auto size-24 rounded-full bg-emerald-500/15 ring-2 ring-emerald-400/30 flex items-center justify-center"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          >
            <Trophy className="size-12 text-emerald-400" strokeWidth={1.75} />
          </motion.div>
          <h2 className="text-4xl font-black text-emerald-400">¡Pasaste de ronda!</h2>
          <p className="text-white/70 text-base">Esperando al próximo rival…</p>
          {store.tournament && <p className="text-white/40 text-xs">{store.tournament.name}</p>}
        </motion.div>
        <BrandSpinner size={48} />
      </div>
    </BrandBackground>
  );
}

// =============================================================================
// InstructionsScreen — explicación breve antes del primer preview
// =============================================================================
function InstructionsScreen() {
  const store = useGameStore();
  const opponentName = store.opponent?.name ?? "tu rival";

  const steps = [
    {
      icon: UsersRound,
      title: "Carta contra carta",
      text: "Cada ronda compara tu carta actual contra la del rival.",
    },
    {
      icon: MousePointerClick,
      title: "Elegí una habilidad",
      text: "Cuando sea tu turno, tocá el atributo que más te convenga.",
    },
    {
      icon: Scale,
      title: "Gana el número más alto",
      text: "El valor elegido se compara en ambas cartas. El ganador se queda con las dos.",
    },
    {
      icon: Repeat2,
      title: "El ganador elige después",
      text: "Quien gana una ronda decide la habilidad de la siguiente.",
    },
  ];

  return (
    <BrandBackground variant="subtle">
      <div className="flex min-h-screen items-center justify-center px-5 py-8">
        <motion.div
          className="w-full max-w-sm space-y-5"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="text-center space-y-3">
            <div className="mx-auto size-16 rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-400/30 flex items-center justify-center">
              <ShieldCheck className="size-8 text-emerald-300" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-emerald-300 text-[10px] font-black uppercase tracking-[0.3em]">
                Antes de empezar
              </p>
              <h2 className="mt-2 text-3xl font-black text-white">Cómo se juega</h2>
              <p className="mt-1 text-sm text-white/55">Próxima partida vs {opponentName}</p>
            </div>
          </div>

          <Panel className="p-4 space-y-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="flex gap-3 text-left">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/10">
                    <Icon className="size-4 text-emerald-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white">
                      {index + 1}. {step.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-white/55">{step.text}</p>
                  </div>
                </div>
              );
            })}
          </Panel>

          <Button
            size="lg"
            className="h-12 w-full bg-emerald-500 text-base font-black text-black hover:bg-emerald-400 gap-2"
            onClick={store.continueFromInstructions}
          >
            Continuar al mazo
            <ArrowRight className="size-4" />
          </Button>

          <p className="text-center text-xs text-white/40">
            Después vas a revisar tus cartas antes del inicio.
          </p>
        </motion.div>
      </div>
    </BrandBackground>
  );
}

// =============================================================================
// EliminatedScreen — quedaste fuera del torneo
// =============================================================================
function EliminatedScreen() {
  const store = useGameStore();
  return (
    <BrandBackground variant="subtle">
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-6">
        <motion.div
          className="w-full max-w-xs space-y-5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mx-auto size-20 rounded-3xl bg-red-500/10 ring-1 ring-red-500/30 flex items-center justify-center">
            <span className="text-4xl">😞</span>
          </div>
          <div>
            <h2 className="text-3xl font-black text-red-400">Eliminado</h2>
            <p className="text-white/60 text-sm mt-2">
              Quedaste en la posición{" "}
              <span className="text-white font-bold text-base">#{store.finalPosition ?? "?"}</span>
            </p>
          </div>
          <Panel className="px-5 py-4">
            <p className="text-white/70 text-sm">¡Gracias por participar, {store.playerName}!</p>
            <p className="text-white/40 text-xs mt-1">
              Podés ver cómo sigue el torneo en la pantalla proyectable.
            </p>
          </Panel>
        </motion.div>
        <Button
          variant="ghost"
          className="text-white/40 hover:text-white hover:bg-white/5 gap-2"
          onClick={() => {
            store.clearAuth();
            window.location.href = "/";
          }}
        >
          <LogOut className="size-4" />
          Volver al inicio
        </Button>
      </div>
    </BrandBackground>
  );
}

// =============================================================================
// ChampionScreen — ganaste el torneo 🏆
// =============================================================================
function ChampionScreen() {
  const store = useGameStore();
  return (
    <BrandBackground variant="celebrate">
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-6 relative">
        <motion.div
          className="relative space-y-5"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <motion.div
            className="mx-auto"
            animate={{ rotate: [-2, 2, -2], y: [0, -4, 0] }}
            transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
          >
            <div className="text-8xl drop-shadow-[0_0_30px_rgba(251,191,36,0.7)]">🏆</div>
          </motion.div>
          <div>
            <p className="text-amber-300/80 text-xs font-bold uppercase tracking-[0.3em]">
              Ganador del Campeonato
            </p>
            <h2 className="text-5xl font-black text-amber-400 mt-2">¡CAMPEÓN!</h2>
          </div>
          <Panel className="px-6 py-4 border-amber-400/30 bg-amber-500/5">
            <p className="text-white/50 text-[10px] uppercase tracking-widest">Este es tu logro</p>
            <p className="text-white text-2xl font-black mt-1">{store.playerName}</p>
            <p className="text-amber-300/70 text-sm mt-1">
              {store.tournament?.name ?? "Campeonato MundIAl 4Match"}
            </p>
          </Panel>
        </motion.div>
      </div>
    </BrandBackground>
  );
}

// =============================================================================
// CountdownToStart — cuenta regresiva breve antes del pitido inicial
// =============================================================================
function CountdownToStart({ startsAt }: { startsAt: number }) {
  const remaining = Math.max(0, Math.ceil((startsAt - Date.now()) / 1000));
  return (
    <BrandBackground>
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <motion.div
          className="space-y-3 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-white/50 text-xs uppercase tracking-[0.3em] font-bold">
            La partida empieza en
          </p>
          <motion.div
            key={remaining}
            className="text-[140px] font-black text-emerald-400 leading-none drop-shadow-[0_0_40px_rgba(16,185,129,0.5)]"
            initial={{ scale: 1.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {remaining}
          </motion.div>
        </motion.div>
      </div>
    </BrandBackground>
  );
}

// =============================================================================
// ErrorScreen — caída de socket o problema de sesión
// =============================================================================
function ErrorScreen({ message }: { message: string }) {
  return (
    <BrandBackground variant="subtle">
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-5">
        <motion.div
          className="w-full max-w-xs space-y-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mx-auto size-16 rounded-2xl bg-red-500/15 ring-1 ring-red-500/30 flex items-center justify-center">
            <AlertTriangle className="size-8 text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-black text-red-400">Error de conexión</h2>
            <p className="text-white/60 text-sm mt-2">{message}</p>
          </div>
        </motion.div>
        <Button
          className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
          onClick={() => window.location.reload()}
        >
          Reintentar
        </Button>
      </div>
    </BrandBackground>
  );
}

// =============================================================================
// Page principal /play
// =============================================================================
export default function PlayPage() {
  const router = useRouter();
  const store = useGameStore();
  const socket = useSocket();

  useEffect(() => {
    const savedToken = localStorage.getItem("4match:token");
    const savedPlayerId = localStorage.getItem("4match:playerId");
    const savedTid = localStorage.getItem("4match:tournamentId");
    const savedName = localStorage.getItem("4match:playerName");
    const savedMode = localStorage.getItem("4match:sessionMode");

    if (!savedToken || !savedPlayerId || !savedTid) {
      const tid = savedTid ?? "t-default";
      router.replace(`/join/${tid}`);
      return;
    }

    if (!store.token) {
      store.setAuth(
        savedPlayerId,
        savedToken,
        savedTid,
        savedName ?? "",
        savedMode === "practice" ? "practice" : "tournament",
      );
    }

    updateSocketAuth(savedToken);

    if (socket.connected) {
      socket.emit(
        CLIENT_EVENTS.PLAYER_RECONNECT,
        { msgId: crypto.randomUUID(), token: savedToken },
        (ack: { ok: boolean }) => {
          if (!ack.ok) {
            store.clearAuth();
            router.replace(`/join/${savedTid}`);
          }
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { phase, myCards, opponent, startsAt, socketError } = store;

  if (socketError && phase === "idle") {
    return <ErrorScreen message={socketError} />;
  }

  const transition = {
    duration: 0.35,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  };

  return (
    <AnimatePresence mode="wait">
      {phase === "idle" || phase === "lobby" ? (
        <motion.div
          key="lobby"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
        >
          <LobbyScreen />
        </motion.div>
      ) : phase === "instructions" && myCards.length > 0 && opponent ? (
        <motion.div
          key="instructions"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
        >
          <InstructionsScreen />
        </motion.div>
      ) : phase === "previewing" && myCards.length > 0 && opponent ? (
        <motion.div
          key="preview"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
        >
          <DeckPreview
            cards={myCards}
            opponentName={opponent.name}
            startsAt={startsAt ?? Date.now() + 20000}
            onReady={() => {
              socket.emit(CLIENT_EVENTS.PLAYER_READY, { msgId: crypto.randomUUID() });
            }}
          />
        </motion.div>
      ) : phase === "waiting_start" && startsAt ? (
        <motion.div
          key="countdown"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
        >
          <CountdownToStart startsAt={startsAt} />
        </motion.div>
      ) : phase === "in_match" ||
        phase === "round_result" ||
        phase === "tiebreaker" ||
        phase === "match_ended" ? (
        <motion.div
          key="match"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
        >
          <MatchView />
        </motion.div>
      ) : phase === "waiting_next" ? (
        <motion.div
          key="waiting"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
        >
          <WaitingNextScreen />
        </motion.div>
      ) : phase === "eliminated" ? (
        <motion.div
          key="eliminated"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
        >
          <EliminatedScreen />
        </motion.div>
      ) : phase === "champion" ? (
        <motion.div
          key="champion"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
        >
          <ChampionScreen />
        </motion.div>
      ) : (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
        >
          <BrandBackground>
            <div className="flex items-center justify-center min-h-screen">
              <div className="flex flex-col items-center gap-4">
                <BrandLogo size="lg" orientation="vertical" />
                <BrandSpinner size={40} />
                <p className="text-white/50 text-xs uppercase tracking-widest">Cargando…</p>
              </div>
            </div>
          </BrandBackground>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
