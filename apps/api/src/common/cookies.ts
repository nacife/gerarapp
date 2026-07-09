import type { IssuedSession } from '../auth/auth.service';

export const ACCESS_COOKIE = 'ef_access';
export const REFRESH_COOKIE = 'ef_refresh';

/** Reply mínimo com suporte a cookies (satisfeito por FastifyReply + @fastify/cookie). */
export interface CookieReply {
  setCookie(name: string, value: string, options?: Record<string, unknown>): unknown;
  clearCookie(name: string, options?: Record<string, unknown>): unknown;
}

export interface CookieOptions {
  secure: boolean;
  accessTtlSec: number;
  refreshTtlSec: number;
}

/** Grava access/refresh como cookies httpOnly (§0.5.6). */
export function setAuthCookies(
  reply: CookieReply,
  session: IssuedSession,
  opts: CookieOptions,
): void {
  reply.setCookie(ACCESS_COOKIE, session.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: opts.secure,
    path: '/',
    maxAge: opts.accessTtlSec,
  });
  reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: opts.secure,
    path: '/v1/auth',
    maxAge: opts.refreshTtlSec,
  });
}

export function clearAuthCookies(reply: CookieReply): void {
  reply.clearCookie(ACCESS_COOKIE, { path: '/' });
  reply.clearCookie(REFRESH_COOKIE, { path: '/v1/auth' });
}

/** Grava só o access token — usado na impersonação (sessão sem refresh, RF-12). */
export function setAccessCookieOnly(
  reply: CookieReply,
  accessToken: string,
  opts: { secure: boolean; ttlSec: number },
): void {
  reply.setCookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: opts.secure,
    path: '/',
    maxAge: opts.ttlSec,
  });
}
