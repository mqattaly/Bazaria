import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from './db/database.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { CompanyModule } from './company/company.module';
import { MembershipModule } from './membership/membership.module';
import { PlatformModule } from './platform/platform.module';
import { StoreModule } from './store/store.module';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { RequestPipelineInterceptor } from './common/request-pipeline.interceptor';
import { ResponseEnvelopeInterceptor } from './common/response-envelope.interceptor';
import { ApiExceptionFilter } from './common/api-exception.filter';

@Module({
  imports: [
    DatabaseModule,
    CommonModule,
    AuthModule,
    CompanyModule,
    MembershipModule,
    PlatformModule,
    StoreModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: RequestPipelineInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
