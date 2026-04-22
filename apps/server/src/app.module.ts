import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { AdminModule } from "./admin/admin.module";
import { BotModule } from "./bot/bot.module";
import { BracketModule } from "./bracket/bracket.module";
import { CommonModule } from "./common/common.module";
import { ConfigModule } from "./config/config.module";
import { ConfigService } from "./config/config.service";
import { HealthModule } from "./health/health.module";
import { MatchModule } from "./match/match.module";
import { RedisModule } from "./redis/redis.module";
import { SessionModule } from "./session/session.module";
import { TournamentModule } from "./tournament/tournament.module";

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get("LOG_LEVEL"),
          transport: config.isProduction()
            ? undefined
            : {
                target: "pino-pretty",
                options: { singleLine: true, translateTime: "SYS:HH:MM:ss.l" },
              },
        },
      }),
    }),
    RedisModule,
    SessionModule,
    TournamentModule,
    BotModule,
    MatchModule,
    BracketModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {}
