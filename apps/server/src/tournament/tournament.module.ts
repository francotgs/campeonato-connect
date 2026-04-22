import { Module } from "@nestjs/common";
import { PlayerService } from "./player.service";
import { TournamentController } from "./tournament.controller";
import { TournamentGateway } from "./tournament.gateway";
import { TournamentService } from "./tournament.service";

@Module({
  controllers: [TournamentController],
  providers: [TournamentService, PlayerService, TournamentGateway],
  exports: [TournamentService, PlayerService, TournamentGateway],
})
export class TournamentModule {}
