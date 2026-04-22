import type { ErrorCode } from "@campeonato/domain";

export class GameError extends Error {
  readonly code: ErrorCode;
  readonly msgId?: string;

  constructor(code: ErrorCode, message: string, msgId?: string) {
    super(message);
    this.name = "GameError";
    this.code = code;
    if (msgId !== undefined) {
      this.msgId = msgId;
    }
  }
}
