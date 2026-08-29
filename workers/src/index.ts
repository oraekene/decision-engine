import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { loadConfig, type Env } from "./config.js";
import { authMiddleware, getBearerOrCookie, hashPassword, verifyPassword, sha256 } from "./api/auth.js";

type Bindings = Env;

const app = new Hono<{ Bindings: Bindings }>();

// CORS for Pages
app.use("/*", cors({
  origin: (origin) => origin ?? "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
}));

// Request ID
app.use("/*", async (c, next) => {
  const id = crypto.randomUUID();
  c.header("x-request-id", id);
  await next();
});

// Health (no auth)
app.get("/health", (c) => c.json({ status: "ok", version: "0.1.0", ts: new Date().toISOString() }));
app.get("/api/health", (c) => c.json({ status: "ok", version: "0.1.0", env: c.env.AI_GATEWAY_MODEL ?? "unknown" }));

// --- Auth vertical V-01 ---
const registerSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

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
  if (env.SESSIONS) {
    const payload = JSON.stringify({ user_id: user.id, expires_at });
    const ttl = Math.max(1, Math.floor((new Date(expires_at).getTime() - Date.now()) / 1000));
    await (env.SESSIONS as KVNamespace).put(`session:${token_hash}`, payload, { expirationTtl: Math.min(ttl, 60) });
  }
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
    if (env.SESSIONS) await (env.SESSIONS as KVNamespace).delete(`session:${token_hash}`);
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

// API routes — auth required except /api/auth/* and /api/health (scoped to user_id per ADR 0004)
app.get("/api/decisions", authMiddleware, async (c) => {
  const env = c.env as Env & { DB: D1Database };
  const user_id = c.get("user_id" as never) as string;
  try {
    const { results } = await (env.DB as D1Database).prepare("SELECT id, description, created_at FROM decisions WHERE user_id = ? ORDER BY created_at DESC").bind(user_id).all<{ id: string; description: string; created_at: string }>();
    return c.json({ decisions: results ?? [] });
  } catch {
    return c.json({ decisions: [] });
  }
});
app.post("/api/decisions", authMiddleware, async (c) => {
  const env = c.env as Env & { DB: D1Database };
  const user_id = c.get("user_id" as never) as string;
  const body = await c.req.json().catch(() => ({})) as { description?: string };
  const id = crypto.randomUUID();
  try {
    await (env.DB as D1Database).prepare("INSERT INTO decisions (id, user_id, description) VALUES (?, ?, ?)").bind(id, user_id, body.description ?? "").run();
  } catch {}
  return c.json({ id, user_id, ...body }, 201);
});

// Translation smoke — ticket [5-05]
app.post("/api/translate", authMiddleware, async (c) => {
  const { text, dimension } = await c.req.json();
  // @ts-ignore — dynamic import with .js for wrangler bundler
  const { NaturalLanguageTranslator } = await import("./translation/translator.js");
  const translator = new NaturalLanguageTranslator();
  const result = translator.translate(text ?? "", dimension ?? "financial");
  // Voice wall check (if enabled)
  const env = loadConfig(c.env);
  if (env.VOICE_ENABLED) {
    // @ts-ignore — dynamic import with .js for wrangler bundler
    const { mechanicalPass } = await import("./voice/wall.js");
    const txt = JSON.stringify(result.value ?? {});
    const { violations } = mechanicalPass(txt);
    if (violations.some((v: string) => v.startsWith("VOCAB WALL"))) {
      return c.json({ error: "Voice wall breach", violations }, 500);
    }
  }
  return c.json(result);
});

// Voice check — ticket [27-01]
app.post("/api/voice/check", authMiddleware, async (c) => {
  const { text } = await c.req.json();
  // @ts-ignore — dynamic import with .js for wrangler bundler
  const { mechanicalPass } = await import("./voice/wall.js");
  return c.json(mechanicalPass(text ?? ""));
});

// Bias check — ticket [13-01]
app.post("/api/bias/check", authMiddleware, async (c) => {
  const { llm_output } = await c.req.json();
  // fabricator detection stub (full impl in workers/bias/systemBias.ts ticket [13-01])
  const hasPercent = /\d+(?:\.\d+)?%/.test(llm_output ?? "");
  const flags = hasPercent ? [{ bias_type: "fabricated_specificity", severity: "HIGH", evidence: "contains % without source" }] : [];
  return c.json({ flags });
});

// 404
app.notFound((c) => c.json({ error: "Not Found", code: "NOT_FOUND", requestId: c.header("x-request-id") }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message, code: "INTERNAL", requestId: c.header("x-request-id") }, 500);
});

export default app;

// For wrangler queue consumer (indexing)
export async function queue(batch: MessageBatch, env: Bindings) {
  // @ts-ignore — dynamic import with .js for wrangler bundler
  const { handleIndexingBatch } = await import("./queues/indexConsumer.js");
  await handleIndexingBatch(batch, env);
}
