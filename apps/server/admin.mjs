import { io } from "socket.io-client";
import { randomUUID } from "crypto";

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? "dev-admin-token";
const TID = process.env.BOOTSTRAP_TOURNAMENT_ID ?? "t-default";
const URL = "http://localhost:4000";

const cmd = process.argv[2] ?? "start";
const payload = (extra = {}) => ({ msgId: randomUUID(), tournamentId: TID, ...extra });

const s = io(URL, {
  auth: { mode: "admin", token: ADMIN_TOKEN, tournamentId: TID },
  transports: ["websocket"],
});

s.on("error", (e) => console.error("❌ Error:", e));

s.on("connect", () => {
  console.log("✅ Conectado como admin");

  if (cmd === "reset") {
    s.emit("admin:reset", payload(), (ack) => {
      console.log("reset →", JSON.stringify(ack));
      s.disconnect();
    });
  } else if (cmd === "open") {
    s.emit("admin:open_registration", payload(), (ack) => {
      console.log("open_registration →", JSON.stringify(ack));
      s.disconnect();
    });
  } else if (cmd === "start") {
    s.emit("admin:start_tournament", payload(), (ack) => {
      console.log("start_tournament →", JSON.stringify(ack));
      s.disconnect();
    });
  } else if (cmd === "pause") {
    s.emit("admin:pause", payload(), (ack) => {
      console.log("pause →", JSON.stringify(ack));
      s.disconnect();
    });
  } else if (cmd === "resume") {
    s.emit("admin:resume", payload(), (ack) => {
      console.log("resume →", JSON.stringify(ack));
      s.disconnect();
    });
  } else {
    console.log("Comandos: reset | open | start | pause | resume");
    s.disconnect();
  }
});

s.on("connect_error", (e) => {
  console.error("❌ Error de conexión:", e.message);
  process.exit(1);
});
