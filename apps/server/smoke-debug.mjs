/**
 * Debug rápido: registra un jugador y escucha TODOS los eventos que llegan.
 */
import { randomUUID } from "crypto";
import { io } from "socket.io-client";

const BASE = "http://localhost:4000";
const TOURNAMENT_ID = "t-default";
const ADMIN_TOKEN = "dev-admin-token";

function connect(mode, token) {
  return io(BASE, {
    auth: { token, mode, tournamentId: TOURNAMENT_ID },
    transports: ["websocket"],
    reconnection: false,
  });
}

function waitConnect(socket) {
  return new Promise((res, rej) => {
    socket.once("connect", res);
    socket.once("connect_error", (err) => rej(new Error(`connect_error: ${err.message}`)));
  });
}

function emitAck(socket, event, payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout on ack '${event}'`)), timeoutMs);
    socket.emit(event, payload, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
}

async function run() {
  console.log("=== Debug: escucha de eventos ===\n");

  const admin = connect("admin", ADMIN_TOKEN);
  const pA = connect("player", null);
  const pB = connect("player", null);

  await Promise.all([waitConnect(admin), waitConnect(pA), waitConnect(pB)]);
  console.log("Conectados. IDs:", pA.id, pB.id);

  // Captura TODOS los eventos
  pA.onAny((event, ...args) => console.log(`[pA] ${event}`, JSON.stringify(args).slice(0, 200)));
  pB.onAny((event, ...args) => console.log(`[pB] ${event}`, JSON.stringify(args).slice(0, 200)));
  admin.onAny((event, ...args) =>
    console.log(`[admin] ${event}`, JSON.stringify(args).slice(0, 200)),
  );

  const ts = Date.now();
  const joinA = await emitAck(pA, "player:join", {
    msgId: randomUUID(),
    tournamentId: TOURNAMENT_ID,
    name: `Alice-${ts}`,
    company: "CEDI",
  });
  console.log("\njoinA:", JSON.stringify(joinA));

  const joinB = await emitAck(pB, "player:join", {
    msgId: randomUUID(),
    tournamentId: TOURNAMENT_ID,
    name: `Bob-${ts}`,
    company: "CEDI",
  });
  console.log("\njoinB:", JSON.stringify(joinB));

  const duel = await emitAck(
    admin,
    "admin:debug_start_duel",
    {
      msgId: randomUUID(),
      tournamentId: TOURNAMENT_ID,
      player0Id: joinA.playerId,
      player1Id: joinB.playerId,
    },
    10000,
  );
  console.log("\nduel ack:", JSON.stringify(duel));

  // Espera 8 segundos para capturar eventos
  console.log("\nEsperando 8 segundos para capturar eventos...");
  await new Promise((r) => setTimeout(r, 8000));

  admin.disconnect();
  pA.disconnect();
  pB.disconnect();
  console.log("\nFin del debug.");
}

run().catch(console.error);
