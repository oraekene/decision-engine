// workers/src/api/auth.ts — multi-user auth middleware (ADR 0004, ticket [1-01])
import type { Context, Next } from "hono";
import * as bcrypt from "bcryptjs";

export async function authMiddleware(c: Context, next: Next) {
  const auth = c.req.header("Authorization") || c.req.header("authorization");
  let token: string | undefined;
  if (auth?.startsWith("Bearer ")) token = auth.slice(7);
  else {
    // also check cookie
    const cookie = c.req.header("cookie") ?? "";
    const m = cookie.match(/session=([^;]+)/);
    if (m) token = m[1];
  }
  if (!token) {
    return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }
  // Lookup in D1 + KV (KV cache)
  const env = c.env as Record<string, unknown> & { DB: D1Database; SESSIONS?: KVNamespace };
  const tokenHash = await sha256(token);
  // KV fast-path
  if (env.SESSIONS) {
    const cached = await (env.SESSIONS as KVNamespace).get(`session:${tokenHash}`);
    if (cached) {
      c.set("user_id", cached);
      await next();
      return;
    }
  }
  // D1 fallback
  const row = await (env.DB as D1Database).prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash=?").bind(tokenHash).first<{ user_id: string; expires_at: string }>();
  if (!row || new Date(row.expires_at) < new Date()) {
    return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }
  if (env.SESSIONS) await (env.SESSIONS as KVNamespace).put(`session:${tokenHash}`, row.user_id, { expirationTtl: 3600 });
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
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Hono routes for auth (mounted in index.ts if needed) — minimal here; full routes in workers/src/api/authRoutes.ts
