import type { TournamentStatus, TournamentSummary } from "@campeonato/domain";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { ClockService } from "../common/clock.service";
import { GameError } from "../common/game-error";
import { ConfigService } from "../config/config.service";
import { RedisKeys } from "../redis/redis-keys";
import { RedisService } from "../redis/redis.service";
import { SessionService } from "../session/session.service";
import { type PersistedPlayer, PlayerService } from "./player.service";

export type PersistedTournament = {
  id: string;
  name: string;
  status: TournamentStatus;
  cupoMax: number;
  matchDuration: number;
  cardsPerPlayer: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  championId: string | null;
};

// Un evento típico dura horas, no minutos. Usamos 7 días para que ninguna clave
// expire mientras haya actividad. Igualmente, `ensureBootstrap` re-crea el torneo
// si por algún motivo la clave se perdió (reinicio de Redis, TTL residual, etc.).
const TOURNAMENT_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class TournamentService implements OnModuleInit {
  private readonly logger = new Logger(TournamentService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly clock: ClockService,
    private readonly players: PlayerService,
    private readonly session: SessionService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureBootstrap();
  }

  /**
   * Garantiza que exista el torneo canónico (el configurado en
   * BOOTSTRAP_TOURNAMENT_ID). Se ejecuta al arrancar el server, pero también
   * se invoca desde el controller y el gateway para recuperarse automática-
   * mente si la clave de Redis se pierde (TTL residual, reinicio del plugin,
   * etc.) mientras el proceso del server sigue vivo.
   */
  async ensureBootstrap(tid?: string): Promise<PersistedTournament> {
    const targetTid = tid ?? this.config.get("BOOTSTRAP_TOURNAMENT_ID");
    const existing = await this.get(targetTid);
    if (existing) {
      return existing;
    }
    const tournament: PersistedTournament = {
      id: targetTid,
      name: this.config.get("BOOTSTRAP_TOURNAMENT_NAME"),
      status: "registration_open",
      cupoMax: this.config.get("BOOTSTRAP_CUPO_MAX"),
      matchDuration: this.config.get("MATCH_DURATION_SECONDS"),
      cardsPerPlayer: this.config.get("CARDS_PER_PLAYER"),
      createdAt: this.clock.now(),
      startedAt: null,
      finishedAt: null,
      championId: null,
    };
    await this.redis.setJson(RedisKeys.tournament(targetTid), tournament, TOURNAMENT_TTL_SECONDS);
    this.logger.log(`Bootstrapped tournament ${targetTid} (${tournament.name})`);
    return tournament;
  }

  async get(tid: string): Promise<PersistedTournament | null> {
    return this.redis.getJson<PersistedTournament>(RedisKeys.tournament(tid));
  }

  async mustGet(tid: string): Promise<PersistedTournament> {
    const t = await this.get(tid);
    if (!t) throw new GameError("TOURNAMENT_NOT_FOUND", `tournament ${tid} not found`);
    return t;
  }

  async updateStatus(tid: string, status: TournamentStatus): Promise<PersistedTournament> {
    const res = await this.redis.mutateJson<PersistedTournament>(
      RedisKeys.tournament(tid),
      (cur) => {
        if (!cur) return null;
        const next: PersistedTournament = {
          ...cur,
          status,
          startedAt:
            status === "running" && cur.startedAt === null ? this.clock.now() : cur.startedAt,
          finishedAt:
            status === "finished" && cur.finishedAt === null ? this.clock.now() : cur.finishedAt,
        };
        return { next, result: next };
      },
      { ttlSeconds: TOURNAMENT_TTL_SECONDS },
    );
    if (!res.ok) throw new GameError("INTERNAL", "tournament update conflict");
    return res.value;
  }

  async listPlayerIds(tid: string): Promise<string[]> {
    return this.redis.client.smembers(RedisKeys.tournamentPlayers(tid));
  }

  async countPlayers(tid: string): Promise<number> {
    return this.redis.client.scard(RedisKeys.tournamentPlayers(tid));
  }

  async countHumans(tid: string): Promise<number> {
    return this.redis.client.scard(RedisKeys.tournamentHumans(tid));
  }

  async registerHuman(params: {
    tid: string;
    name: string;
    company: string;
  }): Promise<{ player: PersistedPlayer; token: string }> {
    const { tid, name, company } = params;
    const tournament = await this.mustGet(tid);
    if (tournament.status !== "registration_open") {
      throw new GameError("TOURNAMENT_STARTED", "registration is closed");
    }

    const cleanedName = name.trim();
    if (cleanedName.length === 0) {
      throw new GameError("INVALID_PAYLOAD", "name cannot be empty");
    }

    const nameKey = RedisKeys.tournamentNames(tid);
    const playersKey = RedisKeys.tournamentPlayers(tid);
    const humansKey = RedisKeys.tournamentHumans(tid);
    const nameLower = cleanedName.toLowerCase();

    const currentCount = await this.redis.client.scard(playersKey);
    if (currentCount >= tournament.cupoMax) {
      throw new GameError("TOURNAMENT_FULL", "no more slots available");
    }

    const added = await this.redis.client.sadd(nameKey, nameLower);
    if (added === 0) {
      throw new GameError("DUPLICATE_NAME", `name '${cleanedName}' is already in use`);
    }
    await this.redis.client.expire(nameKey, TOURNAMENT_TTL_SECONDS);

    const provisionalToken = "pending"; // se reemplaza abajo con el JWT real
    const player = await this.players.create({
      tournamentId: tid,
      name: cleanedName,
      company: company.trim(),
      isBot: false,
      token: provisionalToken,
    });
    const token = this.session.issueForPlayer(player.id, tid, "player");
    player.token = token;
    await this.redis.setJson(RedisKeys.player(player.id), player, TOURNAMENT_TTL_SECONDS);
    await this.players.rememberToken(token, player.id);

    await this.redis.pipelineTx((m) => {
      m.sadd(playersKey, player.id);
      m.expire(playersKey, TOURNAMENT_TTL_SECONDS);
      m.sadd(humansKey, player.id);
      m.expire(humansKey, TOURNAMENT_TTL_SECONDS);
    });
    return { player, token };
  }

  async registerBot(params: {
    tid: string;
    label: string;
  }): Promise<PersistedPlayer> {
    const { tid, label } = params;
    const tournament = await this.mustGet(tid);
    const playersKey = RedisKeys.tournamentPlayers(tid);
    const botsKey = RedisKeys.tournamentBots(tid);

    const provisionalToken = `bot:${label}`;
    const player = await this.players.create({
      tournamentId: tid,
      name: label,
      company: "CPU",
      isBot: true,
      token: provisionalToken,
    });

    await this.redis.pipelineTx((m) => {
      m.sadd(playersKey, player.id);
      m.expire(playersKey, TOURNAMENT_TTL_SECONDS);
      m.sadd(botsKey, player.id);
      m.expire(botsKey, TOURNAMENT_TTL_SECONDS);
    });

    // Bots no participan del cupo humano, pero loggeamos por si hay algo raro.
    if (
      tournament.cupoMax > 0 &&
      (await this.redis.client.scard(playersKey)) > tournament.cupoMax + 16
    ) {
      this.logger.warn(`tournament ${tid} has more bots than expected`);
    }
    return player;
  }

  async setChampion(tid: string, championId: string): Promise<void> {
    await this.redis.mutateJson<PersistedTournament>(
      RedisKeys.tournament(tid),
      (cur) => {
        if (!cur) return null;
        return { next: { ...cur, championId }, result: { ...cur, championId } };
      },
      { ttlSeconds: TOURNAMENT_TTL_SECONDS },
    );
  }

  async toSummary(tournament: PersistedTournament): Promise<TournamentSummary> {
    return {
      id: tournament.id,
      name: tournament.name,
      status: tournament.status,
      cupoMax: tournament.cupoMax,
      matchDuration: tournament.matchDuration,
      cardsPerPlayer: tournament.cardsPerPlayer,
    };
  }
}
