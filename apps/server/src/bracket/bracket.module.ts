import { Module } from "@nestjs/common";
import { BotModule } from "../bot/bot.module";
import { MatchModule } from "../match/match.module";
import { TournamentModule } from "../tournament/tournament.module";
import { BracketService } from "./bracket.service";

@Module({
  imports: [MatchModule, TournamentModule, BotModule],
  providers: [BracketService],
  exports: [BracketService],
})
export class BracketModule {}
