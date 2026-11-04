import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadConfig, type Env } from "./config.js";
import { authMiddleware } from "./api/auth.js";
import { registerAuthRoutes } from "./api/authRoutes.js";
import { listDecisions, createDecision } from "./api/decisions.js";
import { NaturalLanguageTranslator } from "../translation/translator.js";
import { mechanicalPass } from "../voice/wall.js";
import { DevilsAdvocateProtocol } from "../bias/devilsAdvocate.js";
import { validate_information } from "../validation/assumptionElimination.js";
import { handleIndexingBatch } from "./queues/indexConsumer.js";

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

// --- Auth vertical V-01 (routes live in the auth routes module) ---
registerAuthRoutes(app);

// API routes — auth required except /api/auth/* and /api/health (scoped to user_id per ADR 0004)
app.get("/api/decisions", authMiddleware, async (c) => {
  const env = c.env as Env & { DB: D1Database };
  const user_id = c.get("user_id" as never) as string;
  const decisions = await listDecisions(env.DB as D1Database, user_id);
  return c.json({ decisions });
});
app.post("/api/decisions", authMiddleware, async (c) => {
  const env = c.env as Env & { DB: D1Database };
  const user_id = c.get("user_id" as never) as string;
  const body = await c.req.json().catch(() => ({})) as { description?: string };
  const { id } = await createDecision(env, user_id, body.description ?? "");
  return c.json({ id, user_id, ...body }, 201);
});

// Translation smoke — ticket [5-05]
app.post("/api/translate", authMiddleware, async (c) => {
  const { text, dimension } = await c.req.json();
  const translator = new NaturalLanguageTranslator();
  const result = translator.translate(text ?? "", dimension ?? "financial");
  // Voice wall check (if enabled)
  const env = loadConfig(c.env);
  if (env.VOICE_ENABLED) {
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
  return c.json(mechanicalPass(text ?? ""));
});

// Bias check — ticket [13-01]: fabrication flags plus protocol challenge.
// The fabrication check and the protocol are separate concerns sharing one
// route; the challenge field is additive and existing callers are unaffected.
app.post("/api/bias/check", authMiddleware, async (c) => {
  const { llm_output, answer, context } = await c.req.json() as { llm_output?: string; answer?: string; context?: Record<string, unknown> };
  const text = answer ?? llm_output ?? "";
  // fabricator detection stub (full impl in workers/bias/systemBias.ts ticket [13-01])
  const hasPercent = /\d+(?:\.\d+)?%/.test(llm_output ?? answer ?? "");
  const flags = hasPercent ? [{ bias_type: "fabricated_specificity", severity: "HIGH", evidence: "contains % without source" }] : [];
  const challenge = text
    ? new DevilsAdvocateProtocol().evaluate_answer({ text, context })
    : null;
  return c.json({ flags, challenge });
});

// Assumption check — assumption gate, previously routeless.
// The gate logic is frozen; this endpoint only makes it reachable.
app.post("/api/validation/check", authMiddleware, async (c) => {
  const { type, value, source } = await c.req.json() as { type: "user_fact" | "counterparty_constraint" | "situational_detail"; value: string; source: "user_confirmed" | "user_stated" | "inferred" | "user_knows" | "research_framework" | "assumed" | "user_observed" | "stated_by_counterparty" };
  return c.json(validate_information(type, value ?? "", source));
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
  await handleIndexingBatch(batch, env);
}
