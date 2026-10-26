import { SetMetadata } from '@nestjs/common';
import type { Permission, PlatformPermission } from '@bazaria/shared';

export const IS_PUBLIC_KEY = 'bazaria:isPublic';
export const IS_PLATFORM_KEY = 'bazaria:isPlatform';
export const COMPANY_SCOPED_KEY = 'bazaria:companyScoped';
export const PERMISSION_KEY = 'bazaria:permission';
export const PLATFORM_PERMISSION_KEY = 'bazaria:platformPermission';
export const SUBSCRIPTION_EXEMPT_KEY = 'bazaria:subscriptionExempt';

/** No session required (login, logout landing, password setup). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Platform-admin route: only the platform session cookie is accepted. */
export const PlatformRoute = () => SetMetadata(IS_PLATFORM_KEY, true);

/** Requires a validated active-company context (`X-Company-Id`). */
export const CompanyScoped = () => SetMetadata(COMPANY_SCOPED_KEY, true);

/**
 * Requires a company context and a specific permission from the caller's
 * membership in that company. Authorization is always enforced server-side.
 */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);

export const RequirePlatformPermission = (permission: PlatformPermission) =>
  SetMetadata(PLATFORM_PERMISSION_KEY, permission);

/**
 * Identity/security operations that must keep working when a company is in the
 * subscription read-only window. Business-data writes never use this.
 */
export const SubscriptionExempt = () => SetMetadata(SUBSCRIPTION_EXEMPT_KEY, true);
