import type { PlayerStatus } from "@campeonato/domain";
import { Injectable, Logger } from "@nestjs/common";
import { ClockService } from "../common/clock.service";
import { IdService } from "../common/id.service";
import { RedisKeys } from "../redis/redis-keys";
import { RedisService } from "../redis/redis.service";

export type PersistedPlayer = {
  id: string;
  name: string;
  company: string;
  token: string;
  tournamentId: string;
  status: PlayerStatus;
  currentMatchId: string | null;
  joinedAt: number;
  isBot: boolean;
  socketId: string | null;
};

@Injectable()
export class PlayerService {
  private readonly logger = new Logger(PlayerService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly clock: ClockService,
    private readonly ids: IdService,
  ) {}

  async get(pid: string): Promise<PersistedPlayer | null> {
    return this.redis.getJson<PersistedPlayer>(RedisKeys.player(pid));
  }

  async mustGet(pid: string): Promise<PersistedPlayer> {
    const p = await this.get(pid);
    if (!p) throw new Error(`player ${pid} not found`);
    return p;
  }

  async create(params: {
    tournamentId: string;
    name: string;
    company: string;
    isBot: boolean;
    token: string;
  }): Promise<PersistedPlayer> {
    const id = this.ids.playerId();
    const player: PersistedPlayer = {
      id,
      name: params.name,
      company: params.company,
      token: params.token,
      tournamentId: params.tournamentId,
      status: "registered",
      currentMatchId: null,
      joinedAt: this.clock.now(),
      isBot: params.isBot,
      socketId: null,
    };
    await this.redis.setJson(RedisKeys.player(id), player, 4 * 60 * 60);
    return player;
  }

  async updateStatus(pid: string, status: PlayerStatus): Promise<void> {
    const res = await this.redis.mutateJson<PersistedPlayer>(RedisKeys.player(pid), (cur) => {
      if (!cur) return null;
      const next = { ...cur, status };
      return { next, result: next };
    });
    if (!res.ok) this.logger.warn(`updateStatus conflict on ${pid}`);
  }

  async setCurrentMatch(pid: string, matchId: string | null): Promise<void> {
    await this.redis.mutateJson<PersistedPlayer>(RedisKeys.player(pid), (cur) => {
      if (!cur) return null;
      const next: PersistedPlayer = { ...cur, currentMatchId: matchId };
      return { next, result: next };
    });
  }

  async attachSocket(pid: string, socketId: string | null): Promise<void> {
    await this.redis.mutateJson<PersistedPlayer>(RedisKeys.player(pid), (cur) => {
      if (!cur) return null;
      const next: PersistedPlayer = { ...cur, socketId };
      return { next, result: next };
    });
  }

  async findByToken(token: string): Promise<PersistedPlayer | null> {
    const pid = await this.redis.client.get(RedisKeys.sessionByToken(token));
    if (!pid) return null;
    return this.get(pid);
  }

  async rememberToken(token: string, pid: string): Promise<void> {
    await this.redis.client.set(
      RedisKeys.sessionByToken(token),
      pid,
      "EX",
      6 * 60 * 60, // 6h, mismo horizonte que el JWT
    );
  }

  async rememberSocket(socketId: string, pid: string): Promise<void> {
    await this.redis.client.set(RedisKeys.sessionBySocket(socketId), pid, "EX", 6 * 60 * 60);
  }

  async forgetSocket(socketId: string): Promise<void> {
    await this.redis.client.del(RedisKeys.sessionBySocket(socketId));
  }

  async playerIdBySocket(socketId: string): Promise<string | null> {
    return this.redis.client.get(RedisKeys.sessionBySocket(socketId));
  }
}
