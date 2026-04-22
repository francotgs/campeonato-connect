"use client";

import type { Bracket, BracketMatch, TournamentFinishedEvent } from "@campeonato/domain";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Swords, Trophy } from "lucide-react";

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
// MatchSlot — single player row within a match card
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
          ? "bg-yellow-500/20 border-l-2 border-yellow-400"
          : isTbd
            ? "opacity-40"
            : isPending
              ? "opacity-80"
              : "opacity-60",
      ].join(" ")}
    >
      {isWinner && <Crown className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
      <div className="min-w-0">
        <p
          className={[
            "text-sm font-semibold leading-tight truncate",
            isWinner ? "text-yellow-300" : isTbd ? "text-gray-500 italic" : "text-white",
          ].join(" ")}
        >
          {name}
        </p>
        {company && <p className="text-[10px] text-gray-500 leading-tight truncate">{company}</p>}
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
        "relative rounded-md border overflow-hidden",
        "transition-all duration-500",
        isLive
          ? "border-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]"
          : isFinished
            ? "border-yellow-700/50"
            : isCurrentRound
              ? "border-blue-700/60"
              : "border-gray-700/50",
        "bg-gray-900",
      ].join(" ")}
    >
      {/* Live badge */}
      {isLive && (
        <div className="absolute top-1 right-1.5 flex items-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-[9px] font-bold text-green-400 uppercase tracking-widest">
            Live
          </span>
        </div>
      )}
      {isLive && (
        <div className="absolute inset-0 pointer-events-none rounded-md ring-1 ring-green-500 animate-pulse" />
      )}

      <MatchSlot
        playerId={match.slotA}
        players={players}
        isWinner={isFinished && match.winnerId === match.slotA}
        isPending={isPending}
      />
      <div className="h-px bg-gray-700/60 mx-2" />
      <MatchSlot
        playerId={match.slotB}
        players={players}
        isWinner={isFinished && match.winnerId === match.slotB}
        isPending={isPending}
      />

      {isLive && (
        <div className="flex items-center justify-center py-1 bg-green-950/40">
          <Swords className="w-3 h-3 text-green-400 mr-1" />
          <span className="text-[9px] text-green-400 font-semibold uppercase tracking-wider">
            En curso
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BracketColumn — one round column with absolute-positioned matches
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
}: {
  round: { index: number; matches: BracketMatch[] };
  roundLabel: string;
  players: Record<string, PlayerEntry>;
  isCurrentRound: boolean;
  bracketSize: number;
  unit: number; // MATCH_H + GAP
  matchH: number;
  colWidth: number;
}) {
  const totalHeight = (bracketSize / 2) * unit;

  return (
    <div className="flex flex-col gap-0 shrink-0" style={{ width: colWidth }}>
      {/* Round label */}
      <div
        className={[
          "text-center text-xs font-bold uppercase tracking-widest pb-2 transition-colors",
          isCurrentRound ? "text-yellow-400" : "text-gray-500",
        ].join(" ")}
      >
        {roundLabel}
      </div>

      {/* Matches container */}
      <div className="relative" style={{ height: totalHeight }}>
        {round.matches.map((match, mi) => {
          // Center match mi of round ri (0-indexed) at the correct y position
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
              transition={{ delay: ri * 0.1 + mi * 0.05 }}
            >
              <MatchCard match={match} players={players} isCurrentRound={isCurrentRound} />

              {/* Connector lines (except final round) */}
              {/* Horizontal line going right */}
              <div
                className="absolute top-1/2 -right-0 h-px bg-gray-600/50"
                style={{ width: 8, right: -8 }}
              />
              {/* Vertical line for even matches (connects to odd sibling) */}
              {mi % 2 === 0 && (
                <div
                  className="absolute bg-gray-600/50"
                  style={{
                    width: 1,
                    top: "50%",
                    right: -8,
                    height: factor * unit,
                  }}
                />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Podium overlay
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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* Stars / confetti effect via rings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[200, 260, 320, 380, 440, 500, 560, 620, 680, 740, 800, 860].map((sz, i) => (
          <motion.div
            key={sz}
            className="absolute rounded-full bg-yellow-400/10"
            style={{
              width: sz,
              height: sz,
              top: "50%",
              left: "50%",
              x: "-50%",
              y: "-50%",
            }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.05, 0.3] }}
            transition={{ duration: 3 + i * 0.3, repeat: Number.POSITIVE_INFINITY, delay: i * 0.2 }}
          />
        ))}
      </div>

      <motion.div
        className="relative flex flex-col items-center gap-8 px-8 py-10 rounded-2xl border border-yellow-500/30 bg-gray-950/90 shadow-2xl"
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ delay: 0.3, type: "spring" }}
      >
        <Trophy className="w-16 h-16 text-yellow-400" />

        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-yellow-500 mb-1">
            Campeón
          </p>
          <p className="text-4xl font-black text-white">
            {champion?.name ?? finished.podium.champion}
          </p>
          {champion?.company && <p className="text-lg text-gray-400 mt-1">{champion.company}</p>}
        </div>

        {runnerUp && (
          <div className="text-center opacity-80">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-0.5">Finalista</p>
            <p className="text-xl font-bold text-gray-300">{runnerUp.name}</p>
            {runnerUp.company && <p className="text-sm text-gray-500">{runnerUp.company}</p>}
          </div>
        )}

        {finished.podium.semifinalists.length > 0 && (
          <div className="flex gap-8 text-center opacity-60">
            {finished.podium.semifinalists.map((sfId) => {
              const sf = players[sfId];
              return (
                <div key={sfId}>
                  <p className="text-xs uppercase tracking-widest text-gray-600 mb-0.5">
                    Semifinalista
                  </p>
                  <p className="text-sm font-semibold text-gray-400">{sf?.name ?? sfId}</p>
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

  // Compute layout unit dynamically so the bracket fits in ~780px height
  const MAX_HEIGHT = 780;
  const MATCH_H = Math.min(64, Math.floor(MAX_HEIGHT / numFirstRoundMatches) - 8);
  const GAP = Math.max(4, Math.floor(MAX_HEIGHT / numFirstRoundMatches) - MATCH_H);
  const UNIT = MATCH_H + GAP;
  const totalHeight = numFirstRoundMatches * UNIT;

  const COL_W = 200;
  const COL_GAP = 16;

  return (
    <div className="relative flex flex-col h-full min-h-0">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-yellow-400" />
          <div>
            <h1 className="text-xl font-black text-white leading-none">{tournamentName}</h1>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">
              Bracket · Ronda actual: {currentRound + 1}/{totalRounds}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <span className="text-xs text-green-400 font-semibold">En vivo</span>
        </div>
      </header>

      {/* Bracket scroll area */}
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
            />
          ))}

          {/* Champion placeholder after final */}
          <div className="flex flex-col gap-0 shrink-0" style={{ width: COL_W }}>
            <div className="text-center text-xs font-bold uppercase tracking-widest pb-2 text-yellow-500">
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
                      <Trophy className="w-8 h-8 text-yellow-400" />
                      <div className="text-center">
                        <p className="font-bold text-yellow-300 text-sm">
                          {p?.name ?? finalMatch.winnerId}
                        </p>
                        {p?.company && <p className="text-xs text-gray-500">{p.company}</p>}
                      </div>
                    </motion.div>
                  );
                }
                return (
                  <div
                    className="absolute w-full flex items-center justify-center"
                    style={{ top: totalHeight / 2 - 16 }}
                  >
                    <div className="w-10 h-10 rounded-full border-2 border-dashed border-yellow-600/40 flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-yellow-600/40" />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Podium overlay */}
      <AnimatePresence>
        {finished && <PodiumOverlay finished={finished} players={players} />}
      </AnimatePresence>
    </div>
  );
}
