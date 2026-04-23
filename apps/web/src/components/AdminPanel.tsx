"use client";

import { cn } from "@/lib/utils";
import type { Bracket, BracketUpdatedEvent, TournamentStateEvent } from "@campeonato/domain";
import { CLIENT_EVENTS, SERVER_EVENTS } from "@campeonato/domain";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Shield,
  Trophy,
  Users,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { type Socket, io } from "socket.io-client";
import { BrandBackground, BrandLogo, Panel, StatusPill } from "./brand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TournamentStatus = "registration_open" | "running" | "finished" | "paused";

type AdminState = {
  connected: boolean;
  authError: string | null;
  tournamentName: string;
  status: TournamentStatus | null;
  playersCount: number;
  bracketSize: number;
  currentRound: number;
  liveMatches: number;
  cupoMax: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<TournamentStatus, string> = {
  registration_open: "Inscripción abierta",
  running: "En curso",
  paused: "Pausado",
  finished: "Finalizado",
};

const STATUS_TONE: Record<TournamentStatus, "primary" | "live" | "gold" | "muted" | "warning"> = {
  registration_open: "primary",
  running: "live",
  paused: "warning",
  finished: "gold",
};

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Panel
      className={cn(
        "flex flex-col gap-2 p-4 transition-all",
        highlight && "border-emerald-500/40 bg-[rgba(6,78,59,0.3)] glow-primary",
      )}
    >
      <div className="flex items-center gap-2 text-white/50 text-[10px] uppercase tracking-[0.2em] font-bold">
        {icon}
        {label}
      </div>
      <p className="text-3xl font-black text-white tabular-nums leading-none">{value}</p>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// ActionButton
// ---------------------------------------------------------------------------

function ActionButton({
  label,
  icon,
  onClick,
  variant = "default",
  disabled,
  loading,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "primary" | "warning" | "danger";
  disabled?: boolean;
  loading?: boolean;
}) {
  const styles = {
    default: "bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20 text-white",
    primary: "bg-emerald-500 hover:bg-emerald-400 border-emerald-400 text-black",
    warning: "bg-amber-500 hover:bg-amber-400 border-amber-400 text-black",
    danger: "bg-red-500/90 hover:bg-red-500 border-red-500/60 text-white",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "flex items-center gap-2 px-5 py-3 rounded-xl border font-bold text-sm",
        "transition-all duration-150 active:scale-[0.97]",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
        "shadow-lg",
        styles[variant],
      )}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ResetConfirmDialog
// ---------------------------------------------------------------------------

function ResetConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-[var(--bg-elevated)] border border-red-500/40 rounded-2xl p-7 max-w-sm w-full shadow-2xl"
        initial={{ scale: 0.9, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 16 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-full bg-red-500/15 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <h2 className="text-lg font-black text-white">Confirmar reset</h2>
        </div>
        <p className="text-white/60 text-sm mb-6 leading-relaxed">
          Esto eliminará todos los jugadores, partidas y el bracket actual. El torneo volverá al
          estado de inscripción. Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/80 hover:bg-white/5 transition-colors text-sm font-bold"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white transition-colors text-sm font-black"
          >
            Sí, resetear
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// QrBlock
// ---------------------------------------------------------------------------

function QrBlock({ url, label }: { url: string; label: string }) {
  return (
    <Panel className="flex flex-col items-center gap-3 p-5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-bold">{label}</p>
      <div className="p-3 bg-white rounded-xl">
        <QRCodeSVG value={url} size={144} />
      </div>
      <p className="text-[10px] text-white/40 text-center break-all max-w-[160px] font-mono">
        {url}
      </p>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// AdminPanel
// ---------------------------------------------------------------------------

type Props = {
  token: string;
};

export function AdminPanel({ token }: Props) {
  const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";
  const TID = process.env.NEXT_PUBLIC_TOURNAMENT_ID ?? "t-default";

  const [state, setState] = useState<AdminState>({
    connected: false,
    authError: null,
    tournamentName: "Campeonato",
    status: null,
    playersCount: 0,
    bracketSize: 0,
    currentRound: 0,
    liveMatches: 0,
    cupoMax: 256,
  });

  const [loading, setLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  const toast = (ok: boolean, msg: string) => {
    setFeedback({ ok, msg });
    setTimeout(() => setFeedback(null), 3000);
  };

  const emit = (event: string, extra?: Record<string, unknown>): Promise<unknown> =>
    new Promise((resolve) => {
      socketRef.current?.emit(
        event,
        { msgId: crypto.randomUUID(), tournamentId: TID, ...extra },
        resolve,
      );
    });

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { mode: "admin", token, tournamentId: TID },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 20,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => setState((s) => ({ ...s, connected: true, authError: null })));
    socket.on("disconnect", () => setState((s) => ({ ...s, connected: false })));

    socket.on(SERVER_EVENTS.ERROR, (err: { code: string; message: string }) => {
      if (err.code === "UNAUTHORIZED") {
        setState((s) => ({
          ...s,
          authError: "Token inválido. Verificá la URL del panel.",
          connected: false,
        }));
        socket.disconnect();
      }
    });

    socket.on(SERVER_EVENTS.TOURNAMENT_STATE, (evt: TournamentStateEvent) => {
      setState((s) => ({
        ...s,
        tournamentName: evt.tournament.name,
        status: evt.tournament.status as TournamentStatus,
        playersCount: evt.playersCount ?? s.playersCount,
        cupoMax: evt.tournament.cupoMax,
      }));
    });

    socket.on(SERVER_EVENTS.BRACKET_UPDATED, (evt: BracketUpdatedEvent) => {
      const liveMatches =
        evt.bracket.rounds[evt.round]?.matches.filter((m) => m.status === "live").length ?? 0;
      setState((s) => ({
        ...s,
        bracketSize: evt.bracket.size,
        currentRound: evt.round,
        liveMatches,
      }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [SOCKET_URL, TID, token]);

  const handleOpenRegistration = async () => {
    setLoading("open");
    const ack = (await emit(CLIENT_EVENTS.ADMIN_OPEN_REGISTRATION)) as { ok: boolean };
    setLoading(null);
    toast(ack?.ok, ack?.ok ? "Inscripción abierta" : "Error al abrir inscripción");
  };

  const handleStart = async () => {
    setLoading("start");
    const ack = (await emit(CLIENT_EVENTS.ADMIN_START_TOURNAMENT)) as { ok: boolean };
    setLoading(null);
    toast(ack?.ok, ack?.ok ? "Torneo iniciado" : "Error al iniciar torneo");
  };

  const handlePause = async () => {
    setLoading("pause");
    const ack = (await emit(CLIENT_EVENTS.ADMIN_PAUSE)) as { ok: boolean };
    setLoading(null);
    toast(ack?.ok, ack?.ok ? "Torneo pausado" : "Error al pausar");
  };

  const handleResume = async () => {
    setLoading("resume");
    const ack = (await emit(CLIENT_EVENTS.ADMIN_RESUME)) as { ok: boolean };
    setLoading(null);
    toast(ack?.ok, ack?.ok ? "Torneo reanudado" : "Error al reanudar");
  };

  const handleReset = async () => {
    setShowResetConfirm(false);
    setLoading("reset");
    const ack = (await emit(CLIENT_EVENTS.ADMIN_RESET)) as { ok: boolean };
    setLoading(null);
    toast(ack?.ok, ack?.ok ? "Torneo reseteado" : "Error al resetear");
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const joinUrl = `${origin}/join/${TID}`;
  const bracketUrl = `${origin}/bracket/${TID}`;

  if (state.authError) {
    return (
      <BrandBackground variant="subtle">
        <div className="flex min-h-screen items-center justify-center flex-col gap-4 px-6 text-center">
          <div className="size-16 rounded-2xl bg-red-500/15 flex items-center justify-center">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-red-400 text-xl font-black">{state.authError}</h1>
          <p className="text-white/50 text-sm max-w-xs">
            URL esperada:{" "}
            <code className="text-white/80 font-mono text-xs">
              {origin}/admin/&lt;ADMIN_TOKEN&gt;
            </code>
          </p>
        </div>
      </BrandBackground>
    );
  }

  const { status, connected } = state;
  const totalRounds = state.bracketSize > 0 ? Math.log2(state.bracketSize) : 0;

  return (
    <BrandBackground>
      <div className="min-h-screen p-5 sm:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" tone="gold" />
            <div className="h-9 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-300 uppercase tracking-[0.25em] font-black">
                Panel admin
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-default">
            {connected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-300 font-bold">Conectado</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs text-red-400 font-bold">Reconectando…</span>
              </>
            )}
          </div>
        </header>

        {/* Tournament title + status */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-bold">
              Torneo
            </p>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              {state.tournamentName}
            </h2>
          </div>
          {status && (
            <StatusPill tone={STATUS_TONE[status]} pulse={status === "running"}>
              {STATUS_LABEL[status]}
            </StatusPill>
          )}
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard
            label="Jugadores"
            value={state.playersCount}
            icon={<Users className="w-3.5 h-3.5" />}
          />
          <StatCard
            label="Partidas activas"
            value={state.liveMatches}
            icon={<Zap className="w-3.5 h-3.5" />}
            highlight={state.liveMatches > 0}
          />
          <StatCard
            label="Ronda"
            value={totalRounds > 0 ? `${state.currentRound + 1} / ${totalRounds}` : "—"}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          />
          <StatCard
            label="Bracket"
            value={state.bracketSize > 0 ? state.bracketSize : "—"}
            icon={<Trophy className="w-3.5 h-3.5" />}
          />
        </div>

        {/* Controls */}
        <section className="mb-8">
          <h3 className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-bold mb-3">
            Controles
          </h3>
          <div className="flex flex-wrap gap-3">
            {(status === "paused" || status === "finished") && (
              <ActionButton
                label="Abrir inscripción"
                icon={<Users className="w-4 h-4" />}
                onClick={handleOpenRegistration}
                loading={loading === "open"}
                disabled={!!loading}
              />
            )}

            {status === "registration_open" && (
              <ActionButton
                label="Iniciar torneo"
                icon={<Play className="w-4 h-4" />}
                onClick={handleStart}
                variant="primary"
                loading={loading === "start"}
                disabled={!!loading || state.playersCount < 1}
              />
            )}

            {status === "running" && (
              <ActionButton
                label="Pausar"
                icon={<Pause className="w-4 h-4" />}
                onClick={handlePause}
                variant="warning"
                loading={loading === "pause"}
                disabled={!!loading}
              />
            )}

            {status === "paused" && (
              <ActionButton
                label="Reanudar"
                icon={<Play className="w-4 h-4" />}
                onClick={handleResume}
                variant="primary"
                loading={loading === "resume"}
                disabled={!!loading}
              />
            )}

            <ActionButton
              label="Reset"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={() => setShowResetConfirm(true)}
              variant="danger"
              disabled={!!loading}
            />
          </div>

          {status === "registration_open" && state.playersCount < 1 && (
            <p className="mt-3 text-xs text-amber-300 inline-flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Necesitás al menos 1 jugador inscripto para iniciar.
            </p>
          )}
        </section>

        {/* QR codes */}
        <section>
          <h3 className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-bold mb-3">
            Códigos QR
          </h3>
          <div className="flex flex-wrap gap-4">
            <QrBlock url={joinUrl} label="Unirse al torneo" />
            <QrBlock url={bracketUrl} label="Ver bracket" />
          </div>
        </section>

        {/* Toast */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              className={cn(
                "fixed bottom-6 right-6 left-6 sm:left-auto flex items-center gap-2 px-4 py-3 rounded-xl border shadow-2xl text-sm font-bold backdrop-blur-md",
                feedback.ok
                  ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-200"
                  : "bg-red-500/15 border-red-500/50 text-red-200",
              )}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
            >
              {feedback.ok ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              {feedback.msg}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showResetConfirm && (
            <ResetConfirmDialog
              onConfirm={handleReset}
              onCancel={() => setShowResetConfirm(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </BrandBackground>
  );
}
