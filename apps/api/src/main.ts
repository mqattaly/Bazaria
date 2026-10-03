import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  configureApp(app, config.getOrThrow<string>('WEB_ORIGIN'));
  app.enableShutdownHooks();
  await app.listen(config.getOrThrow<number>('API_PORT'), '0.0.0.0');
}

void bootstrap();
