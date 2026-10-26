import { Global, Module } from '@nestjs/common';
import { SecurityEventService } from './security-event.service';
import { AuthorizationService } from '../authz/authorization.service';
import { AuditService } from '../audit/audit.service';
import { AppLogger } from './logger.service';
import { SubscriptionService } from '../subscription/subscription.service';

@Global()
@Module({
  providers: [
    SecurityEventService,
    AuthorizationService,
    AuditService,
    AppLogger,
    SubscriptionService,
  ],
  exports: [
    SecurityEventService,
    AuthorizationService,
    AuditService,
    AppLogger,
    SubscriptionService,
  ],
})
export class CommonModule {}
