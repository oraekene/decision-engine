// auth routes module — registration, login, logout, current user (V-01).
// Request parsing and the response envelope stay here at the adapter edge;
// identity storage and session authority live behind the auth middleware
// module and persistent storage (storage-authoritative, locked 2026-09-03).
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../config.js";
import { authMiddleware, getBearerOrCookie, hashPassword, verifyPassword, sha256 } from "./auth.js";

const registerSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export function registerAuthRoutes(app: Hono<{ Bindings: Env }>) {
  app.post("/api/auth/register", async (c) => {
    const env = c.env as Env & { DB: D1Database };
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON", code: "BAD_REQUEST" }, 400); }
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "Validation failed", code: "BAD_REQUEST", details: parsed.error.flatten() }, 400);
    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const id = crypto.randomUUID();
    const password_hash = await hashPassword(password);
    try {
      await (env.DB as D1Database).prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)").bind(id, normalizedEmail, password_hash).run();
      await (env.DB as D1Database).prepare("INSERT INTO profiles (user_id) VALUES (?)").bind(id).run().catch(() => {});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("UNIQUE") || msg.includes("users.email")) return c.json({ error: "Email already exists", code: "CONFLICT" }, 409);
      throw e;
    }
    return c.json({ id, email: normalizedEmail }, 201);
  });

  app.post("/api/auth/login", async (c) => {
    const env = c.env as Env & { DB: D1Database; SESSIONS?: KVNamespace };
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON", code: "BAD_REQUEST" }, 400); }
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "Validation failed", code: "BAD_REQUEST", details: parsed.error.flatten() }, 400);
    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();
    const user = await (env.DB as D1Database).prepare("SELECT id, email, password_hash FROM users WHERE email = ?").bind(normalizedEmail).first<{ id: string; email: string; password_hash: string }>();
    if (!user) return c.json({ error: "Invalid credentials", code: "UNAUTHORIZED" }, 401);
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return c.json({ error: "Invalid credentials", code: "UNAUTHORIZED" }, 401);
    const token = crypto.randomUUID();
    const token_hash = await sha256(token);
    const sessionId = crypto.randomUUID();
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await (env.DB as D1Database).prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)").bind(sessionId, user.id, token_hash, expires_at).run();
    const isSecure = new URL(c.req.url).protocol === "https:";
    c.header("Set-Cookie", `session=${token}; HttpOnly; Path=/; Max-Age=${30*24*60*60}; SameSite=Lax${isSecure ? "; Secure" : ""}`);
    return c.json({ token, user: { id: user.id, email: user.email } }, 200);
  });

  app.post("/api/auth/logout", authMiddleware, async (c) => {
    const env = c.env as Env & { DB: D1Database; SESSIONS?: KVNamespace };
    const token = getBearerOrCookie(c);
    if (token) {
      const token_hash = await sha256(token);
      await (env.DB as D1Database).prepare("DELETE FROM sessions WHERE token_hash = ?").bind(token_hash).run();
    }
    const isSecure = new URL(c.req.url).protocol === "https:";
    c.header("Set-Cookie", `session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${isSecure ? "; Secure" : ""}`);
    return c.json({ ok: true }, 200);
  });

  app.get("/api/users/me", authMiddleware, async (c) => {
    const env = c.env as Env & { DB: D1Database };
    const user_id = c.get("user_id" as never) as string;
    const user = await (env.DB as D1Database).prepare("SELECT id, email, created_at FROM users WHERE id = ?").bind(user_id).first<{ id: string; email: string; created_at: string }>();
    if (!user) return c.json({ error: "Not Found", code: "NOT_FOUND" }, 404);
    return c.json({ id: user.id, email: user.email, created_at: user.created_at }, 200);
  });
}
