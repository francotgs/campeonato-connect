"use client";

import type { Bracket, BracketUpdatedEvent, TournamentStateEvent } from "@campeonato/domain";
import { CLIENT_EVENTS, SERVER_EVENTS } from "@campeonato/domain";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle,
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

const STATUS_COLOR: Record<TournamentStatus, string> = {
  registration_open: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  running: "bg-green-500/20 text-green-300 border-green-500/40",
  paused: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  finished: "bg-purple-500/20 text-purple-300 border-purple-500/40",
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
    <div
      className={[
        "flex flex-col gap-2 p-4 rounded-xl border transition-all",
        highlight ? "border-green-500/40 bg-green-950/30" : "border-gray-700/50 bg-gray-900/60",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-widest">
        {icon}
        {label}
      </div>
      <p className="text-3xl font-black text-white tabular-nums">{value}</p>
    </div>
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
  variant?: "default" | "success" | "warning" | "danger";
  disabled?: boolean;
  loading?: boolean;
}) {
  const colors = {
    default: "bg-gray-700 hover:bg-gray-600 border-gray-600",
    success: "bg-green-700 hover:bg-green-600 border-green-600",
    warning: "bg-yellow-700 hover:bg-yellow-600 border-yellow-600",
    danger: "bg-red-800 hover:bg-red-700 border-red-700",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={[
        "flex items-center gap-2 px-5 py-3 rounded-lg border font-semibold text-sm",
        "transition-all duration-150 active:scale-95",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
        colors[variant],
      ].join(" ")}
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-gray-900 border border-red-700/50 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          <h2 className="text-lg font-bold text-white">Confirmar Reset</h2>
        </div>
        <p className="text-gray-400 text-sm mb-6">
          Esto eliminará todos los jugadores, partidas y el bracket actual. El torneo volverá al
          estado de inscripción. Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors text-sm font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg bg-red-700 hover:bg-red-600 text-white transition-colors text-sm font-semibold"
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
    <div className="flex flex-col items-center gap-3 p-5 rounded-xl border border-gray-700/50 bg-gray-900/60">
      <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">{label}</p>
      <div className="p-3 bg-white rounded-xl">
        <QRCodeSVG value={url} size={140} />
      </div>
      <p className="text-[11px] text-gray-500 text-center break-all max-w-[160px]">{url}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminPanel — main export
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

  // Show temporary feedback toast
  const toast = (ok: boolean, msg: string) => {
    setFeedback({ ok, msg });
    setTimeout(() => setFeedback(null), 3000);
  };

  // Emit admin command with UUID msgId
  const emit = (event: string, extra?: Record<string, unknown>): Promise<unknown> =>
    new Promise((resolve) => {
      socketRef.current?.emit(
        event,
        { msgId: crypto.randomUUID(), tournamentId: TID, ...extra },
        resolve,
      );
    });

  // ------------------------------------------------------------------
  // Socket setup
  // ------------------------------------------------------------------
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
          authError: "Token inválido. Verificá la URL.",
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

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // Derived URLs for QR
  // ------------------------------------------------------------------
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const joinUrl = `${origin}/join/${TID}`;
  const bracketUrl = `${origin}/bracket/${TID}`;

  // ------------------------------------------------------------------
  // Auth error screen
  // ------------------------------------------------------------------
  if (state.authError) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4">
        <Shield className="w-12 h-12 text-red-400" />
        <p className="text-red-400 text-lg font-bold">{state.authError}</p>
        <p className="text-gray-500 text-sm">
          URL esperada:{" "}
          <code className="text-gray-300">
            {origin}/admin/{"<ADMIN_TOKEN>"}
          </code>
        </p>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  const { status, connected } = state;
  const totalRounds = state.bracketSize > 0 ? Math.log2(state.bracketSize) : 0;

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-yellow-400" />
          <div>
            <h1 className="text-xl font-black text-white leading-none">{state.tournamentName}</h1>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">
              Panel de administración
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <>
              <Wifi className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-400 font-semibold">Conectado</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-400 font-semibold">Reconectando…</span>
            </>
          )}
        </div>
      </header>

      {/* Status badge */}
      {status && (
        <div className="mb-6">
          <span
            className={[
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-widest",
              STATUS_COLOR[status],
            ].join(" ")}
          >
            {status === "running" && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
            )}
            {STATUS_LABEL[status]}
          </span>
        </div>
      )}

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

      {/* Action buttons */}
      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-3">
          Controles
        </h2>
        <div className="flex flex-wrap gap-3">
          {/* Open registration — shown when paused or finished */}
          {(status === "paused" || status === "finished") && (
            <ActionButton
              label="Abrir inscripción"
              icon={<Users className="w-4 h-4" />}
              onClick={handleOpenRegistration}
              loading={loading === "open"}
              disabled={!!loading}
            />
          )}

          {/* Start — only when registration is open */}
          {status === "registration_open" && (
            <ActionButton
              label="Iniciar torneo"
              icon={<Play className="w-4 h-4" />}
              onClick={handleStart}
              variant="success"
              loading={loading === "start"}
              disabled={!!loading || state.playersCount < 1}
            />
          )}

          {/* Pause — only when running */}
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

          {/* Resume — only when paused */}
          {status === "paused" && (
            <ActionButton
              label="Reanudar"
              icon={<Play className="w-4 h-4" />}
              onClick={handleResume}
              variant="success"
              loading={loading === "resume"}
              disabled={!!loading}
            />
          )}

          {/* Reset — always available */}
          <ActionButton
            label="Reset"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={() => setShowResetConfirm(true)}
            variant="danger"
            disabled={!!loading}
          />
        </div>

        {/* Hint for start button when no players */}
        {status === "registration_open" && state.playersCount < 1 && (
          <p className="mt-2 text-xs text-yellow-500">
            Necesitás al menos 1 jugador inscripto para iniciar.
          </p>
        )}
      </section>

      {/* QR codes */}
      <section>
        <h2 className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-3">
          Códigos QR
        </h2>
        <div className="flex flex-wrap gap-4">
          <QrBlock url={joinUrl} label="Unirse al torneo" />
          <QrBlock url={bracketUrl} label="Ver bracket" />
        </div>
      </section>

      {/* Feedback toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            className={[
              "fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-xl text-sm font-semibold",
              feedback.ok
                ? "bg-green-900/90 border-green-600 text-green-300"
                : "bg-red-900/90 border-red-600 text-red-300",
            ].join(" ")}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
          >
            {feedback.ok ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            {feedback.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset confirmation dialog */}
      <AnimatePresence>
        {showResetConfirm && (
          <ResetConfirmDialog onConfirm={handleReset} onCancel={() => setShowResetConfirm(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
