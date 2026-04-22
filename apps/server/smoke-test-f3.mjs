/**
 * Smoke test Fase 3 — Motor de torneo
 *
 * Cubre:
 *   1. admin:reset → estado limpio
 *   2. Registro de 2 jugadores
 *   3. admin:start_tournament → bracket size=2
 *   4. bracket:updated (round 0, match live, ambos slots llenos)
 *   5. match:starting para ambos jugadores
 *   6. A abandona (match:leave) → match:ended rápido
 *   7. bracket:updated con winnerId
 *   8. tournament:finished (bracket de 2 → 1 partida = torneo completo)
 *   9. admin:open_registration → registration_open
 *
 * Requiere: server corriendo en PORT=4000 con Redis.
 */

import { randomUUID } from "node:crypto";
import { io } from "socket.io-client";

const URL = "http://localhost:4000";
const TID = process.env.BOOTSTRAP_TOURNAMENT_ID ?? "t-default";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "dev-admin-token";

let passed = 0;
let failed = 0;

function assert(label, value) {
  if (value) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

function waitFor(socket, event, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout waiting for '${event}'`));
    }, timeoutMs);
    function handler(data) {
      clearTimeout(t);
      resolve(data);
    }
    socket.once(event, handler);
  });
}

function emitAck(socket, event, payload, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout on ack '${event}'`)), timeoutMs);
    socket.emit(event, payload, (response) => {
      clearTimeout(t);
      resolve(response);
    });
  });
}

async function connectAdmin() {
  const sock = io(URL, {
    auth: { mode: "admin", token: ADMIN_TOKEN },
    transports: ["websocket"],
    forceNew: true,
  });
  await new Promise((res, rej) => {
    sock.on("connect", res);
    sock.on("connect_error", rej);
    setTimeout(() => rej(new Error("admin connect timeout")), 5_000);
  });
  return sock;
}

async function connectPlayer(name) {
  const sock = io(URL, {
    auth: { mode: "player" },
    transports: ["websocket"],
    forceNew: true,
  });
  await new Promise((res, rej) => {
    sock.on("connect", res);
    sock.on("connect_error", rej);
    setTimeout(() => rej(new Error("connect timeout")), 5_000);
  });
  const joinAck = await emitAck(sock, "player:join", {
    msgId: randomUUID(),
    tournamentId: TID,
    name,
    company: "TestCo",
  });
  if (!joinAck.ok) throw new Error(`player:join failed: ${JSON.stringify(joinAck)}`);
  return { sock, playerId: joinAck.playerId, token: joinAck.token };
}

async function main() {
  console.log("\n=== Smoke Test Fase 3 ===\n");

  // ──────────────────────────────────────────────────────────────
  // 0. Conectar admin y hacer reset inicial para garantizar estado limpio
  // ──────────────────────────────────────────────────────────────
  const admin = await connectAdmin();

  console.log("[0] admin:reset (estado limpio)");
  const resetAck0 = await emitAck(admin, "admin:reset", { msgId: randomUUID(), tournamentId: TID });
  assert("reset inicial ok", resetAck0?.ok === true);

  // ──────────────────────────────────────────────────────────────
  // 1. Registrar 2 jugadores
  // ──────────────────────────────────────────────────────────────
  const suffix = Date.now();
  const { sock: sockA, playerId: pidA } = await connectPlayer(`Alice-${suffix}`);
  const { sock: sockB, playerId: pidB } = await connectPlayer(`Bob-${suffix}`);
  console.log(`\nPlayers: A=${pidA}, B=${pidB}`);

  // ──────────────────────────────────────────────────────────────
  // 2. Escuchar eventos ANTES de disparar start_tournament
  // ──────────────────────────────────────────────────────────────
  const bracketUpdatedP = waitFor(sockA, "bracket:updated");
  const matchStartingAP = waitFor(sockA, "match:starting");
  const matchStartingBP = waitFor(sockB, "match:starting");

  // ──────────────────────────────────────────────────────────────
  // 3. admin:start_tournament
  // ──────────────────────────────────────────────────────────────
  console.log("\n[1] admin:start_tournament");
  let startAck;
  try {
    startAck = await emitAck(
      admin,
      "admin:start_tournament",
      {
        msgId: randomUUID(),
        tournamentId: TID,
      },
      15_000,
    );
  } catch (e) {
    console.error("  ✗ start_tournament timeout:", e.message);
    process.exit(1);
  }
  assert("start_tournament ack ok", startAck?.ok === true);
  assert("bracketSize = 2 (2 humans, potencia de 2)", startAck?.bracketSize === 2);

  // ──────────────────────────────────────────────────────────────
  // 4. bracket:updated
  // ──────────────────────────────────────────────────────────────
  console.log("\n[2] bracket:updated (ronda 0)");
  let bracketEvt;
  try {
    bracketEvt = await bracketUpdatedP;
  } catch (e) {
    console.error("  ✗ bracket:updated timeout:", e.message);
    process.exit(1);
  }
  assert("bracket:updated recibido", !!bracketEvt);
  assert("bracket.size = 2", bracketEvt?.bracket?.size === 2);
  const r0match = bracketEvt?.bracket?.rounds?.[0]?.matches?.[0];
  assert("match[0] slotA presente", !!r0match?.slotA);
  assert("match[0] slotB presente", !!r0match?.slotB);
  assert("match[0] status = live", r0match?.status === "live");

  // ──────────────────────────────────────────────────────────────
  // 5. match:starting para ambos jugadores
  // ──────────────────────────────────────────────────────────────
  console.log("\n[3] match:starting para A y B");
  let msA;
  let msB;
  try {
    [msA, msB] = await Promise.all([matchStartingAP, matchStartingBP]);
  } catch (e) {
    console.error("  ✗ match:starting timeout:", e.message);
    process.exit(1);
  }
  assert("A recibe match:starting", !!msA?.matchId);
  assert("B recibe match:starting", !!msB?.matchId);
  assert("mismo matchId en A y B", msA?.matchId === msB?.matchId);

  const matchId = msA.matchId;

  // ──────────────────────────────────────────────────────────────
  // 6. A abandona → match:ended inmediato
  // ──────────────────────────────────────────────────────────────
  console.log("\n[4] A abandona (match:leave) → match:ended rápido");
  const matchEndedP = waitFor(sockA, "match:ended", 15_000);
  const bracketUpdated2P = waitFor(sockA, "bracket:updated", 15_000);
  const tournamentFinishedP = waitFor(sockA, "tournament:finished", 15_000);

  // Esperar round:started para tener matchId confirmado antes del leave
  try {
    await waitFor(sockA, "round:started", 10_000);
  } catch (_) {
    /* continua si no llega */
  }

  const leaveAck = await emitAck(sockA, "match:leave", { msgId: randomUUID(), matchId }, 10_000);
  assert("match:leave ack ok", leaveAck?.ok === true);

  let matchEndedEvt;
  try {
    matchEndedEvt = await matchEndedP;
  } catch (e) {
    console.error("  ✗ match:ended timeout:", e.message);
    process.exit(1);
  }
  assert("match:ended recibido", !!matchEndedEvt?.matchId);
  assert("match:ended.matchId correcto", matchEndedEvt?.matchId === matchId);
  assert("match:ended.winnerId = B (A abandonó)", matchEndedEvt?.winnerId === pidB);
  assert("match:ended.reason = abandoned", matchEndedEvt?.reason === "abandoned");

  // ──────────────────────────────────────────────────────────────
  // 7. bracket:updated con ganador
  // ──────────────────────────────────────────────────────────────
  console.log("\n[5] bracket:updated tras fin de partida");
  let bracketEvt2;
  try {
    bracketEvt2 = await bracketUpdated2P;
  } catch (e) {
    console.error("  ✗ bracket:updated (2) timeout:", e.message);
    process.exit(1);
  }
  const r0matchAfter = bracketEvt2?.bracket?.rounds?.[0]?.matches?.[0];
  assert("match[0] status = finished", r0matchAfter?.status === "finished");
  assert("match[0].winnerId = B", r0matchAfter?.winnerId === pidB);

  // ──────────────────────────────────────────────────────────────
  // 8. tournament:finished (bracket de 2 jugadores = 1 ronda = campeón)
  // ──────────────────────────────────────────────────────────────
  console.log("\n[6] tournament:finished");
  let finishedEvt;
  try {
    finishedEvt = await tournamentFinishedP;
  } catch (e) {
    console.error("  ✗ tournament:finished timeout:", e.message);
    process.exit(1);
  }
  assert("tournament:finished recibido", !!finishedEvt?.championId);
  assert("champion = B (ganó el único match)", finishedEvt?.championId === pidB);

  // ──────────────────────────────────────────────────────────────
  // 9. admin:reset + admin:open_registration
  // ──────────────────────────────────────────────────────────────
  console.log("\n[7] admin:reset + admin:open_registration");
  const resetAck = await emitAck(admin, "admin:reset", { msgId: randomUUID(), tournamentId: TID });
  assert("admin:reset ok", resetAck?.ok === true);

  const openAck = await emitAck(admin, "admin:open_registration", {
    msgId: randomUUID(),
    tournamentId: TID,
  });
  assert("admin:open_registration ok", openAck?.ok === true);

  // ──────────────────────────────────────────────────────────────
  // Resumen
  // ──────────────────────────────────────────────────────────────
  console.log(`\n=== Resultado: ${passed}/${passed + failed} assertions passed ===\n`);

  sockA.disconnect();
  sockB.disconnect();
  admin.disconnect();

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
