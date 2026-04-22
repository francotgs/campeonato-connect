import { Module } from "@nestjs/common";
import { BotModule } from "../bot/bot.module";
import { BracketModule } from "../bracket/bracket.module";
import { MatchModule } from "../match/match.module";
import { TournamentModule } from "../tournament/tournament.module";
import { AdminGateway } from "./admin.gateway";

@Module({
  imports: [MatchModule, BotModule, BracketModule, TournamentModule],
  providers: [AdminGateway],
})
export class AdminModule {}
