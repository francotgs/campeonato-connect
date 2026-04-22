import { Module } from "@nestjs/common";
import { PlayerService } from "./player.service";
import { TournamentGateway } from "./tournament.gateway";
import { TournamentService } from "./tournament.service";

@Module({
  providers: [TournamentService, PlayerService, TournamentGateway],
  exports: [TournamentService, PlayerService, TournamentGateway],
})
export class TournamentModule {}
