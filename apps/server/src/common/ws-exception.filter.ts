import { SERVER_EVENTS } from "@campeonato/domain";
import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from "@nestjs/common";
import type { Socket } from "socket.io";
import { ZodError } from "zod";
import { GameError } from "./game-error";

/**
 * Atrapa errores salientes de handlers de gateway y los traduce a un evento
 * WS `error` estructurado con `code`/`message` (§13.5). No termina la
 * conexión: el cliente decide cómo reaccionar.
 */
@Catch()
export class WsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    // El filtro está registrado global y puede recibir excepciones de HTTP.
    // En ese caso, re-lanzamos para que Nest las maneje con su filter HTTP
    // por defecto (traduce NotFoundException → 404, etc.).
    if (host.getType() !== "ws") {
      throw exception;
    }

    const client = host.switchToWs().getClient<Socket>();
    const data = host.switchToWs().getData<{ msgId?: string } | undefined>();

    if (exception instanceof GameError) {
      client.emit(SERVER_EVENTS.ERROR, {
        code: exception.code,
        message: exception.message,
        msgId: exception.msgId ?? data?.msgId,
      });
      this.logger.debug(
        `GameError code=${exception.code} msg="${exception.message}" socket=${client.id}`,
      );
      return;
    }

    if (exception instanceof ZodError) {
      client.emit(SERVER_EVENTS.ERROR, {
        code: "INVALID_PAYLOAD",
        message: exception.issues
          .map(
            (issue: { path: (string | number)[]; message: string }) =>
              `${issue.path.join(".")}: ${issue.message}`,
          )
          .join("; "),
        msgId: data?.msgId,
      });
      return;
    }

    const err = exception instanceof Error ? exception : null;
    const message = err ? err.message : "unexpected error";
    this.logger.error(`Unhandled exception in gateway: ${message}`, err?.stack);
    client.emit(SERVER_EVENTS.ERROR, {
      code: "INTERNAL",
      message: "internal server error",
      msgId: data?.msgId,
    });
  }
}
