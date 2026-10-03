import { ValidationPipe, type INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';

export function configureApp(app: INestApplication, webOrigin: string): void {
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({
    origin: webOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
}
