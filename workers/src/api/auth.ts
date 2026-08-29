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
  // Lookup in D1 + KV (KV cache) — KV now stores JSON with expiry to avoid stale auth
  const env = c.env as Record<string, unknown> & { DB: D1Database; SESSIONS?: KVNamespace };
  const tokenHash = await sha256(token);
  // KV fast-path with expiry check
  if (env.SESSIONS) {
    const cached = await (env.SESSIONS as KVNamespace).get(`session:${tokenHash}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { user_id: string; expires_at: string };
        if (parsed?.user_id && parsed?.expires_at) {
          if (new Date(parsed.expires_at) < new Date()) {
            await (env.SESSIONS as KVNamespace).delete(`session:${tokenHash}`);
          } else {
            c.set("user_id", parsed.user_id);
            await next();
            return;
          }
        } else if (typeof cached === "string" && cached.length > 0) {
          // Backwards compat for old KV entries storing raw user_id (migrating)
          // Fall through to D1 to validate expiry
        }
      } catch {
        // Corrupt cache — fall through to D1
      }
    }
  }
  // D1 fallback (authoritative)
  const row = await (env.DB as D1Database).prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash=?").bind(tokenHash).first<{ user_id: string; expires_at: string }>();
  if (!row || new Date(row.expires_at) < new Date()) {
    if (env.SESSIONS) await (env.SESSIONS as KVNamespace).delete(`session:${tokenHash}`);
    return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }
  if (env.SESSIONS) {
    const payload = JSON.stringify({ user_id: row.user_id, expires_at: row.expires_at });
    const ttl = Math.max(1, Math.floor((new Date(row.expires_at).getTime() - Date.now()) / 1000));
    await (env.SESSIONS as KVNamespace).put(`session:${tokenHash}`, payload, { expirationTtl: Math.min(ttl, 3600) });
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
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Hono routes for auth (mounted in index.ts if needed) — minimal here; full routes in workers/src/api/authRoutes.ts
