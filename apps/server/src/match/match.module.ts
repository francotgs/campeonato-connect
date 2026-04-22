import { Module } from "@nestjs/common";
import { BotModule } from "../bot/bot.module";
import { TournamentModule } from "../tournament/tournament.module";
import { CatalogService } from "./catalog.service";
import { MATCH_EMITTER } from "./match-emitter";
import { MatchEmitterService } from "./match-emitter.service";
import { MatchEngineService } from "./match-engine.service";
import { MatchEventService } from "./match-event.service";
import { MatchGateway } from "./match.gateway";

@Module({
  imports: [TournamentModule, BotModule],
  providers: [
    CatalogService,
    MatchEmitterService,
    { provide: MATCH_EMITTER, useExisting: MatchEmitterService },
    MatchEventService,
    MatchEngineService,
    MatchGateway,
  ],
  exports: [MatchEngineService, MatchEventService, CatalogService],
})
export class MatchModule {}
