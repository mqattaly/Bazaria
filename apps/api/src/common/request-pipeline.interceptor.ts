import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, type Observable } from 'rxjs';
import type { Request } from 'express';
import type { PoolClient } from 'pg';
import {
  PLATFORM_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  COMPANY_ID_HEADER,
  PLATFORM_PERMISSIONS,
  type PlatformPermission,
  type Permission,
} from '@bazaria/shared';
import { SubscriptionService } from '../subscription/subscription.service';
import { DatabaseService } from '../db/database.service';
import { SessionService } from '../auth/session.service';
import { AuthorizationService } from '../authz/authorization.service';
import { SecurityEventService } from './security-event.service';
import {
  COMPANY_SCOPED_KEY,
  IS_PLATFORM_KEY,
  IS_PUBLIC_KEY,
  PERMISSION_KEY,
  PLATFORM_PERMISSION_KEY,
  SUBSCRIPTION_EXEMPT_KEY,
} from './decorators';
import { currentStore } from './request-context';
import { setPlatformContext, setUserContext } from '../db/tenant-context';
import { AppError } from './errors';
import { isAllowedOrigin } from '../config/env';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * One transaction per request. Authentication, company-context validation and
 * authorization run before the controller; the transaction commits only when
 * the controller succeeds. RLS settings are transaction-local.
 */
@Injectable()
export class RequestPipelineInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DatabaseService,
    private readonly sessions: SessionService,
    private readonly authz: AuthorizationService,
    private readonly security: SecurityEventService,
    private readonly subscription: SubscriptionService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<Request>();
    const store = currentStore();

    if (MUTATING_METHODS.has(req.method)) {
      const origin = req.header('origin');
      if (origin && !isAllowedOrigin(origin)) {
        await this.security.recordStandalone('security.origin_rejected', { origin });
        throw new AppError('MALFORMED_REQUEST', {
          message: 'منبع درخواست معتبر نیست.',
        });
      }
    }

    const client = await this.db.pool.connect();
    store.client = client;

    try {
      await client.query('BEGIN');
      await this.authenticate(context, req, client, store);
      const result = await lastValueFrom(next.handle());
      await client.query('COMMIT');
      return of(result);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async authenticate(
    context: ExecutionContext,
    req: Request,
    client: PoolClient,
    store: ReturnType<typeof currentStore>,
  ): Promise<void> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
    const isPlatform = this.reflector.getAllAndOverride<boolean>(IS_PLATFORM_KEY, targets);
    const permission = this.reflector.getAllAndOverride<Permission>(PERMISSION_KEY, targets);
    const platformPermission = this.reflector.getAllAndOverride<PlatformPermission>(
      PLATFORM_PERMISSION_KEY,
      targets,
    );
    const companyScoped = this.reflector.getAllAndOverride<boolean>(
      COMPANY_SCOPED_KEY,
      targets,
    );
    const subscriptionExempt = this.reflector.getAllAndOverride<boolean>(
      SUBSCRIPTION_EXEMPT_KEY,
      targets,
    );

    if (isPublic) return;

    if (isPlatform) {
      const token = req.cookies?.[PLATFORM_SESSION_COOKIE_NAME];
      if (!token) throw new AppError('AUTH_REQUIRED');

      const platformSession = await this.sessions.resolvePlatformSession(token);
      if (!platformSession) throw new AppError('AUTH_REQUIRED');

      store.platformAdmin = platformSession.admin;
      store.sessionId = platformSession.sessionId;
      await setPlatformContext(client);

      // Phase 1 platform admins hold the full, explicitly listed platform set.
      if (
        platformPermission &&
        !(PLATFORM_PERMISSIONS as readonly string[]).includes(platformPermission)
      ) {
        await this.security.recordStandalone('authz.platform_permission_denied', {
          platformAdminId: platformSession.admin.id,
          permission: platformPermission,
        });
        throw new AppError('PERMISSION_DENIED');
      }
      return;
    }

    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (!token) throw new AppError('AUTH_REQUIRED');

    const userSession = await this.sessions.resolveUserSession(token);
    if (!userSession) throw new AppError('AUTH_REQUIRED');

    store.user = userSession.user;
    store.sessionId = userSession.sessionId;
    await setUserContext(client, userSession.user.id);

    if (permission || companyScoped) {
      const claimed = req.header(COMPANY_ID_HEADER);
      if (!claimed) throw new AppError('COMPANY_CONTEXT_REQUIRED');

      const access = await this.authz.establishCompanyContext(
        client,
        userSession.user.id,
        claimed,
      );
      store.companyId = access.companyId;
      store.role = access.role;

      if (permission) {
        await this.authz.assertPermission(
          userSession.user.id,
          access.companyId,
          access.role,
          permission,
        );
      }

      store.subscription = access.subscription;

      // One shared policy for every tenant write: after the grace period only
      // explicitly exempt identity/security operations may mutate anything.
      if (
        MUTATING_METHODS.has(req.method) &&
        !subscriptionExempt &&
        !access.subscription.writeAllowed
      ) {
        await this.security.recordStandalone(
          'subscription.write_blocked',
          {
            userId: userSession.user.id,
            companyId: access.companyId,
            state: access.subscription.state,
            method: req.method,
            path: req.path,
          },
        );
        throw this.subscription.readOnlyError(access.subscription);
      }
    }
  }
}
