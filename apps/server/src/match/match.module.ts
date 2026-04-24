import { Module } from "@nestjs/common";
import { BotModule } from "../bot/bot.module";
import { SessionModule } from "../session/session.module";
import { TournamentModule } from "../tournament/tournament.module";
import { CatalogService } from "./catalog.service";
import { MATCH_EMITTER } from "./match-emitter";
import { MatchEmitterService } from "./match-emitter.service";
import { MatchEngineService } from "./match-engine.service";
import { MatchEventService } from "./match-event.service";
import { MatchGateway } from "./match.gateway";
import { PracticeGateway } from "./practice.gateway";

@Module({
  imports: [TournamentModule, BotModule, SessionModule],
  providers: [
    CatalogService,
    MatchEmitterService,
    { provide: MATCH_EMITTER, useExisting: MatchEmitterService },
    MatchEventService,
    MatchEngineService,
    MatchGateway,
    PracticeGateway,
  ],
  exports: [MatchEngineService, MatchEventService, CatalogService],
})
export class MatchModule {}
