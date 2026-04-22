import { Injectable, Logger } from "@nestjs/common";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  ADMIN_TOKEN: z.string().min(8, "ADMIN_TOKEN must be at least 8 chars"),
  MATCH_DURATION_SECONDS: z.coerce.number().int().positive().default(120),
  CARDS_PER_PLAYER: z.coerce.number().int().positive().default(15),
  TURN_PICK_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(10),
  RECONNECT_GRACE_SECONDS: z.coerce.number().int().positive().default(30),
  MATCH_STALL_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(15),
  BOOTSTRAP_TOURNAMENT_ID: z.string().min(1).default("t-default"),
  BOOTSTRAP_TOURNAMENT_NAME: z.string().min(1).default("Campeonato MundIAl 4Match"),
  BOOTSTRAP_CUPO_MAX: z.coerce.number().int().positive().default(256),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
});

export type ServerEnv = z.infer<typeof envSchema>;

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private readonly env: ServerEnv;

  constructor() {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      this.logger.error("Invalid environment configuration", parsed.error.format());
      throw new Error(
        `Invalid environment configuration:\n${parsed.error.issues
          .map(
            (issue: { path: (string | number)[]; message: string }) =>
              `  - ${issue.path.join(".")}: ${issue.message}`,
          )
          .join("\n")}`,
      );
    }
    this.env = parsed.data;
  }

  get<K extends keyof ServerEnv>(key: K): ServerEnv[K] {
    return this.env[key];
  }

  isProduction(): boolean {
    return this.env.NODE_ENV === "production";
  }

  snapshot(): Readonly<ServerEnv> {
    return this.env;
  }
}
