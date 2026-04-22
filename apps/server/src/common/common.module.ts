import { Global, Module } from "@nestjs/common";
import { ClockService } from "./clock.service";
import { IdService } from "./id.service";
import { IoRuntimeService } from "./io-runtime.service";

@Global()
@Module({
  providers: [ClockService, IdService, IoRuntimeService],
  exports: [ClockService, IdService, IoRuntimeService],
})
export class CommonModule {}
