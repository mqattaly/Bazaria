import { AsyncLocalStorage } from 'node:async_hooks';
import type { PoolClient } from 'pg';
import type { RoleCode, SubscriptionSnapshot } from '@bazaria/shared';

export interface AuthUser {
  id: string;
  mobile: string;
  fullName: string;
}

export interface PlatformAdminIdentity {
  id: string;
  username: string;
  fullName: string;
}

export interface RequestStore {
  requestId: string;
  ip?: string;
  userAgent?: string;
  client?: PoolClient;
  user?: AuthUser;
  sessionId?: string;
  companyId?: string;
  role?: RoleCode;
  subscription?: SubscriptionSnapshot;
  platformAdmin?: PlatformAdminIdentity;
}

export const requestStore = new AsyncLocalStorage<RequestStore>();

export function currentStore(): RequestStore {
  const store = requestStore.getStore();
  if (!store) {
    throw new Error('Request context is not available');
  }
  return store;
}

export function currentRequestId(): string {
  return requestStore.getStore()?.requestId ?? 'unknown';
}

export function currentClient(): PoolClient | undefined {
  return requestStore.getStore()?.client;
}
