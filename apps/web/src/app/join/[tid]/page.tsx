"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CLIENT_EVENTS } from "@campeonato/domain";
import { Trophy } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { useGameStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function JoinPage() {
  const params = useParams<{ tid: string }>();
  const router = useRouter();
  const tid = params.tid;

  const setAuth = useGameStore((s) => s.setAuth);
  const token = useGameStore((s) => s.token);

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playersCount, setPlayersCount] = useState<number | null>(null);

  // Si ya tiene token guardado, va directo a /play
  useEffect(() => {
    const saved = localStorage.getItem("4match:token");
    if (saved) {
      router.replace("/play");
    }
  }, [router, token]);

  // Escuchar tournament:state para mostrar contador de inscriptos
  useEffect(() => {
    const socket = getSocket();
    socket.on("tournament:state", (data: { playersCount: number }) => {
      setPlayersCount(data.playersCount);
    });
    return () => {
      socket.off("tournament:state");
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !company.trim()) return;
    setLoading(true);
    setError(null);

    const socket = getSocket();

    // Asegurar conexión
    if (!socket.connected) socket.connect();

    socket.emit(
      CLIENT_EVENTS.PLAYER_JOIN,
      {
        msgId: crypto.randomUUID(),
        tournamentId: tid,
        name: name.trim(),
        company: company.trim(),
      },
      (ack: { ok: boolean; token?: string; playerId?: string; code?: string; message?: string }) => {
        setLoading(false);
        if (ack.ok && ack.token && ack.playerId) {
          setAuth(ack.playerId, ack.token, tid, name.trim());
          router.push("/play");
        } else {
          const msgs: Record<string, string> = {
            TOURNAMENT_STARTED: "El torneo ya comenzó.",
            TOURNAMENT_FULL: "El cupo está lleno.",
            DUPLICATE_NAME: "Ese nombre ya está registrado.",
            TOURNAMENT_NOT_FOUND: "Torneo no encontrado.",
          };
          setError(msgs[ack.code ?? ""] ?? ack.message ?? "Error al unirse.");
        }
      },
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0d1117] px-6 py-12">
      <motion.div
        className="w-full max-w-sm space-y-8"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="mx-auto size-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
            <Trophy className="size-8 text-emerald-400" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-black text-white">
            Campeonato MundIAl{" "}
            <span className="text-emerald-400">4Match</span>
          </h1>
          {playersCount !== null && (
            <p className="text-white/50 text-sm">
              {playersCount} jugador{playersCount !== 1 ? "es" : ""} inscripto
              {playersCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-white/70 text-sm">
              Tu nombre
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Juan García"
              maxLength={40}
              required
              autoFocus
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-emerald-400 focus:ring-emerald-400/20"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="company" className="text-white/70 text-sm">
              Empresa / Área
            </Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Ej: CEDI Tecnología"
              maxLength={40}
              required
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-emerald-400 focus:ring-emerald-400/20"
            />
          </div>

          {error && (
            <motion.p
              className="text-red-400 text-sm text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {error}
            </motion.p>
          )}

          <Button
            type="submit"
            disabled={loading || !name.trim() || !company.trim()}
            size="lg"
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black text-base disabled:opacity-50"
          >
            {loading ? "Uniéndose…" : "¡Unirme al torneo!"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
