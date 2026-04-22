import { Module } from "@nestjs/common";
import { TournamentModule } from "../tournament/tournament.module";
import { BotService } from "./bot.service";

@Module({
  imports: [TournamentModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
