"use client";

import { io, type Socket } from "socket.io-client";

let _socket: Socket | null = null;

/**
 * Retorna el singleton de Socket.IO para el cliente del jugador.
 * Se conecta automáticamente si todavía no lo hizo.
 *
 * Debe llamarse solo en el browser (cliente).
 */
export function getSocket(): Socket {
  if (!_socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";
    const token =
      typeof window !== "undefined" ? localStorage.getItem("4match:token") : null;

    _socket = io(url, {
      auth: { mode: "player", token: token ?? null },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }
  return _socket;
}

/** Actualiza el token de autenticación y reconecta. */
export function updateSocketAuth(token: string): void {
  const socket = _socket;
  if (!socket) return;
  socket.auth = { mode: "player", token };
  if (!socket.connected) socket.connect();
}

/** Desconecta y destruye el singleton (útil para resetear entre tests). */
export function destroySocket(): void {
  _socket?.disconnect();
  _socket = null;
}
