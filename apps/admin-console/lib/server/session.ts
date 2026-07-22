import { getRedisClient } from '@c1rcle/core/redis';
import { randomUUID } from 'node:crypto';

const SESSION_TTL = 60 * 60; // 1 hour
const SESSION_PREFIX = 'admin:session:';
const ADMIN_SESSIONS_PREFIX = 'admin:sessions:';

function redis() {
  return getRedisClient();
}

function sessionKey(id: string) {
  return `${SESSION_PREFIX}${id}`;
}

function adminSessionsKey(adminId: string) {
  return `${ADMIN_SESSIONS_PREFIX}${adminId}`;
}

export interface AdminSession {
  sessionId: string;
  adminId: string;
  adminRole: string;
  ip: string;
  userAgent: string;
  createdAt: number;
  lastActivity: number;
  twoFactorVerified: boolean;
}

export async function createSession(
  adminId: string,
  adminRole: string,
  ip: string,
  userAgent: string,
  twoFactorVerified = false,
): Promise<AdminSession | null> {
  const client = redis();
  if (!client) return null;

  const session: AdminSession = {
    sessionId: randomUUID(),
    adminId,
    adminRole,
    ip,
    userAgent,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    twoFactorVerified,
  };

  await client
    .multi()
    .set(sessionKey(session.sessionId), JSON.stringify(session), 'EX', SESSION_TTL)
    .sadd(adminSessionsKey(adminId), session.sessionId)
    .exec();

  return session;
}

export async function getSession(sessionId: string): Promise<AdminSession | null> {
  const client = redis();
  if (!client) return null;

  const raw = await client.get(sessionKey(sessionId));
  if (!raw) return null;

  return JSON.parse(raw) as AdminSession;
}

export async function touchSession(sessionId: string): Promise<void> {
  const client = redis();
  if (!client) return;

  const session = await getSession(sessionId);
  if (!session) return;

  session.lastActivity = Date.now();
  await client
    .multi()
    .set(sessionKey(sessionId), JSON.stringify(session), 'EX', SESSION_TTL)
    .exec();
}

export async function revokeSession(sessionId: string): Promise<void> {
  const client = redis();
  if (!client) return;

  const session = await getSession(sessionId);
  if (!session) return;

  await client
    .multi()
    .del(sessionKey(sessionId))
    .srem(adminSessionsKey(session.adminId), sessionId)
    .exec();
}

export async function revokeAllAdminSessions(adminId: string): Promise<void> {
  const client = redis();
  if (!client) return;

  const sessions = await client.smembers(adminSessionsKey(adminId));
  if (!sessions.length) return;

  const multi = client.multi();
  for (const sid of sessions) {
    multi.del(sessionKey(sid));
  }
  multi.del(adminSessionsKey(adminId));
  await multi.exec();
}

export async function listSessions(adminId: string): Promise<AdminSession[]> {
  const client = redis();
  if (!client) return [];

  const sessionIds = await client.smembers(adminSessionsKey(adminId));
  if (!sessionIds.length) return [];

  const sessions: AdminSession[] = [];
  for (const sid of sessionIds) {
    const raw = await client.get(sessionKey(sid));
    if (raw) sessions.push(JSON.parse(raw));
  }

  return sessions;
}

export async function markTwoFactorVerified(sessionId: string): Promise<void> {
  const client = redis();
  if (!client) return;

  const session = await getSession(sessionId);
  if (!session) return;

  session.twoFactorVerified = true;
  session.lastActivity = Date.now();
  await client
    .multi()
    .set(sessionKey(sessionId), JSON.stringify(session), 'EX', SESSION_TTL)
    .exec();
}
