import { Global, Logger, Module } from "@nestjs/common";
import Redis from "ioredis";
import { ConfigService } from "../config/config.service";
import { REDIS_CLIENT, RedisService } from "./redis.service";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const url = config.get("REDIS_URL");
        const logger = new Logger("Redis");
        const client = new Redis(url, {
          // Intentar reconectar agresivamente durante los primeros minutos:
          // si el server arranca antes que Redis, queremos auto-recover.
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          lazyConnect: false,
          retryStrategy: (times) => Math.min(times * 200, 2_000),
        });
        client.on("error", (err) => logger.error(`Redis error: ${err.message}`));
        client.on("connect", () => logger.log(`connecting to ${redactUrl(url)}`));
        client.on("ready", () => logger.log("connected and ready"));
        client.on("reconnecting", (delay: number) => logger.warn(`reconnecting in ${delay}ms`));
        return client;
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}

function redactUrl(url: string): string {
  return url.replace(/:[^:@/]+@/, ":***@");
}
