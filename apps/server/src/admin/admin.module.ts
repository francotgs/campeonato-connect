import { Module } from "@nestjs/common";
import { BotModule } from "../bot/bot.module";
import { MatchModule } from "../match/match.module";
import { AdminGateway } from "./admin.gateway";

@Module({
  imports: [MatchModule, BotModule],
  providers: [AdminGateway],
})
export class AdminModule {}
