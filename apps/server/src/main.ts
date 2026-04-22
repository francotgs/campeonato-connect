import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { WsExceptionFilter } from "./common/ws-exception.filter";
import { ConfigService } from "./config/config.service";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new WsExceptionFilter());

  const config = app.get(ConfigService);
  app.enableCors({ origin: config.get("CORS_ORIGIN"), credentials: true });
  app.enableShutdownHooks();

  const port = config.get("PORT");
  await app.listen(port, "0.0.0.0");
  app.get(Logger).log(`server listening on http://localhost:${port}`);
}

void bootstrap();
