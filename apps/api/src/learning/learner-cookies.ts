import type { CookieReply } from '../common/cookies';

export const LEARNER_ACCESS_COOKIE = 'ef_learner_access';

export function setLearnerCookie(
  reply: CookieReply,
  token: string,
  opts: { secure: boolean; ttlSec: number },
): void {
  reply.setCookie(LEARNER_ACCESS_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: opts.secure,
    path: '/',
    maxAge: opts.ttlSec,
  });
}

export function clearLearnerCookie(reply: CookieReply): void {
  reply.clearCookie(LEARNER_ACCESS_COOKIE, { path: '/' });
}
