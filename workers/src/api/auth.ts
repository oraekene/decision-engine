// workers/src/api/auth.ts — multi-user auth middleware (ADR 0004, ticket [1-01])
import type { Context, Next } from "hono";
import * as bcrypt from "bcryptjs";

export function getBearerOrCookie(c: Context): string | undefined {
  const auth = c.req.header("Authorization") || c.req.header("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const cookie = c.req.header("cookie") ?? "";
  const m = cookie.match(/session=([^;]+)/);
  if (m) return m[1];
  return undefined;
}

export async function authMiddleware(c: Context, next: Next) {
  const token = getBearerOrCookie(c);
  if (!token) {
    return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }
  // Storage-authoritative lookup (locked 2026-09-03): persistent storage decides
  // every request and the cache is never consulted for verdicts, so revoked or
  // deleted sessions fail closed immediately with no grace window.
  const env = c.env as Record<string, unknown> & { DB: D1Database; SESSIONS?: KVNamespace };
  const tokenHash = await sha256(token);
  // D1 fallback (authoritative)
  const row = await (env.DB as D1Database).prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash=?").bind(tokenHash).first<{ user_id: string; expires_at: string }>();
  if (!row || new Date(row.expires_at) < new Date()) {
    if (env.SESSIONS) await (env.SESSIONS as KVNamespace).delete(`session:${tokenHash}`);
    return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }
  c.set("user_id", row.user_id);
  await next();
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
