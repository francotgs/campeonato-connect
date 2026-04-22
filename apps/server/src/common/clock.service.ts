import { Injectable } from "@nestjs/common";

/**
 * Abstracción sobre `Date.now()` para hacer deterministas los tests de
 * integración cuando los agreguemos (Fase 8). En producción delega a Date.
 */
@Injectable()
export class ClockService {
  now(): number {
    return Date.now();
  }
}
