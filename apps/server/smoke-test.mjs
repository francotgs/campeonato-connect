/**
 * Smoke test Fase 2 — dos jugadores humanos + admin dispara el duelo.
 * Corre con: node apps/server/smoke-test.mjs
 */
import { randomUUID } from "crypto";
import { io } from "socket.io-client";

const BASE = "http://localhost:4000";
const TOURNAMENT_ID = "t-default";
const ADMIN_TOKEN = "dev-admin-token";

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ ${msg}`);
    failed++;
  }
}

function connect(mode, token) {
  return io(BASE, {
    auth: { token, mode, tournamentId: TOURNAMENT_ID },
    transports: ["websocket"],
    reconnection: false,
  });
}

/** Emite y espera el ack del servidor (NestJS devuelve el resultado via callback). */
function emitAck(socket, event, payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout on ack '${event}'`)), timeoutMs);
    socket.emit(event, payload, (response) => {
      clearTimeout(timer);
      if (response && response.code) {
        reject(new Error(`Server error on '${event}': ${JSON.stringify(response)}`));
      } else {
        resolve(response);
      }
    });
  });
}

/** Espera el próximo evento del nombre indicado. Hay que llamarla ANTES de que se emita. */
function waitFor(socket, event, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for '${event}'`)), timeoutMs);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function waitConnect(socket) {
  return new Promise((res, rej) => {
    socket.once("connect", res);
    socket.once("connect_error", (err) => rej(new Error(`connect_error: ${err.message}`)));
  });
}

async function run() {
  console.log("\n=== Smoke test Fase 2 ===\n");
  const ts = Date.now();

  // ── 1. Conectar admin y jugadores ──────────────────────────────────────
  console.log("1. Conectando admin y jugadores...");
  const admin = connect("admin", ADMIN_TOKEN);
  const playerA = connect("player", null);
  const playerB = connect("player", null);
  await Promise.all([waitConnect(admin), waitConnect(playerA), waitConnect(playerB)]);
  assert(admin.connected && playerA.connected && playerB.connected, "admin + A + B conectados");

  // ── 2. Registrar jugadores ──────────────────────────────────────────────
  console.log("2. Registrando jugadores...");
  const joinA = await emitAck(playerA, "player:join", {
    msgId: randomUUID(),
    tournamentId: TOURNAMENT_ID,
    name: `Alice-${ts}`,
    company: "CEDI",
  });
  assert(joinA.ok === true && joinA.playerId && joinA.token, "A registrado con token+playerId");
  const pidA = joinA.playerId;
  const tokenA = joinA.token;

  const joinB = await emitAck(playerB, "player:join", {
    msgId: randomUUID(),
    tournamentId: TOURNAMENT_ID,
    name: `Bob-${ts}`,
    company: "CEDI",
  });
  assert(joinB.ok === true && joinB.playerId && joinB.token, "B registrado con token+playerId");
  const pidB = joinB.playerId;
  const tokenB = joinB.token;

  // ── 3. Preparar listeners ANTES de disparar el duelo ───────────────────
  console.log("3. Armando listeners + disparando duelo...");
  // Los eventos de partida llegan antes o junto con el ack del duel,
  // por eso hay que registrar los listeners primero.
  const [startA, startB] = await Promise.all([
    waitFor(playerA, "match:starting"),
    waitFor(playerB, "match:starting"),
    emitAck(
      admin,
      "admin:debug_start_duel",
      {
        msgId: randomUUID(),
        tournamentId: TOURNAMENT_ID,
        player0Id: pidA,
        player1Id: pidB,
      },
      10000,
    ),
  ]);

  assert(startA.matchId, `A recibe match:starting matchId=${startA.matchId}`);
  assert(startB.matchId, `B recibe match:starting matchId=${startB.matchId}`);
  assert(startA.matchId === startB.matchId, "ambos reciben el mismo matchId");
  const matchId = startA.matchId;
  console.log(`   matchId = ${matchId}`);

  // ── 4. round:started ───────────────────────────────────────────────────
  console.log("4. Esperando round:started...");
  const [roundA, roundB] = await Promise.all([
    waitFor(playerA, "round:started"),
    waitFor(playerB, "round:started"),
  ]);
  assert(roundA.roundNumber === 1, `A ronda ${roundA.roundNumber}`);
  assert(roundB.roundNumber === 1, `B ronda ${roundB.roundNumber}`);
  // chooser es 0 o 1 (slot), no un playerId
  assert(roundA.chooser === 0 || roundA.chooser === 1, `chooser válido: ${roundA.chooser}`);
  assert(roundA.myCurrentCard?.id, `A tiene carta top: ${roundA.myCurrentCard?.id}`);
  const chooserSlot = roundA.chooser; // 0 = pidA, 1 = pidB
  console.log(`   chooser = slot ${chooserSlot} (${chooserSlot === 0 ? pidA : pidB})`);

  // ── 5. El chooser elige un atributo ────────────────────────────────────
  console.log("5. El chooser elige un atributo...");
  const chooserToken = chooserSlot === 0 ? tokenA : tokenB;
  const chooserRound = chooserSlot === 0 ? roundA : roundB;
  const topCard = chooserRound.myCurrentCard;
  const attrs = Object.keys(topCard.attributes ?? {});
  const pickedAttr = attrs[0];
  assert(pickedAttr, `atributo a elegir: ${pickedAttr}`);

  // El chooser reconecta autenticado en un socket fresco para enviar el pick
  const chooserAuth = connect("player", chooserToken);
  await waitConnect(chooserAuth);
  await emitAck(chooserAuth, "player:reconnect", { msgId: randomUUID(), token: chooserToken });

  // Prepara listener de resultado ANTES del pick
  const [resA, resB, pickAck] = await Promise.all([
    waitFor(playerA, "round:result"),
    waitFor(playerB, "round:result"),
    emitAck(chooserAuth, "match:pick_attribute", {
      msgId: randomUUID(),
      matchId,
      roundNumber: 1,
      attribute: pickedAttr,
    }),
  ]);

  assert(pickAck.ok === true, `pick ack ok (attr=${pickedAttr})`);
  assert(resA.attribute === pickedAttr, `A ve atributo elegido: ${resA.attribute}`);
  assert(["you", "opponent", "tie"].includes(resA.winner), `A winner válido: ${resA.winner}`);
  assert(["you", "opponent", "tie"].includes(resB.winner), `B winner válido: ${resB.winner}`);
  assert(typeof resA.yourDeckSize === "number", `A yourDeckSize: ${resA.yourDeckSize}`);
  console.log(`   Ronda 1 → A: ${resA.winner}, B: ${resB.winner} | attr=${pickedAttr}`);

  // ── Cleanup ─────────────────────────────────────────────────────────────
  admin.disconnect();
  playerA.disconnect();
  playerB.disconnect();
  chooserAuth.disconnect();

  console.log(`\n=== Resultado: ${passed} ✅  ${failed} ❌ ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("\n💥 Error inesperado:", err.message);
  process.exit(1);
});
