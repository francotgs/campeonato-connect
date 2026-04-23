"use client";

import type { Bracket, BracketUpdatedEvent, TournamentFinishedEvent } from "@campeonato/domain";
import { SERVER_EVENTS } from "@campeonato/domain";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type Socket, io } from "socket.io-client";
import type { PlayerEntry } from "../../../components/BracketView";
import { BracketView } from "../../../components/BracketView";
import { BrandBackground, BrandLogo, BrandSpinner, StatusPill } from "../../../components/brand";

type PageParams = {
  params: Promise<{ tid: string }>;
};

export default function BracketPage({ params }: PageParams) {
  const [tid, setTid] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setTid(p.tid));
  }, [params]);

  if (!tid) return null;
  return <BracketViewer tid={tid} />;
}

function BracketViewer({ tid }: { tid: string }) {
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [players, setPlayers] = useState<Record<string, PlayerEntry>>({});
  const [finished, setFinished] = useState<TournamentFinishedEvent | null>(null);
  const [tournamentName, setTournamentName] = useState("Campeonato MundIAl 4Match");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

  useEffect(() => {
    const fetchRoster = async () => {
      try {
        const res = await fetch(`${SOCKET_URL}/api/bracket/${tid}/players`);
        if (!res.ok) return;
        const data = (await res.json()) as { players: Record<string, PlayerEntry> };
        setPlayers((prev) => ({ ...prev, ...data.players }));
      } catch {}
    };

    const fetchBracket = async () => {
      try {
        const res = await fetch(`${SOCKET_URL}/api/bracket/${tid}/bracket`);
        if (!res.ok) return;
        const data = (await res.json()) as { bracket: Bracket | null; status: string };
        if (data.bracket) setBracket(data.bracket);
      } catch {}
    };

    const socket = io(SOCKET_URL, {
      auth: { mode: "viewer", tournamentId: tid },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 20,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setError(null);
      fetchRoster();
      fetchBracket();
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("connect_error", (err) => {
      setError(`Sin conexión con el servidor: ${err.message}`);
    });

    socket.on(SERVER_EVENTS.TOURNAMENT_STATE, (payload: { tournament: { name: string } }) => {
      setTournamentName(payload.tournament?.name ?? "Campeonato MundIAl 4Match");
    });

    socket.on(SERVER_EVENTS.TOURNAMENT_RESET, () => {
      // El admin reseteó el torneo: limpiamos el bracket, el campeón y el
      // roster. La UI vuelve a la pantalla de "Esperando que inicie el torneo"
      // sin mostrar datos residuales.
      setBracket(null);
      setCurrentRound(0);
      setFinished(null);
      setPlayers({});
    });

    socket.on(SERVER_EVENTS.BRACKET_UPDATED, (evt: BracketUpdatedEvent) => {
      setBracket(evt.bracket);
      setCurrentRound(evt.round);
      fetchRoster();
    });

    socket.on(SERVER_EVENTS.TOURNAMENT_FINISHED, (evt: TournamentFinishedEvent) => {
      setFinished(evt);
      fetchRoster();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [tid, SOCKET_URL]);

  if (error && !bracket) {
    return (
      <BrandBackground variant="subtle">
        <div className="flex min-h-screen items-center justify-center flex-col gap-4 px-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400" />
          <p className="text-red-400 text-lg font-bold">{error}</p>
          <p className="text-white/50 text-sm">
            Verificá que el server esté corriendo en{" "}
            <code className="text-white/80">{SOCKET_URL}</code>
          </p>
        </div>
      </BrandBackground>
    );
  }

  if (!bracket) {
    return (
      <BrandBackground>
        <div className="flex min-h-screen items-center justify-center flex-col gap-8 px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-6"
          >
            <BrandLogo size="xl" orientation="vertical" tone="gold" />
            <p className="text-white/70 text-lg font-medium">{tournamentName}</p>
          </motion.div>

          <div className="flex flex-col items-center gap-3">
            <BrandSpinner size={48} tone="gold" />
            <p className="text-white/45 text-sm uppercase tracking-widest font-bold">
              {connected ? "Esperando que inicie el torneo…" : "Conectando con el servidor…"}
            </p>
          </div>

          {!connected && <StatusPill tone="danger">Desconectado</StatusPill>}
        </div>
      </BrandBackground>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-surface">
      {/* Subtle field lines overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.035]">
        {[20, 40, 60, 80].map((pct) => (
          <div
            key={pct}
            className="absolute top-0 bottom-0 w-px bg-emerald-300"
            style={{ left: `${pct}%` }}
          />
        ))}
        <div
          className="absolute left-1/2 top-1/4 bottom-1/4 -translate-x-1/2 aspect-square rounded-full border border-emerald-300"
          style={{ width: "30vmin" }}
        />
      </div>

      <BracketView
        bracket={bracket}
        currentRound={currentRound}
        players={players}
        finished={finished}
        tournamentName={tournamentName}
      />

      {/* Connection indicator */}
      <div className="absolute bottom-3 right-4 flex items-center gap-1.5 opacity-60">
        <span
          className={[
            "w-1.5 h-1.5 rounded-full",
            connected ? "bg-emerald-500 animate-pulse" : "bg-red-500",
          ].join(" ")}
        />
        <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">
          {connected ? "Conectado" : "Reconectando…"}
        </span>
      </div>
    </div>
  );
}
