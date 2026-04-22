import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { RedisKeys } from "../redis/redis-keys";
import { RedisService } from "../redis/redis.service";
import { PlayerService } from "./player.service";
import { TournamentService } from "./tournament.service";

export type PlayerRosterEntry = {
  name: string;
  company: string;
  isBot: boolean;
};

/**
 * Endpoints HTTP públicos de solo-lectura usados por la vista del bracket
 * para resolver playerIds → nombres de jugadores.
 */
@Controller("api/bracket")
export class TournamentController {
  constructor(
    private readonly tournaments: TournamentService,
    private readonly players: PlayerService,
    private readonly redis: RedisService,
  ) {}

  /**
   * GET /api/bracket/:tid/players
   * Retorna un mapa { [playerId]: { name, company, isBot } } con todos los
   * jugadores registrados en el torneo. Público, sin autenticación.
   */
  @Get(":tid/players")
  async getPlayers(
    @Param("tid") tid: string,
  ): Promise<{ players: Record<string, PlayerRosterEntry> }> {
    const tournament = await this.tournaments.get(tid);
    if (!tournament) throw new NotFoundException(`Tournament ${tid} not found`);

    const playerIds = await this.redis.client.smembers(RedisKeys.tournamentPlayers(tid));

    const entries = await Promise.all(
      playerIds.map(async (pid) => {
        const p = await this.players.get(pid);
        if (!p) return null;
        return [pid, { name: p.name, company: p.company, isBot: p.isBot }] as const;
      }),
    );

    const playerMap = Object.fromEntries(
      entries.filter((e): e is [string, PlayerRosterEntry] => e !== null),
    );

    return { players: playerMap };
  }

  /**
   * GET /api/bracket/:tid/bracket
   * Retorna el bracket actual del torneo (si ya fue generado).
   */
  @Get(":tid/bracket")
  async getBracket(@Param("tid") tid: string) {
    const tournament = await this.tournaments.get(tid);
    if (!tournament) throw new NotFoundException(`Tournament ${tid} not found`);

    const bracket = await this.redis.getJson(RedisKeys.tournamentBracket(tid));
    return { bracket: bracket ?? null, status: tournament.status };
  }
}
