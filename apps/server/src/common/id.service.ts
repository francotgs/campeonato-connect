import { Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";

/**
 * Genera UUIDs con `uuid` (§10.3). Abstrae para que los tests puedan
 * sustituir una implementación determinista.
 */
@Injectable()
export class IdService {
  uuid(): string {
    return uuidv4();
  }

  matchId(): string {
    return `m-${this.uuid()}`;
  }

  playerId(): string {
    return `p-${this.uuid()}`;
  }
}
