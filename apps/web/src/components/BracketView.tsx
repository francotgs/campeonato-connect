"use client";

import type { Bracket, BracketMatch, TournamentFinishedEvent } from "@campeonato/domain";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Swords, Trophy } from "lucide-react";
import { BrandLogo, StatusPill } from "./brand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlayerEntry = {
  name: string;
  company: string;
  isBot: boolean;
};

type Props = {
  bracket: Bracket;
  currentRound: number;
  players: Record<string, PlayerEntry>;
  finished: TournamentFinishedEvent | null;
  tournamentName: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROUND_NAMES: Record<number, string[]> = {
  1: ["Final"],
  2: ["Semis", "Final"],
  3: ["Cuartos", "Semis", "Final"],
  4: ["Octavos", "Cuartos", "Semis", "Final"],
  5: ["16avos", "Octavos", "Cuartos", "Semis", "Final"],
};

function getRoundLabel(roundIndex: number, totalRounds: number): string {
  const names = ROUND_NAMES[totalRounds] ?? [];
  return names[roundIndex] ?? `Ronda ${roundIndex + 1}`;
}

function playerName(id: string | null, players: Record<string, PlayerEntry>): string {
  if (!id) return "TBD";
  return players[id]?.name ?? id.slice(0, 8);
}

function playerCompany(id: string | null, players: Record<string, PlayerEntry>): string {
  if (!id) return "";
  return players[id]?.company ?? "";
}

// ---------------------------------------------------------------------------
// MatchSlot
// ---------------------------------------------------------------------------

function MatchSlot({
  playerId,
  players,
  isWinner,
  isPending,
}: {
  playerId: string | null;
  players: Record<string, PlayerEntry>;
  isWinner: boolean;
  isPending: boolean;
}) {
  const name = playerName(playerId, players);
  const company = playerCompany(playerId, players);
  const isTbd = !playerId;

  return (
    <div
      className={[
        "flex items-center gap-2 px-3 py-1.5 transition-all duration-300",
        isWinner
          ? "bg-amber-400/15 border-l-2 border-amber-400"
          : isTbd
            ? "opacity-40"
            : isPending
              ? "opacity-80"
              : "opacity-60",
      ].join(" ")}
    >
      {isWinner && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
      <div className="min-w-0">
        <p
          className={[
            "text-sm font-semibold leading-tight truncate",
            isWinner ? "text-amber-300" : isTbd ? "text-white/30 italic" : "text-white",
          ].join(" ")}
        >
          {name}
        </p>
        {company && <p className="text-[10px] text-white/40 leading-tight truncate">{company}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MatchCard
// ---------------------------------------------------------------------------

function MatchCard({
  match,
  players,
  isCurrentRound,
}: {
  match: BracketMatch;
  players: Record<string, PlayerEntry>;
  isCurrentRound: boolean;
}) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const isPending = match.status === "pending";

  return (
    <div
      className={[
        "relative rounded-lg border overflow-hidden transition-all duration-500",
        "bg-[rgba(26,34,54,0.85)] backdrop-blur-sm",
        isLive
          ? "border-emerald-400/70 shadow-[0_0_18px_rgba(16,185,129,0.35)]"
          : isFinished
            ? "border-amber-400/30"
            : isCurrentRound
              ? "border-emerald-500/30"
              : "border-white/8",
      ].join(" ")}
    >
      {isLive && (
        <div className="absolute top-1 right-1.5 z-10">
          <StatusPill tone="live" pulse className="!px-1.5 !py-0.5 !text-[8px]">
            Live
          </StatusPill>
        </div>
      )}

      <MatchSlot
        playerId={match.slotA}
        players={players}
        isWinner={isFinished && match.winnerId === match.slotA}
        isPending={isPending}
      />
      <div className="h-px bg-white/10 mx-2" />
      <MatchSlot
        playerId={match.slotB}
        players={players}
        isWinner={isFinished && match.winnerId === match.slotB}
        isPending={isPending}
      />

      {isLive && (
        <div className="flex items-center justify-center py-1 bg-emerald-950/40 border-t border-emerald-500/20">
          <Swords className="w-3 h-3 text-emerald-400 mr-1" />
          <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
            En curso
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BracketColumn
// ---------------------------------------------------------------------------

function BracketColumn({
  round,
  roundLabel,
  players,
  isCurrentRound,
  bracketSize,
  unit,
  matchH,
  colWidth,
  isLastRound,
}: {
  round: { index: number; matches: BracketMatch[] };
  roundLabel: string;
  players: Record<string, PlayerEntry>;
  isCurrentRound: boolean;
  bracketSize: number;
  unit: number;
  matchH: number;
  colWidth: number;
  isLastRound: boolean;
}) {
  const totalHeight = (bracketSize / 2) * unit;

  return (
    <div className="flex flex-col gap-0 shrink-0" style={{ width: colWidth }}>
      <div
        className={[
          "text-center text-xs font-black uppercase tracking-[0.2em] pb-2 transition-colors",
          isCurrentRound ? "text-emerald-400" : "text-white/40",
        ].join(" ")}
      >
        {roundLabel}
      </div>

      <div className="relative" style={{ height: totalHeight }}>
        {round.matches.map((match, mi) => {
          const ri = round.index;
          const factor = 2 ** ri;
          const yCenter = (2 * mi + 1) * factor * unit * 0.5;
          const yTop = yCenter - matchH / 2;

          return (
            <motion.div
              key={match.matchId ?? `${ri}-${mi}`}
              className="absolute w-full"
              style={{ top: yTop }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: ri * 0.08 + mi * 0.04, ease: [0.16, 1, 0.3, 1] }}
            >
              <MatchCard match={match} players={players} isCurrentRound={isCurrentRound} />

              {/*
                Conectores de bracket:
                - Stub horizontal que apunta al match de la siguiente ronda.
                - Línea vertical que une el par (arriba/abajo) para formar la llave `⌐`.
                En la ronda final (1 solo match) no existe par ni siguiente ronda,
                así que no se dibuja ningún conector (evita la línea "colgando").
              */}
              {!isLastRound && (
                <>
                  <div
                    className="absolute top-1/2 h-px bg-white/15"
                    style={{ width: 8, right: -8 }}
                  />
                  {mi % 2 === 0 && (
                    <div
                      className="absolute bg-white/15"
                      style={{ width: 1, top: "50%", right: -8, height: factor * unit }}
                    />
                  )}
                </>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PodiumOverlay
// ---------------------------------------------------------------------------

function PodiumOverlay({
  finished,
  players,
}: {
  finished: TournamentFinishedEvent;
  players: Record<string, PlayerEntry>;
}) {
  const champion = players[finished.podium.champion];
  const runnerUp = players[finished.podium.runnerUp];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[200, 260, 320, 380, 440, 500, 560, 620, 680, 740, 800, 860].map((sz, i) => (
          <motion.div
            key={sz}
            className="absolute rounded-full border border-amber-400/15"
            style={{
              width: sz,
              height: sz,
              top: "50%",
              left: "50%",
              x: "-50%",
              y: "-50%",
            }}
            animate={{ scale: [1, 1.25, 1], opacity: [0.25, 0.05, 0.25] }}
            transition={{
              duration: 3 + i * 0.3,
              repeat: Number.POSITIVE_INFINITY,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>

      <motion.div
        className="relative flex flex-col items-center gap-7 px-10 py-12 rounded-3xl border border-amber-400/30 bg-[rgba(11,16,32,0.95)] shadow-2xl glow-accent"
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ delay: 0.3, type: "spring" }}
      >
        <motion.div
          animate={{ rotate: [-3, 3, -3] }}
          transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
        >
          <Trophy className="w-20 h-20 text-amber-400 drop-shadow-[0_0_24px_rgba(251,191,36,0.6)]" />
        </motion.div>

        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.4em] text-amber-300 mb-2">
            Campeón
          </p>
          <p className="text-5xl font-black text-white">
            {champion?.name ?? finished.podium.champion}
          </p>
          {champion?.company && <p className="text-lg text-white/60 mt-2">{champion.company}</p>}
        </div>

        {runnerUp && (
          <div className="text-center opacity-85">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-0.5 font-bold">
              Finalista
            </p>
            <p className="text-xl font-bold text-white/80">{runnerUp.name}</p>
            {runnerUp.company && <p className="text-sm text-white/50">{runnerUp.company}</p>}
          </div>
        )}

        {finished.podium.semifinalists.length > 0 && (
          <div className="flex gap-10 text-center opacity-70">
            {finished.podium.semifinalists.map((sfId) => {
              const sf = players[sfId];
              return (
                <div key={sfId}>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/40 mb-0.5 font-bold">
                    Semifinalista
                  </p>
                  <p className="text-sm font-semibold text-white/70">{sf?.name ?? sfId}</p>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// BracketView — main export
// ---------------------------------------------------------------------------

export function BracketView({ bracket, currentRound, players, finished, tournamentName }: Props) {
  const totalRounds = Math.log2(bracket.size);
  const numFirstRoundMatches = bracket.size / 2;

  const MAX_HEIGHT = 780;
  const MATCH_H = Math.min(64, Math.floor(MAX_HEIGHT / numFirstRoundMatches) - 8);
  const GAP = Math.max(4, Math.floor(MAX_HEIGHT / numFirstRoundMatches) - MATCH_H);
  const UNIT = MATCH_H + GAP;
  const totalHeight = numFirstRoundMatches * UNIT;

  const COL_W = 200;
  const COL_GAP = 16;

  return (
    <div className="relative flex flex-col h-full min-h-0">
      <header className="flex items-center justify-between px-8 py-4 border-b border-default bg-[rgba(11,16,32,0.55)] backdrop-blur shrink-0">
        <div className="flex items-center gap-4">
          <BrandLogo size="sm" tone="gold" />
          <div className="h-8 w-px bg-white/10" />
          <div>
            <h1 className="text-lg font-black text-white leading-none">{tournamentName}</h1>
            <p className="text-[11px] text-white/50 uppercase tracking-widest mt-0.5 font-bold">
              Bracket · Ronda actual: {currentRound + 1}/{totalRounds}
            </p>
          </div>
        </div>
        <StatusPill tone="live" pulse>
          En vivo
        </StatusPill>
      </header>

      <div className="flex-1 overflow-auto p-8">
        <div
          className="flex flex-row items-start"
          style={{ gap: COL_GAP, minWidth: bracket.rounds.length * (COL_W + COL_GAP) }}
        >
          {bracket.rounds.map((round) => (
            <BracketColumn
              key={round.index}
              round={round}
              roundLabel={getRoundLabel(round.index, totalRounds)}
              players={players}
              isCurrentRound={round.index === currentRound}
              bracketSize={bracket.size}
              unit={UNIT}
              matchH={MATCH_H}
              colWidth={COL_W}
              isLastRound={round.index === bracket.rounds.length - 1}
            />
          ))}

          <div className="flex flex-col gap-0 shrink-0" style={{ width: COL_W }}>
            <div className="text-center text-xs font-black uppercase tracking-[0.2em] pb-2 text-amber-400">
              Campeón
            </div>
            <div className="relative" style={{ height: totalHeight }}>
              {(() => {
                const finalRound = bracket.rounds[bracket.rounds.length - 1];
                const finalMatch = finalRound?.matches[0];
                if (finalMatch?.winnerId) {
                  const p = players[finalMatch.winnerId];
                  return (
                    <motion.div
                      className="absolute w-full flex flex-col items-center justify-center gap-2"
                      style={{ top: totalHeight / 2 - 50, height: 100 }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", bounce: 0.4 }}
                    >
                      <Trophy className="w-10 h-10 text-amber-400 drop-shadow-[0_0_18px_rgba(251,191,36,0.6)]" />
                      <div className="text-center">
                        <p className="font-black text-amber-300 text-base">
                          {p?.name ?? finalMatch.winnerId}
                        </p>
                        {p?.company && <p className="text-xs text-white/50">{p.company}</p>}
                      </div>
                    </motion.div>
                  );
                }
                return (
                  <div
                    className="absolute w-full flex items-center justify-center"
                    style={{ top: totalHeight / 2 - 20 }}
                  >
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-amber-500/30 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-amber-500/40" />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {finished && <PodiumOverlay finished={finished} players={players} />}
      </AnimatePresence>
    </div>
  );
}
