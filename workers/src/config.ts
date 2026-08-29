// workers/src/config.ts — typed env loader (spec §24 wrangler vars, ADR 0002)
import { z } from "zod";

const envSchema = z.object({
  DB: z.any(), // D1Database
  VECTORIZE: z.any().optional(),
  VECTORIZE_PROFILES: z.any().optional(),
  VECTORIZE_DECISIONS: z.any().optional(),
  VECTORIZE_LEVERAGE: z.any().optional(),
  BLOBS: z.any().optional(), // R2Bucket
  SESSIONS: z.any().optional(), // KVNamespace
  TRANSLATION_CACHE: z.any().optional(),
  PROMPT_CACHE: z.any().optional(),
  INDEXING: z.any().optional(), // Queue

  AI_GATEWAY_URL: z.string().default("https://api.openai.com"),
  AI_GATEWAY_KEY: z.string().optional(),
  AI_GATEWAY_MODEL: z.string().default("gpt-4o-mini"),
  AI_GATEWAY_EMBED_MODEL: z.string().default("text-embedding-3-small"),

  TRANSLATION_TIER1_CONF: z.coerce.number().default(0.9),
  TRANSLATION_TIER2_CONF: z.coerce.number().default(0.7),
  TRANSLATION_TIER3_CONF: z.coerce.number().default(0.5),
  DEVILS_ADVOCATE_MAX: z.coerce.number().default(5),
  DEVILS_ADVOCATE_ENABLED: z.coerce.boolean().default(true),
  ASSUMPTION_REQUIRE_SOURCE: z.coerce.boolean().default(true),
  VOICE_ENABLED: z.coerce.boolean().default(true),
});

export type Env = z.infer<typeof envSchema> & {
  // raw bindings keep original type but validated
  [k: string]: unknown;
};

export function loadConfig(raw: unknown): Env {
  return envSchema.parse(raw);
}
