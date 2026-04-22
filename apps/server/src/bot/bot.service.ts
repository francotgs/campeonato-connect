import {
  type AttrKey,
  type BotMatchContext,
  type Card,
  pickBotAttribute,
} from "@campeonato/domain";
import { Injectable, Logger } from "@nestjs/common";
import type { PersistedPlayer } from "../tournament/player.service";
import { TournamentService } from "../tournament/tournament.service";

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(private readonly tournaments: TournamentService) {}

  async ensureBots(tid: string, count: number): Promise<PersistedPlayer[]> {
    const existing = await this.tournaments.listPlayerIds(tid);
    const created: PersistedPlayer[] = [];
    for (let i = 0; i < count; i++) {
      const label = `Bot ${String(existing.length + i + 1).padStart(2, "0")}`;
      const bot = await this.tournaments.registerBot({ tid, label });
      created.push(bot);
    }
    if (created.length > 0) {
      this.logger.log(`registered ${created.length} bot(s) for ${tid}`);
    }
    return created;
  }

  pickAttribute(card: Card, ctx: BotMatchContext): AttrKey {
    return pickBotAttribute(card, ctx);
  }
}
