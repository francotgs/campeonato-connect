/**
 * Claves canónicas de Redis con prefijo `t4m:` (§12). Centralizadas aquí
 * para evitar typos en el resto del server.
 */
export const RedisKeys = {
  tournament: (tid: string) => `t4m:tournament:${tid}` as const,
  tournamentPlayers: (tid: string) => `t4m:tournament:${tid}:players` as const,
  tournamentHumans: (tid: string) => `t4m:tournament:${tid}:humans` as const,
  tournamentBots: (tid: string) => `t4m:tournament:${tid}:bots` as const,
  tournamentNames: (tid: string) => `t4m:tournament:${tid}:names` as const,
  tournamentBracket: (tid: string) => `t4m:tournament:${tid}:bracket` as const,
  tournamentCurrentRound: (tid: string) => `t4m:tournament:${tid}:currentRound` as const,

  player: (pid: string) => `t4m:player:${pid}` as const,

  match: (mid: string) => `t4m:match:${mid}` as const,
  matchProcessedMsgs: (mid: string) => `t4m:match:${mid}:processed_msgs` as const,

  sessionBySocket: (socketId: string) => `t4m:session:${socketId}` as const,
  sessionByToken: (token: string) => `t4m:session:by-token:${token}` as const,

  lockBracket: (tid: string) => `t4m:lock:bracket:${tid}` as const,
} as const;

export const DEFAULT_TTL_SECONDS = 4 * 60 * 60; // 4h por §12
export const MSG_DEDUP_TTL_SECONDS = 10 * 60; // 10 min (§14.3)
