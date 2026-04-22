"use client";

import type { Bracket, BracketUpdatedEvent, TournamentFinishedEvent } from "@campeonato/domain";
import { SERVER_EVENTS } from "@campeonato/domain";
import { useEffect, useRef, useState } from "react";
import { type Socket, io } from "socket.io-client";
import type { PlayerEntry } from "../../../components/BracketView";
import { BracketView } from "../../../components/BracketView";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageParams = {
  params: Promise<{ tid: string }>;
};

// ---------------------------------------------------------------------------
// Bracket page – viewer mode, no auth required
// ---------------------------------------------------------------------------

export default function BracketPage({ params }: PageParams) {
  const [tid, setTid] = useState<string | null>(null);

  // Resolve params (Next.js 15 async params)
  useEffect(() => {
    params.then((p) => setTid(p.tid));
  }, [params]);

  if (!tid) return null;
  return <BracketViewer tid={tid} />;
}

// ---------------------------------------------------------------------------

function BracketViewer({ tid }: { tid: string }) {
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [players, setPlayers] = useState<Record<string, PlayerEntry>>({});
  const [finished, setFinished] = useState<TournamentFinishedEvent | null>(null);
  const [tournamentName, setTournamentName] = useState("Campeonato");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

  // ------------------------------------------------------------------
  // Socket.IO viewer connection
  // ------------------------------------------------------------------
  useEffect(() => {
    const fetchRoster = async () => {
      try {
        const res = await fetch(`${SOCKET_URL}/api/bracket/${tid}/players`);
        if (!res.ok) return;
        const data = (await res.json()) as { players: Record<string, PlayerEntry> };
        setPlayers((prev) => ({ ...prev, ...data.players }));
      } catch {
        // non-fatal
      }
    };

    const fetchBracket = async () => {
      try {
        const res = await fetch(`${SOCKET_URL}/api/bracket/${tid}/bracket`);
        if (!res.ok) return;
        const data = (await res.json()) as { bracket: Bracket | null; status: string };
        if (data.bracket) setBracket(data.bracket);
      } catch {
        // non-fatal
      }
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
      setTournamentName(payload.tournament?.name ?? "Campeonato");
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

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (error && !bracket) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-4">
        <p className="text-red-400 text-lg font-semibold">{error}</p>
        <p className="text-gray-500 text-sm">
          Asegurate de que el server esté corriendo en{" "}
          <code className="text-gray-300">{SOCKET_URL}</code>.
        </p>
      </div>
    );
  }

  if (!bracket) {
    return (
      <div className="flex min-h-screen items-center justify-center flex-col gap-6">
        {/* Stadium background pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
          {[200, 320, 440, 560, 680, 800, 920, 1040].map((sz, i) => (
            <div
              key={sz}
              className="absolute rounded-full border border-green-400"
              style={{
                width: sz,
                height: sz,
                top: "50%",
                left: "50%",
                transform: "translate(-50%,-50%)",
              }}
            />
          ))}
        </div>

        <div className="relative flex flex-col items-center gap-4 text-center">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="text-xl font-bold text-white">{tournamentName}</p>
          <p className="text-sm text-gray-500">
            {connected ? "Esperando que el torneo inicie..." : "Conectando con el servidor..."}
          </p>
          {!connected && (
            <div className="flex items-center gap-2 text-xs text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              Desconectado
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at 50% 100%, rgba(20,40,20,0.4) 0%, #0d1117 70%)",
      }}
    >
      {/* Subtle field lines overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.04]">
        {[20, 40, 60, 80].map((pct) => (
          <div
            key={pct}
            className="absolute top-0 bottom-0 w-px bg-green-400"
            style={{ left: `${pct}%` }}
          />
        ))}
        <div
          className="absolute left-1/2 top-1/4 bottom-1/4 -translate-x-1/2 aspect-square rounded-full border border-green-400"
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
      <div className="absolute bottom-3 right-4 flex items-center gap-1.5 opacity-50">
        <span
          className={["w-1.5 h-1.5 rounded-full", connected ? "bg-green-500" : "bg-red-500"].join(
            " ",
          )}
        />
        <span className="text-[10px] text-gray-500">
          {connected ? "Conectado" : "Reconectando…"}
        </span>
      </div>
    </div>
  );
}
