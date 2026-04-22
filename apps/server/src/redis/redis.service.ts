import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import Redis, { type ChainableCommander } from "ioredis";

export const REDIS_CLIENT = "REDIS_CLIENT";

export type RedisClient = Redis;

export type TransactionResult<T> = { ok: true; value: T } | { ok: false; reason: "conflict" };

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  get client(): RedisClient {
    return this.redis;
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (err) {
      this.logger.warn(`Error closing Redis: ${(err as Error).message}`);
    }
  }

  // ============================================================================
  // JSON helpers
  // ============================================================================

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const payload = JSON.stringify(value);
    if (ttlSeconds !== undefined) {
      await this.redis.set(key, payload, "EX", ttlSeconds);
    } else {
      await this.redis.set(key, payload);
    }
  }

  async delete(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.redis.del(...keys);
  }

  // ============================================================================
  // WATCH/MULTI/EXEC: mutación atómica con read-modify-write seguro (§12.6)
  // ============================================================================

  /**
   * Lee la key bajo WATCH, aplica `mutator` (puede decidir abortar) y
   * persiste con MULTI/EXEC. Si otro cliente escribió entre el WATCH y el
   * EXEC, reintenta hasta `maxRetries`.
   *
   * El tipo persistido (`T`) y el tipo devuelto al llamador (`R`) pueden
   * diferir: suele venir bien devolver efectos / metadata junto con el
   * nuevo estado.
   */
  async mutateJson<T, R = T>(
    key: string,
    mutator: (
      current: T | null,
    ) => Promise<{ next: T | null; result: R } | null> | { next: T | null; result: R } | null,
    options: { ttlSeconds?: number; maxRetries?: number } = {},
  ): Promise<TransactionResult<R>> {
    const maxRetries = options.maxRetries ?? 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      await this.redis.watch(key);
      try {
        const raw = await this.redis.get(key);
        const current = raw === null ? null : (JSON.parse(raw) as T);
        const outcome = await Promise.resolve(mutator(current));
        if (outcome === null) {
          await this.redis.unwatch();
          return { ok: false, reason: "conflict" };
        }
        const multi = this.redis.multi();
        if (outcome.next === null) {
          multi.del(key);
        } else if (options.ttlSeconds !== undefined) {
          multi.set(key, JSON.stringify(outcome.next), "EX", options.ttlSeconds);
        } else {
          multi.set(key, JSON.stringify(outcome.next));
        }
        const execResult = await multi.exec();
        if (execResult === null) {
          // WATCH detectó una escritura concurrente → retry.
          continue;
        }
        return { ok: true, value: outcome.result };
      } catch (err) {
        await this.redis.unwatch().catch(() => {});
        throw err;
      }
    }
    return { ok: false, reason: "conflict" };
  }

  /**
   * Ejecuta una secuencia MULTI/EXEC simple sin WATCH. Útil para escribir
   * varias keys de forma atómica cuando no hay lecturas previas a proteger.
   */
  async pipelineTx(build: (multi: ChainableCommander) => void): Promise<void> {
    const multi = this.redis.multi();
    build(multi);
    const res = await multi.exec();
    if (res === null) {
      throw new Error("MULTI/EXEC returned null (transaction aborted)");
    }
    for (const [err] of res) {
      if (err) throw err;
    }
  }

  // ============================================================================
  // Idempotencia de msgId
  // ============================================================================

  /**
   * Registra un msgId como procesado con TTL. Devuelve `true` si era nuevo;
   * `false` si ya estaba registrado (mensaje duplicado → §14.3).
   */
  async claimMsgId(key: string, msgId: string, ttlSeconds: number): Promise<boolean> {
    const added = await this.redis.sadd(key, msgId);
    if (added === 1) {
      await this.redis.expire(key, ttlSeconds);
      return true;
    }
    return false;
  }
}
