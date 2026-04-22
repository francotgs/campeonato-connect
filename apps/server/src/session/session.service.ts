import type { AuthMode } from "@campeonato/domain";
import { Injectable, Logger } from "@nestjs/common";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { GameError } from "../common/game-error";
import { ConfigService } from "../config/config.service";

const tokenPayloadSchema = z.object({
  playerId: z.string().min(1),
  tournamentId: z.string().min(1),
  mode: z.enum(["player", "admin", "viewer"]),
});

export type SessionTokenPayload = z.infer<typeof tokenPayloadSchema>;

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(private readonly config: ConfigService) {}

  sign(payload: SessionTokenPayload): string {
    const secret = this.config.get("JWT_SECRET");
    const options: SignOptions = { expiresIn: "6h", issuer: "campeonato-connect" };
    return jwt.sign(payload, secret, options);
  }

  verify(token: string): SessionTokenPayload {
    const secret = this.config.get("JWT_SECRET");
    let decoded: JwtPayload | string;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      this.logger.debug(`JWT verification failed: ${(err as Error).message}`);
      throw new GameError("UNAUTHORIZED", "invalid or expired token");
    }
    if (typeof decoded === "string") {
      throw new GameError("UNAUTHORIZED", "invalid token payload");
    }
    const parsed = tokenPayloadSchema.safeParse(decoded);
    if (!parsed.success) {
      throw new GameError("UNAUTHORIZED", "token payload shape mismatch");
    }
    return parsed.data;
  }

  /**
   * Valida el token del admin por comparación directa contra la env
   * `ADMIN_TOKEN`. Los admins no usan JWT (§17.3): acceden con un token
   * estático rotado en cada evento.
   */
  validateAdminToken(token: string | null | undefined): void {
    const expected = this.config.get("ADMIN_TOKEN");
    if (!token || token !== expected) {
      throw new GameError("UNAUTHORIZED", "admin token missing or invalid");
    }
  }

  issueForPlayer(playerId: string, tournamentId: string, mode: AuthMode = "player"): string {
    return this.sign({ playerId, tournamentId, mode });
  }
}
