"use client";

import { getSocket } from "@/lib/socket";
import { useGameStore } from "@/lib/store";
import { SERVER_EVENTS } from "@campeonato/domain";
import { useEffect, useRef } from "react";

/**
 * Monta el cliente Socket.IO y registra todos los handlers de eventos del
 * servidor contra el store de Zustand. Debe montarse una sola vez (en el
 * layout de /play).
 *
 * Retorna el socket para que los componentes puedan emitir eventos.
 */
export function useSocket() {
  const store = useGameStore();
  const registered = useRef(false);

  useEffect(() => {
    const socket = getSocket();

    if (!registered.current) {
      registered.current = true;

      socket.on("connect", () => {
        store.setSocketError(null);
      });

      socket.on("disconnect", (reason) => {
        if (reason === "io server disconnect") {
          // El servidor cerró la conexión deliberadamente (ej: takeover)
          store.setSocketError("Sesión cerrada por el servidor.");
        }
      });

      socket.on("connect_error", (err) => {
        store.setSocketError(`Error de conexión: ${err.message}`);
      });

      socket.on(SERVER_EVENTS.TOURNAMENT_STATE, (data) => {
        store.onTournamentState(data as Parameters<typeof store.onTournamentState>[0]);
      });

      socket.on(SERVER_EVENTS.TOURNAMENT_RESET, () => {
        // El admin reseteó el torneo: nuestra sesión ya no es válida en el server.
        // Limpiamos auth local y redirigimos al join del mismo torneo.
        const tid = localStorage.getItem("4match:tournamentId") ?? "t-default";
        store.clearAuth();
        if (typeof window !== "undefined") {
          // Usamos replace para no mantener la ruta /play en el historial.
          window.location.replace(`/join/${tid}`);
        }
      });

      socket.on(SERVER_EVENTS.MATCH_STARTING, (data) => {
        store.onMatchStarting(data as Parameters<typeof store.onMatchStarting>[0]);
      });

      socket.on(SERVER_EVENTS.MATCH_STARTED, (data) => {
        store.onMatchStarted(data as Parameters<typeof store.onMatchStarted>[0]);
      });

      socket.on(SERVER_EVENTS.ROUND_STARTED, (data) => {
        store.onRoundStarted(data as Parameters<typeof store.onRoundStarted>[0]);
      });

      socket.on(SERVER_EVENTS.ROUND_ATTRIBUTE_CHOSEN, (data) => {
        store.onRoundAttributeChosen(data as Parameters<typeof store.onRoundAttributeChosen>[0]);
      });

      socket.on(SERVER_EVENTS.ROUND_RESULT, (data) => {
        store.onRoundResult(data as Parameters<typeof store.onRoundResult>[0]);
      });

      socket.on(SERVER_EVENTS.MATCH_TIEBREAKER_STARTED, (data) => {
        store.onMatchTiebreakerStarted(
          data as Parameters<typeof store.onMatchTiebreakerStarted>[0],
        );
      });

      socket.on(SERVER_EVENTS.MATCH_ENDED, (data) => {
        store.onMatchEnded(data as Parameters<typeof store.onMatchEnded>[0]);
      });

      socket.on(SERVER_EVENTS.PLAYER_WAITING_NEXT, (data) => {
        store.onPlayerWaitingNext(data as Parameters<typeof store.onPlayerWaitingNext>[0]);
      });

      socket.on(SERVER_EVENTS.PLAYER_ELIMINATED, (data) => {
        store.onPlayerEliminated(data as Parameters<typeof store.onPlayerEliminated>[0]);
      });

      socket.on(SERVER_EVENTS.TOURNAMENT_FINISHED, (data) => {
        store.onTournamentFinished(data as Parameters<typeof store.onTournamentFinished>[0]);
      });

      socket.on(SERVER_EVENTS.ERROR, (data) => {
        const msg = (data as { message?: string })?.message ?? "Error desconocido";
        store.setSocketError(msg);
      });
    }

    return () => {
      // No desconectamos aquí para mantener la sesión durante la vida de la app.
      // El socket se destruye solo si el usuario limpia auth o cierra la página.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return getSocket();
}
