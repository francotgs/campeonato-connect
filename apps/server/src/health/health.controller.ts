import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check(): { ok: true; ts: number; service: "campeonato-server" } {
    return { ok: true, ts: Date.now(), service: "campeonato-server" };
  }
}
