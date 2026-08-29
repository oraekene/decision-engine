# Decision Engine — AI Decision Intelligence Engine (ADIE)

**Stack:** Cloudflare free tier (Workers + Hono, D1 + FTS5, Vectorize, R2, KV, Queues, Pages) + `qmd-main` + SQLite, multi-user, OpenAI-compatible cloud gateways only (no local models). Specs: `v3.1` 6350 lines + `v3.2` 2299 + `v3.3` 3271 + `v3.4` 1269 + `v3.5` 617 = **13,806 lines** (addendum precedence `v3.5>v3.4>v3.3>v3.2>v3.1`). Repo: https://github.com/oraekene/decision-engine — **101 granular issues** published.

## Quick start

```bash
pnpm install
cp .dev.vars.example .dev.vars # set AI_GATEWAY_KEY
# D1 local migrations
pnpm db:migrate
pnpm dev # workers :8787 + frontend :5173
```

## Provisioning (prod)

```bash
wrangler d1 create adie-db # paste id into wrangler.toml
wrangler vectorize create adie-knowledge --dimensions=1536 --metric=cosine
wrangler r2 bucket create adie-blobs
wrangler kv namespace create SESSIONS
wrangler kv namespace create TRANSLATION_CACHE
wrangler kv namespace create PROMPT_CACHE
wrangler queues create indexing
wrangler secret put AI_GATEWAY_KEY
wrangler deploy
wrangler pages deploy frontend/dist # or Cloudflare Pages project
```

## Project layout

```
workers/src/{index.ts,config.ts,api/,lib/llmGateway.ts,translation/{directExtractor,qualitativeMapper,contextualInference,confirmationProtocol,translator}.ts,voice/wall.ts,bias/,validation/,framework/,claims/,queues/}
workers/migrations/{0001_users.sql,0002_core.sql,0003_logs.sql}
frontend/src/{pages/DecisionInput.tsx,lib/api.ts}
qmd-main/ — vendored reference (MIT) for store.ts RRF logic, not executed via better-sqlite3
docs/adr/{0001..0005}  CONTEXT.md
```

## 101 Issues

Track at https://github.com/oraekene/decision-engine/issues — labeled `ready-for-agent`, `epic:*`. Blocking edges in body (`Blocked by: #n`). Core infra `[EPIC-0]` → `[0-01..0-04]` → `[1-01..]` etc. All issues include spec refs, Cloudflare mapping, multi-user scoping, acceptance.

## Voice layer

Every user-facing generation passes 3-pass pipeline (generate against rules → mechanical wall → structural check → targeted rewrite → re-check) per §35.6. Audit trail unchanged.

## Tech invariants

- No `better-sqlite3`/`sqlite-vec`/`node-llama-cpp` in Workers; D1+Vectorize via `qmdAdapter`
- All LLM via `workers/src/lib/llmGateway.ts` fetch to `AI_GATEWAY_URL` (OpenAI/Groq/Together/Anthropic compat)
- Every row `user_id` partitioned; Vectorize metadata + R2 prefix + KV namespace scoped

## Tests

```bash
pnpm test
pnpm typecheck
```

## Docs

- `CONTEXT.md` — ubiquitous language (voice wall table, 6-domain taxonomy, 4-tier translation, 6-gate validation)
- `docs/adr/0001`-0005 — Cloudflare stack, gateway, qmd adapter, multi-user, voice
- `docs/agents/` — issue tracker / triage / domain consumer rules
