import type { CookieOptions, Response } from 'express';
import {
  PLATFORM_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from '@bazaria/shared';
import { env } from '../config/env';

export const PLATFORM_COOKIE_PATH = '/api/v1/platform';

export function userCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'strict',
    path: '/',
  };
}

/**
 * The platform cookie is scoped to the platform path so browsers never attach
 * it to company routes (and vice versa). This complements the separate session
 * tables and the separate route policy.
 */
export function platformCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'strict',
    path: PLATFORM_COOKIE_PATH,
  };
}

export function setUserSessionCookie(
  response: Response,
  token: string,
  expiresAt: Date,
): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    ...userCookieOptions(),
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  });
}

export function setPlatformSessionCookie(
  response: Response,
  token: string,
  expiresAt: Date,
): void {
  response.cookie(PLATFORM_SESSION_COOKIE_NAME, token, {
    ...platformCookieOptions(),
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  });
}

export function clearUserSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE_NAME, userCookieOptions());
}

export function clearPlatformSessionCookie(response: Response): void {
  response.clearCookie(PLATFORM_SESSION_COOKIE_NAME, platformCookieOptions());
}
