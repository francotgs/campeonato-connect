"use client";

import { BrandBackground, BrandLogo, Panel } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSocket } from "@/lib/socket";
import { useGameStore } from "@/lib/store";
import { CLIENT_EVENTS } from "@campeonato/domain";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  const [tournamentName, setTournamentName] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("4match:token");
    if (saved) router.replace("/play");
  }, [router, token]);

  useEffect(() => {
    const socket = getSocket();
    socket.on(
      "tournament:state",
      (data: {
        playersCount: number;
        tournament?: { name?: string };
      }) => {
        setPlayersCount(data.playersCount);
        if (data.tournament?.name) setTournamentName(data.tournament.name);
      },
    );
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
    if (!socket.connected) socket.connect();

    socket.emit(
      CLIENT_EVENTS.PLAYER_JOIN,
      {
        msgId: crypto.randomUUID(),
        tournamentId: tid,
        name: name.trim(),
        company: company.trim(),
      },
      (ack: {
        ok: boolean;
        token?: string;
        playerId?: string;
        code?: string;
        message?: string;
      }) => {
        setLoading(false);
        if (ack.ok && ack.token && ack.playerId) {
          setAuth(ack.playerId, ack.token, tid, name.trim());
          router.push("/play");
        } else {
          const msgs: Record<string, string> = {
            TOURNAMENT_STARTED: "El torneo ya comenzó. No se pueden sumar nuevos jugadores.",
            TOURNAMENT_FULL: "El cupo del torneo está lleno.",
            DUPLICATE_NAME: "Ese nombre ya está registrado. Probá con otro.",
            TOURNAMENT_NOT_FOUND: "No encontramos el torneo. Revisá el QR.",
          };
          setError(msgs[ack.code ?? ""] ?? ack.message ?? "Error al unirse.");
        }
      },
    );
  };

  return (
    <BrandBackground>
      <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12">
        <motion.div
          className="w-full max-w-sm space-y-8"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex flex-col items-center gap-4">
            <BrandLogo size="xl" orientation="vertical" />

            {tournamentName && (
              <motion.p
                className="text-white/70 text-sm text-center font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {tournamentName}
              </motion.p>
            )}

            {playersCount !== null && (
              <motion.div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-default text-white/70 text-xs"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 }}
              >
                <Users className="size-3.5 text-emerald-400" />
                <span>
                  {playersCount} jugador{playersCount !== 1 ? "es" : ""} ya inscripto
                  {playersCount !== 1 ? "s" : ""}
                </span>
              </motion.div>
            )}
          </div>

          <Panel className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label
                  htmlFor="name"
                  className="text-white/70 text-xs uppercase tracking-widest font-bold"
                >
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
                  className="h-12 bg-white/5 border-default text-white placeholder:text-white/25 focus:border-emerald-400 focus:ring-emerald-400/20 text-base"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="company"
                  className="text-white/70 text-xs uppercase tracking-widest font-bold"
                >
                  Empresa / Área
                </Label>
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Ej: CEDI Tecnología"
                  maxLength={40}
                  required
                  className="h-12 bg-white/5 border-default text-white placeholder:text-white/25 focus:border-emerald-400 focus:ring-emerald-400/20 text-base"
                />
              </div>

              {error && (
                <motion.p
                  role="alert"
                  className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {error}
                </motion.p>
              )}

              <Button
                type="submit"
                disabled={loading || !name.trim() || !company.trim()}
                size="lg"
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-base disabled:opacity-40 transition"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Uniéndote…
                  </>
                ) : (
                  <>
                    ¡Unirme al torneo!
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>

              <p className="text-center text-[11px] text-white/40 leading-relaxed">
                Al unirte aceptás participar en una partida relámpago de cartas.
                <br />
                Sin registro ni contraseñas.
              </p>
            </form>
          </Panel>
        </motion.div>
      </div>
    </BrandBackground>
  );
}
