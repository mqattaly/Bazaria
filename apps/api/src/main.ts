import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  configureApp(app);

  await app.listen(env.apiPort, env.apiHost);
  new Logger('bootstrap').log(
    `API listening on ${env.apiHost}:${env.apiPort} (env=${env.nodeEnv})`,
  );
}

void bootstrap();
