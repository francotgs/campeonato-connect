import { loadCatalog } from "@campeonato/cards";
import type { Card, CardId } from "@campeonato/domain";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly logger = new Logger(CatalogService.name);
  private cards: Card[] = [];
  private byId = new Map<CardId, Card>();

  onModuleInit(): void {
    this.cards = [...loadCatalog()];
    for (const c of this.cards) this.byId.set(c.id, c);
    this.logger.log(`Loaded ${this.cards.length} cards in catalog`);
  }

  all(): readonly Card[] {
    return this.cards;
  }

  mustGet(id: CardId): Card {
    const card = this.byId.get(id);
    if (!card) throw new Error(`card ${id} not found in catalog`);
    return card;
  }
}
