import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { createValidationPipe } from './common/validation';
import { env } from './config/env';

/**
 * Shared HTTP configuration for production bootstrap and integration tests, so
 * tests exercise the same envelope, validation and security middleware.
 */
export function configureApp(app: INestApplication): void {
  if (env.trustProxy) {
    const value = Number.parseInt(env.trustProxy, 10);
    app
      .getHttpAdapter()
      .getInstance()
      .set('trust proxy', Number.isFinite(value) ? value : env.trustProxy);
  }
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();
}
