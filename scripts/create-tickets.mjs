#!/usr/bin/env node
// Bulk create ADIE granular tickets as GitHub Issues via gh CLI
// Honors: Cloudflare free-tier (Workers/Hono, D1+FTS5, Vectorize, R2, KV, Queues, Pages) + qmd+sqlite, multi-user, OpenAI-compatible cloud gateways only, addendum precedence v3.5>v3.4>v3.3>v3.2>v3.1
// Repo: oraekene/decision-engine
// Each issue: ready-for-agent, enhancement, plus epic label. Body includes spec refs, tech mapping, acceptance, and Blocked by.

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

// Ensure keyring token (unset GITHUB_TOKEN if present)
if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.startsWith("github_pat_")) {
  console.log("Unsetting fine-grained PAT to use keyring (repo scope)");
  delete process.env.GITHUB_TOKEN;
}

const repo = "oraekene/decision-engine";

const tickets = [
  // EPIC 0: SCAFFOLD & INFRA (8)
  { title: "[EPIC-0] Scaffold: Cloudflare Workers + Hono + Pages monorepo (wrangler.toml, bindings, dev script)", body: `**Context**: Spec §18.1 table (16-row stack) assumes Python 3.11+FastAPI+better-sqlite3. ADR 0001 migrates to Workers/Hono. Addendum precedence: v3.5 Voice + v3.4 Execution + v3.3 Validation all run on same Workers.

**Spec refs**: v3 full §5.1 (6-layer arch), §18.2 project structure, §24 Deployment; v3.2 §8 five-layer, §24 wrangler config.

**Tech (Cloudflare free-tier)**:
- \`wrangler.toml\` declares: \`d1_databases\` (adie-db), \`vectorize\` (adie-knowledge etc), \`r2_buckets\` (adie-blobs), \`kv_namespaces\` (SESSIONS, TRANSLATION_CACHE), \`queues\` (indexing), \`assets\` for Pages (frontend/dist).
- Monorepo: \`/workers\` (Hono API, \`src/api/main.py:5272\` → Workers), \`/frontend\` (Vite React Tailwind Zustand → Pages), \`/qmd-main\` vendored ref (not built), root \`wrangler.toml\`, \`package.json\` workspaces.
- Scripts: \`pnpm dev\` → \`wrangler dev --local --persist\`, \`pnpm build\` → frontend+workers, \`pnpm test\` → vitest.

**Multi-user / qmd / OpenAI-gateway**:
- Binds injected via \`env\`: \`DB\`, \`VECTORIZE\`, \`BLOBS\`, \`SESSIONS\`, \`AI_GATEWAY_URL/KEY/MODEL\`.

**Blocked by**: none (root)
**Acceptance**:
- [ ] \`wrangler dev\` boots Hono at localhost:8787 + Pages at 5173; \`wrangler d1 create\` + \`vectorize create\` documented in README
- [ ] \`GET /health\` returns 200; \`GET /api/health\` via Hono works locally
- [ ] \`package.json\` at root has workspaces \`workers\`+\`frontend\`, scripts dev/build/test/typecheck
- [ ] No \`better-sqlite3\`/\`node-llama-cpp\` in Workers deps; \`qmd-main\` excluded from build`, labels:["ready-for-agent","enhancement","epic:infra"] },
  { title: "[0-01] Hono API skeleton + auth middleware + CORS + /api/health + error envelope", body: `**Context**: Port \`src/api/main.py\` FastAPI routes to Hono Workers. Every route needs \`authMiddleware\` for multi-user isolation (ADR 0004). 

**Spec refs**: §5.1 API Gateway, §15.2 mode table, §18.1 stack, §24 ops.

**Tech**:
- \`workers/src/index.ts\` exports Hono \`app\`; routes under \`/api/*\` with \`authMiddleware\` reading \`Authorization: Bearer <session>\` → D1+KV lookup \`users/sessions\` (\`docs/adr/0004\`).
- CORS for Pages origin, error envelope \`{error, code, requestId}\`, requestId via \`crypto.randomUUID()\`.
- OpenAPI docs at \`/api/docs\` (scalar or swagger) generated from zod schemas.

**Blocked by**: #1
**Acceptance**:
- [ ] \`GET /api/health\` 200 without auth, \`GET /api/decisions\` 401 without token, 200 with valid mocked session
- [ ] CORS headers on preflight, error JSON on 404/500 with requestId
- [ ] \`vitest\` covers middleware happy/expired/missing`, labels:["ready-for-agent","enhancement","epic:infra"] },
  { title: "[0-02] Frontend Pages scaffold (Vite React TS Tailwind Zustand) + API client", body: `**Context**: Spec §17.1-17.4 UI flows assume React+Tailwind+Zustand but served via Pages, not FastAPI static.

**Spec refs**: §17 UI specs, §20 UI, §27 UI (§35 Voice).

**Tech**:
- \`frontend/\` Vite + React + TS + Tailwind + Zustand + React Router. \`frontend/src/lib/api.ts\` typed client for Workers Hono (fetch \`/api/*\`, attaches \`Authorization\` from httpOnly cookie or localStorage session).
- Pages deploy via \`wrangler pages deploy frontend/dist\` or \`workers\` assets binding. Env \`VITE_API_URL\`.
- Zustand stores: \`useSession\`, \`useDecision\`, \`useLeverageMap\` mirroring spec session_metadata.

**Blocked by**: #1
**Acceptance**:
- [ ] \`pnpm --filter frontend dev\` shows placeholder Decision Input screen (\`frontend/src/pages/DecisionInput.tsx\`) calling \`GET /api/health\`
- [ ] Tailwind classes render, Zustand store persists session token`, labels:["ready-for-agent","enhancement","epic:infra"] },
  { title: "[0-03] Environment + secrets: wrangler vars, .dev.vars, AI_GATEWAY_URL/KEY/MODEL, per-env config", body: `**Context**: Spec §24 config.yaml translation thresholds, devils_advocate max5, assumption logs. Must map to wrangler.toml vars + KV, not FS yaml. OpenAI-compatible gateway swappable via env.

**Spec refs**: v3.2 §24 config.yaml, v3.3 §15 layered arch, ADR 0002.

**Tech**:
- \`wrangler.toml\` \`[vars]\` → \`AI_GATEWAY_URL\` (default \`https://api.openai.com\`), \`AI_GATEWAY_MODEL\`, \`TRANSLATION_TIER1_CONF\` etc. Secrets via \`wrangler secret put AI_GATEWAY_KEY\` (recorded in docs, not committed).
- \`.dev.vars\` for local dev (gitignored). \`workers/src/config.ts\`typed loader from \`env\` (zod) with defaults per spec §24 (tier1 0.90 tier2 0.70 tier3 0.50, max_challenges 5).
- Per-env Pages vars documented.

**Blocked by**: #1
**Acceptance**:
- [ ] \`workers/src/config.ts\` loads and validates vars; unit test covers missing/default
- [ ] \`wrangler dev\` reads \`.dev.vars\`; docs \`docs/env.md\` lists all vars/secrets`, labels:["ready-for-agent","enhancement","epic:infra"] },
  { title: "[0-04] CI: GitHub Actions (typecheck + vitest + wrangler deploy dry-run) + oxlint/biome", body: `**Context**: Spec §30 Testing (pytest+ruff+mypy+Actions) → port to TS.

**Spec refs**: §21.1 stack, §30, qmd-main scripts.

**Tech**:
- \`.github/workflows/ci.yml\`: jobs typecheck (\`tsc --noEmit\`), lint (\`oxlint\` or \`biome\`), test (\`vitest run --reporter=verbose\`), deploy dry-run (\`wrangler deploy --dry-run\`).
- Pre-commit hook via \`.husky\` or \`scripts/install-hooks.mjs\` port.

**Blocked by**: #1
**Acceptance**:
- [ ] Push to \`main\` triggers CI green; PR required status checks documented
- [ ] \`pnpm test\` passes locally and in CI`, labels:["ready-for-agent","enhancement","epic:infra"] },

  // EPIC 1: AUTH MULTI-USER (4)
  { title: "[1-01] D1 users/sessions/profiles schema + auth Hono routes (register/login/logout/me, password hashing)", body: `**Context**: Multi-user invariant (CONTEXT.md): every row namespaced by \`user_id\`. Spec §13.3 user_profile JSON.

**Spec refs**: §13 Utility baseline, §14.3-14.4 storage, ADR 0004.

**Tech**:
- D1 migration \`0001_users.sql\`: \`users(id TEXT PK, email TEXT UNIQUE, password_hash TEXT, created_at TEXT)\`, \`sessions(id TEXT PK, user_id FK, token_hash TEXT, expires_at TEXT)\`, \`profiles(user_id PK FK, baselines_json TEXT, red_lines_json TEXT, utility_weights_json TEXT, thresholds_json TEXT, risk_params_json TEXT, stakeholders_json TEXT, updated_at TEXT)\`.
- Password hash \`bcrypt\` or \`argon2\` via Workers compatible impl (\`@noble/hashes\` or \`bcryptjs\`), token \`crypto.randomUUID()\` hashed SHA-256 stored, httpOnly cookie \`session\` + Bearer support.
- Hono routes: \`POST /api/auth/register\`, \`/login\`, \`/logout\`, \`GET /api/users/me\`, \`PATCH /api/users/me/profile\`. KV cache \`session:{tokenHash}:user\` TTL 1h.

**Blocked by**: #1
**Acceptance**:
- [ ] \`wrangler d1 execute DB --file=migrations/0001_users.sql\` applies clean
- [ ] Register→login→me→logout flow via curl; password never returned; token valid 30d
- [ ] Tests create two users, assert isolation (user A cannot GET user B profile)`, labels:["ready-for-agent","enhancement","epic:auth"] },
  { title: "[1-02] Frontend auth pages (Login/Register + session persistence + ProtectedRoute)", body: `**Context**: Pages needs session flow.

**Spec refs**: §17.1 interview flow, ADR 0004.

**Tech**:
- \`frontend/src/pages/Login.tsx\`, \`Register.tsx\`, hooks \`useAuth\` (Zustand), \`ProtectedRoute\` guards \`/decisions/*\`. Stores token in memory + httpOnly cookie fallback; refresh on 401.
- Forms validate email/password, show errors from Hono envelope.

**Blocked by**: #6
**Acceptance**:
- [ ] Login→ redirect to \`/decisions\`; logout clears; protected route redirects to /login when 401`, labels:["ready-for-agent","enhancement","epic:auth"] },
  { title: "[1-03] Profile interview persistence + D1 profiles CRUD + retrieve_relevant_context scoping", body: `**Context**: Spec §13 profile JSON + §14 retrieval scoped to user.

**Tech**:
- \`workers/src/storage/profileManager.ts\` CRUD for \`profiles\`; \`retrieve_relevant_context(query, user_id)\` adds \`WHERE user_id=?\` + Vectorize filter.
- \`GET /api/profiles/me\`, \`PUT /api/profiles/me\` with zod validation against §13.3 schema. R2 markdown \`/{user_id}/user_profiles/{user_id}.md\` with YAML frontmatter.

**Blocked by**: #6
**Acceptance**:
- [ ] Profile save→ fetch round-trip; R2 object exists; FTS index of profile markdown`, labels:["ready-for-agent","enhancement","epic:auth"] },

  // EPIC 2: DATA LAYER D1+FTS5+Vectorize+R2+KV (6)
  { title: "[2-01] D1 schema v1: core tables (decisions, leverage_maps, leverage_points, nodes, interview_logs) + FTS5", body: `**Context**: Port §14 QMD 8 collections + v3.2 translation/bias logs + v3.3 claim logs + v3.4 batna_ledger to D1 with FTS5.

**Spec refs**: §14.3 architecture, §14.4 QMD impl, §17 storage schemas, §17.2 audit trail, v3.2 §17.1 new collections, v3.3 §12-14 schemas, v3.4 §34.6 ledger.

**Tech**:
- Migration \`0002_core.sql\`: tables per ADR 0003:\`decisions(id, user_id FK, description, game_type, phase1_json, phase2_json, phase3_json, recommendation_json, r2_key, created_at)\`, \`leverage_maps(decision_id+user_id PK, ... jsons)\`, \`leverage_points(id PK, decision_id FK, user_id, domain, type, strength, durability, transferable, enforceable, batna, ... confidence, research_basis, evidence_json, source_validation_json)\`, \`decision_nodes(id+decision_id PK, description, node_type, is_settled, answer, source, basis, translated_value, translation_confidence, translation_method, bias_checked, bias_detected, assumption_validated, is_term, is_adr)\`, \`edges(prereq_id, dependent_id)\`, \`interview_logs\`, \`context_terms\`, \`adrs\`, plus \`_fts\` virtual tables per collection + triggers.
- All tables have \`user_id\` index.

**Blocked by**: #1
**Acceptance**:
- [ ] \`wrangler d1 execute --file=migrations/0002_core.sql\` + \`SELECT name FROM sqlite_master WHERE type='table'\` shows FTS tables
- [ ] Unit inserts/selects per user scoped correctly`, labels:["ready-for-agent","enhancement","epic:data"] },
  { title: "[2-02] D1 schema v2: translation_logs, bias_challenge_logs, claim_classification_logs, base_rates, ev_logs, system_bias_logs + audit trail JSON", body: `**Context**: v3.2 §17.2 audit_trail with 3 logs + calculation_audit must have assumptions_in_calculation==[]; v3.3 §8-13 logs.

**Tech**:
- Migration \`0003_logs.sql\`: \`translation_logs(id, session_id, user_id, input, output_value, confidence, method, validation_json, created_at)\`, \`bias_challenge_logs(... type, severity, original_answer, challenge, user_response, bias_confirmed, adjustment_json)\`, \`claim_classification_logs(id, claim, classification, confidence, framework_id, can_enter, reason, created_at)\`, \`base_rates(key PK, rate, source, confidence, context)\`, \`ev_logs\`, \`system_bias_logs\`, \`batna_ledger(user_id, relationship_id, level, outcome, activated, created_at)\` (ADR 0004).
- Each with FTS5 where textual search needed. Seeded per §12 sparse: 3 base_rates (negotiation.initiation 0.57 etc) + per §8 framework base_rates.

**Blocked by**: #9
**Acceptance**:
- [ ] Audit trail query reconstructs full \`audit_trail\` JSON matching §17.2 shape
- [ ] \`assumptions_in_calculation\` empty assert in tests`, labels:["ready-for-agent","enhancement","epic:data"] },
  { title: "[2-03] Vectorize indexes + R2 buckets + KV namespaces provisioning + bindings verified", body: `**Context**: ADR 0001/0003.

**Tech**:
- \`vectorize create adie-knowledge --dimensions=1536 --metric=cosine\` (or 768 if chosen model) + \`adie-profiles\`, \`adie-decisions\`, \`adie-leverage\`; R2 \`adie-blobs\`; KV \`SESSIONS\`, \`TRANSLATION_CACHE\`.
- \`wrangler.toml\` bindings verified via \`wrangler dev\` console; README documents \`wrangler vectorize create\`, \`r2 bucket create\`, \`kv namespace create\` for prod.

**Blocked by**: #1
**Acceptance**:
- [ ] Local dev with \`--local\` Vectorize/R2 simulators serves query
- [ ] Prod bindings tested via \`wrangler deploy --dry-run\` shows all bindings`, labels:["ready-for-agent","enhancement","epic:data"] },
  { title: "[2-04] Hybrid search adapter: D1 FTS5 BM25 + Vectorize query + RRF fusion (k=60) + gateway rerank", body: `**Context**: Port qmd-main hybridQuery (§14.2): BM25+vector+RRF+rerank <100ms. Replace Jina/qwen3 local with gateway.

**Spec refs**: §14.1-14.2, qmd-main src/store.ts hybridQuery, src/bench.

**Tech**:
- \`workers/lib/qmdAdapter.ts\` \`hybridQuery({query, collection, user_id, k=60, noRerank})→{results, explain}\`: D1 FTS5 \`MATCH\` BM25, Vectorize \`query(embed)\` filtered by \`user_id\`, RRF \`score = Σ 1/(60+rank)\`, optional gateway rerank (\`rerank(query, docs)\` via ADR 0002).
- \`formatDocForEmbedding\`, \`formatQueryForEmbedding\` ported from qmd-main/src/llm.ts but calls gateway.

**Blocked by**: #9, #11, #4
**Acceptance**:
- [ ] Recall parity test vs qmd bench fixture passes (RRF stable)
- [ ] \`?no-rerank\` skips LLM call; with rerank, order changes deterministically`, labels:["ready-for-agent","enhancement","epic:data"] },

  // EPIC 3: QMD ADAPTER (3)
  { title: "[3-01] QMD collections abstraction: 8 collections → D1+Vectorize+R2 adapter (store_*, retrieval)", body: `**Context**: Port QMDStorageSystem (§14.4) methods.

**Spec refs**: §14.3-14.5, qmd-main src/collections.ts, src/store.ts, ADR 0003.

**Tech**:
- \`workers/src/storage/qmdAdapter.ts\` implements \`store_user_profile\`, \`store_decision_tree\`, \`store_leverage_map\`, \`store_interview_log\`, \`store_translation_log\`, \`store_bias_challenge_log\`, \`store_context_term\`, \`store_adr\`, \`retrieve_relevant_context\` against D1+Vectorize+R2+KV (not subprocess). Keeps same interfaces as qmd SDK for drop-in.
- \`_profile_to_markdown\` etc. write R2 markdown with YAML frontmatter; \`_update_qmd_index\` enqueues to Queues.

**Blocked by**: #9
**Acceptance**:
- [ ] Store → retrieve round-trip for each collection; R2 markdown matches spec frontmatter
- [ ] Tests port \`test/store.test.ts\` fixtures to D1 adapter`, labels:["ready-for-agent","enhancement","epic:qmd"] },
  { title: "[3-02] Queues: async embed/index worker (consume: embed → Vectorize upsert + FTS sync)", body: `**Context**: Replace synchronous subprocess index update.

**Tech**:
- \`workers/src/queues/indexConsumer.ts\` queue \`indexing\` batch consumer: on message \`{collection, r2_key, user_id, content}\` → embed via gateway → Vectorize upsert (+ metadata) + D1 FTS trigger.
- \`wrangler.toml\` \`[[queues.consumers]]\`.

**Blocked by**: #11, #13
**Acceptance**:
- [ ] Enqueue after store triggers Vectorize doc within 5s in local queue simulation
- [ ] Vitest mocks queue, asserts flow`, labels:["ready-for-agent","enhancement","epic:qmd"] },
  { title: "[3-03] Context Glossary + ADRs retrieval (CONTEXT.md + docs/adr) per-user", body: `**Context**: §14.3 knowledge_base/context_glossary, Phase2 grill-with-docs writes terms+ADRs.

**Tech**:
- D1 \`context_terms(term, user_id, definition, source_phase)\` + R2 \`/{user_id}/context_glossary/CONTEXT.md\`; \`GET /api/context\`, \`POST /api/context\` (scoped). Same for adrs: \`/{user_id}/adrs/{slug}.md\`.
- Retrieval merges glossary into grilling prompts.

**Blocked by**: #9
**Acceptance**:
- [ ] Context add→ retrieve in next Phase2 prompt; glossary viewer in frontend lists per-user terms`, labels:["ready-for-agent","enhancement","epic:qmd"] },

  // EPIC 4: LLM GATEWAY (3)
  { title: "[4-01] LlmGateway abstraction (OpenAI-compat chat/embed/rerank via fetch env.AI_GATEWAY_*)", body: `**Context**: ADR 0002. All llm.generate calls (grilling, discovery, rerank, qualitative mapping, prompt rendering) via cloud only.

**Spec refs**: §5.3-5.4 LLM role, §18.1 LLM rows, ADR 0002.

**Tech**:
- \`workers/lib/llmGateway.ts\` \`chat({messages, model, temperature:0.1, response_format})\` → \`fetch(env.AI_GATEWAY_URL+"/v1/chat/completions")\`, \`embed(texts)\` → \`/v1/embeddings\`, \`rerank(query, docs)\` fallback prompt. Providers: OpenAI, Groq, Together, Anthropic compat (swappable \`baseUrl\`).
- No \`node-llama-cpp\` import.

**Blocked by**: #4
**Acceptance**:
- [ ] Unit mocks fetch, asserts Authorization + model + temperature
- [ ] Live smoke with OpenAI-compatible mock server returns json_object`, labels:["ready-for-agent","enhancement","epic:llm"] },
  { title: "[4-02] Prompt registry + versioned master prompt (v3.2 §4.6 650 tokens + v3.5 §35.7 voice block) in KV+R2", body: `**Context**: Single source master prompt (§4.7, §4.6 v3.2) plus phase templates (§16).

**Tech**:
- \`workers/prompts/{master_v3_3.md, phase1.md, phase1_5_leverage.md, phase2.md, phase3.md, profile.md}\` versioned in R2 \`prompts/v{semver}/\` + KV cache \`prompt:{name}:v\`. Inject per-phase vars (objective, design_tree_visualization, frontier, previous_answers, leverage_guidance, voice rules).
- Voice block §35.7 appended for every user-facing gen.

**Blocked by**: #16
**Acceptance**:
- [ ] \`GET /api/prompts/master\` returns versioned text containing all required blocks (justification, halt, forbidden 8, voice wall)
- [ ] HMR on prompt change invalidates KV`, labels:["ready-for-agent","enhancement","epic:llm"] },
  { title: "[4-03] Structured output parsers (JSON repair + Zod validation for Phase1/2/3 schemas) + halt parse", body: `**Context**: Spec output contract: frontier exhausted → emit ONLY JSON per §6.4/§8.6/§9.4 schemas.

**Tech**:
- \`workers/lib/parsers.ts\` \`parsePhaseOutput(text, schemaZod)\` with JSON repair (brace extraction, trailing comma fix) + zod. Halt parse \`<<<HALT>>>...<<<END_HALT>>>\` §12.2.

**Blocked by**: #16
**Acceptance**:
- [ ] Malformed JSON repaired; zod errors return 422 with field
- [ ] Halt blocks parsed into HaltManager halt object`, labels:["ready-for-agent","enhancement","epic:llm"] },

  // EPIC 5: TRANSLATION FOUR-TIER (5)
  { title: "[5-01] Tier1 DirectNumericExtractor: regex patterns + FUZZY_MODIFIERS (±10-20%) → ExtractedValue", body: `**Context**: v3.2 §5.3 769-879, PATTERNS for financial ($,k,percent,months) emotional (/10 scale) temporal, FUZZY_MODIFIERS about±0.10 etc.

**Spec refs**: v3.2 §5.2-5.7, translation_research.md PANAS vs direct.

**Tech**:
- \`workers/translation/directExtractor.ts\` \`extract(text, dimension) → {value, tolerance, confidence HIGH|MEDIUM, source:"direct_extraction", original_text}\`. Pure regex, no LLM, Worker TS.
- Patterns verbatim from spec §5.3 lines 822-849.

**Blocked by**: #1
**Acceptance**:
- [ ] \`"About $4,500"\` → 4500 tolerance 450 conf HIGH; \`"5 months"\`→5; \`"3 out of 10"\`→3; 15 fixture tests pass`, labels:["ready-for-agent","enhancement","epic:translation"] },
  { title: "[5-02] Tier2 QualitativeMapper: PANAS/GSE/Schwartz dictionaries (words 1-10, 0.1-1.0) → MappedValue", body: `**Context**: v3.2 §5.4 883-981 dictionaries.

**Tech**:
- \`workers/translation/qualitativeMapper.ts\` \`map(text, dimension) → {score, confidence 0.85|0.80, basis, method:"qualitative_mapping"}\` with EMOTIONAL_SCALE, CONFIDENCE_SCALE, IMPORTANCE_SCALE per spec. Tests: "miserable"→3, "devastated"→1.

**Blocked by**: #19
**Acceptance**:
- [ ] Word match 0.85 basis "PANAS word match: 'miserable'" else phrase 0.80; unknown→null`, labels:["ready-for-agent","enhancement","epic:translation"] },
  { title: "[5-03] Tier3 ContextualInference: deterministic runway/income_floor (no LLM) → InferredValue", body: `**Context**: v3.2 §5.5 984-1015, NO LLM allowed.

**Tech**:
- \`workers/translation/contextualInference.ts\` \`infer_financial_runway(savings, expenses)→ value=savings/expenses conf 0.90 basis "Calculated..." \`, \`infer_income_floor(obligations)→0.95\`. Zod input validation; throws if LLM import attempted via lint rule.

**Blocked by**: #19
**Acceptance**:
- [ ] \$22.5k/4.5k → runway 5.0 conf 0.90; code review check no llm import`, labels:["ready-for-agent","enhancement","epic:translation"] },
  { title: "[5-04] Tier4 UserConfirmationProtocol: triggers (conf<0.50, discrepancy, extreme ≤2/≥9, prior contradiction) → halt/confirm 0.95", body: `**Context**: v3.2 §5.6 1018-1040 should_confirm.

**Tech**:
- \`workers/translation/confirmationProtocol.ts\` \`should_confirm(value)→bool\` with 4 triggers + \`method==contextual_inference && assumptions\`. UI halt Type1 (translation confirmation) via HaltManager.

**Blocked by**: #19
**Acceptance**:
- [ ] Tier1 3 vs Tier2 4 discrepancy triggers confirm; extreme 1 triggers; confidence 0.4 triggers`, labels:["ready-for-agent","enhancement","epic:translation"] },
  { title: "[5-05] NaturalLanguageTranslator orchestrator + translation_log + example flow 3→4→confirm 0.95", body: `**Context**: v3.2 §5.7 complete flow example "miserable 3/10" → discrepancy → confirm.

**Tech**:
- \`workers/translation/translator.ts\` \`translate(text, dimension) → TranslatedValue\` orchestrating Tier1→Tier2 cross-validate→Tier3→Tier4 gate; \`translation_log: TranslationLogEntry[]\` persisted to D1+R2 via queue.

**Blocked by**: #19, #20, #21, #22
**Acceptance**:
- [ ] End-to-end "Honestly miserable, maybe 3/10" → Tier1 3 HIGH, Tier2 4.0, triggers Tier4, user confirms 3 → final 0.95`, labels:["ready-for-agent","enhancement","epic:translation"] },

  // EPIC 6: DEVIL'S ADVOCATE 9 BIASES (4)
  { title: "[6-01] DevilsAdvocateProtocol base: 9-detector registry + evaluate_answer + max5/session + severity", body: `**Context**: v3.2 §6 devils_advocate.py 1074-1113, §8 layer2.

**Tech**:
- \`workers/bias/devilsAdvocate.ts\` class with maps anchoring, loss_aversion, social_desirability, overconfidence, status_quo, sunk_cost, confirmation_bias, framing_effect, catastrophizing. \`evaluate_answer(answer)→Challenge{type, severity LOW|MEDIUM|HIGH, confidence, evidence, question}\` ; prioritization + max_challenges 5 enforcement via KV counter \`user:{id}:session:{id}:challenge_count\`.

**Blocked by**: #1
**Acceptance**:
- [ ] Max 5/session blocks 6th; severity thresholds 0.5/0.7/0.85 map 🟢/🟡/🔴; prioritization test`, labels:["ready-for-agent","enhancement","epic:bias"] },
  { title: "[6-02] Implement 9 detectors: anchoring, loss_aversion, social_desirability, overconfidence, status_quo, sunk_cost, confirmation, framing, catastrophizing", body: `**Context**: Detection patterns per §6.2 + §4.6 607-615.

**Tech**:
- \`workers/bias/detectors/{anchoring,lossAversion,socialDesirability,overconfidence,statusQuo,sunkCost,confirmationBias,framingEffect,catastrophizing}.ts\` each \`detect(answer, context, all_answers)→Challenge\` with patterns (e.g., anchoring: answer.value == prior_answer.value; loss_aversion: extreme loss language+" devastating "+EV>0 etc). All domain-general.

**Blocked by**: #24
**Acceptance**:
- [ ] Each detector 85% accuracy on fixture suite; \`test_loss_aversion_detection\` "devastating cannot risk" + EV 0.3 → not None`, labels:["ready-for-agent","enhancement","epic:bias"] },
  { title: "[6-03] IntegratedGrillingEngine wrapper: _conduct_round super → devils_advocate.evaluate → _present_challenge → process_response → bias_challenge_log", body: `**Context**: v3.2 §6.4 IntegratedGrillingEngine 1130-1153

**Tech**:
- Wraps emergent grilling round: after \`super()._conduct_round\`, for each \`answer.source=="user"\` call \`evaluate_answer\` → if challenge → UI halt BIAS_CHALLENGE → \`process_challenge_response\` adjusts \`answer.adjusted_value\` / \`bias_detected\`. Queue for async challenge phrasing if LLM needed.

**Blocked by**: #24, #25
**Acceptance**:
- [ ] Round with "devastating cannot risk" shows bias challenge modal; adjusted answer persisted; log to D1 bias_challenge_logs`, labels:["ready-for-agent","enhancement","epic:bias"] },
  { title: "[6-04] Bias challenge severity UI contracts + frontend BiasChallenge.tsx (🟢🟡🔴)", body: `**Context**: §20.2 1916-1945 before/after (but voice §35.3 now humanizes; skin only).

**Tech**:
- \`frontend/src/components/BiasChallenge.tsx\` handles challenge shape, but Voice layer dictates phrasing. Provide props for translator to humanize.

**Blocked by**: #26
**Acceptance**:
- [ ] Component renders severity badge + evidence bullets + research citation when internal mode`, labels:["ready-for-agent","enhancement","epic:bias"] },

  // EPIC 7: ASSUMPTION ELIMINATION (3)
  { title: "[7-01] AssumptionEliminationProtocol.validate_information (3 categories, 9 cases) → ValidationResult", body: `**Context**: v3.2 §7 1157-1229, validate_information table.

**Tech**:
- \`workers/validation/assumptionElimination.ts\` \`validate_information(type, value, source) → {valid, confidence, halt_required, needs_confirmation, source_question, framework_citation_required, verification_question}\` handling user_fact/counterparty_constraint/situational_detail with sources enumerated. Halt on inferred/assumed per §7.3 triggers.

**Blocked by**: #1
**Acceptance**:
- [ ] Table §7.2 9 cases 100% coverage; \`validate_information(counterparty_constraint,"They need ASAP","assumed")→ valid False halt True\` (TestAssumption 2170-2180)`, labels:["ready-for-agent","enhancement","epic:validation"] },
  { title: "[7-02] SourceValidator + assumption triggers (NEVER allow Probably/I assume) + halt types 2/4", body: `**Context**: §7.3 triggers + HaltManager types ASSUMPTION_DETECTION/VALIDATION_REQUIRED §15.

**Tech**:
- Detect banned phrasing "Probably/I assume/most likely/obvious" without source; enforce via pre-calculation check. Ties to HaltManager HALT format.

**Blocked by**: #28
**Acceptance**:
- [ ] Banned phrases trigger halt; source_question "How do you know?" rendered`, labels:["ready-for-agent","enhancement","epic:validation"] },
  { title: "[7-03] Leverage/Counterparty gate: no LeveragePoint or CounterProtocol without valid source", body: `**Context**: v3.2 §10.2 Phase1.5 ASK/VALIDATE/LOG, §14 validated hidden detector.

**Tech**:
- Every leverage creation checks \`source_validation.valid==true\` else halt; Pareto analyzer filters validated only.

**Blocked by**: #28
**Acceptance**:
- [ ] Unvalidated leverage excluded from solver; test with mixed valid/invalid`, labels:["ready-for-agent","enhancement","epic:validation"] },

  // EPIC 8: FRAMEWORK LIBRARY 58 (3)
  { title: "[8-01] Framework Library D1 schema + 58 FrameworkEntry seed (Fisher&Tversky...Gouldner+Pruitt)", body: `**Context**: v3.3 §8 58 entries (spec says 45+, enumerates 58) across negotiation/game theory/cognitive/social/power/info/networks/psychometrics/institutions/temporal.

**Tech**:
- D1 \`frameworks(id PK, citation, year, domains_json, supports_json, does_not_support_json, confidence, coefficients_json, instruments_json, related_json)\` seed from §8.3 481-1347. Include base_rates inline. Includes 4 new from v3.4 §33.5 ury_breakthrough/schelling/gouldner/pruitt.
- R2 \`library_v1.md\` source.

**Blocked by**: #10
**Acceptance**:
- [ ] \`SELECT COUNT(*) FROM frameworks\` =58; supports/does_not_support queryable`, labels:["ready-for-agent","enhancement","epic:framework"] },
  { title: "[8-02] ValidatedFrameworkLibrary.validate_claim + find_for_domain/claim + semantic index (Vectorize/Jaccard fallback)", body: `**Context**: v3.3 §8.4 library impl 1353-1449, semantic match threshold 0.7.

**Tech**:
- \`workers/framework/library.ts\` with \`validate_claim(claim, cited_framework)→FrameworkValidation\` logic: existence→supports match→does_not_support misapplication reject. Semantic via Vectorize embeddings (prod) or Jaccard keyword overlap test fallback.

**Blocked by**: #31
**Acceptance**:
- [ ] "Having alternatives improves position" with batna_theory valid HIGH; unknown ID rejected; misapplication detected`, labels:["ready-for-agent","enhancement","epic:framework"] },
  { title: "[8-03] Library usage rules enforcement (6 rules) + human-curated extensibility (no LLM runtime add)", body: `**Context**: §8.5 RULE1-6.

**Tech**:
- Rules enforced in \`validate_claim\` + prompt injection (master prompt framework rules block). \`add_rate\` requires human review flag.

**Blocked by**: #32
**Acceptance**:
- [ ] LLM attempting to cite unknown framework rejected; add via D1 requires admin token`, labels:["ready-for-agent","enhancement","epic:framework"] },

  // EPIC 9: CLAIM CLASSIFICATION 6 TIERS (3)
  { title: "[9-01] ClaimClassifier 6 categories + confidence mapping (0.95/0.85/0.50/0.65/0.30/0.10) + flow §9.2", body: `**Context**: v3.3 §9 six categories, confidence ranges, flow chart.

**Tech**:
- \`workers/claims/classifier.ts\` \`classify(claim, {cited_framework,user_validated,user_source,probability_basis,practitioner_labeled})→ClassifiedClaim{claim, classification, confidence, can_enter_calculations, framework_citation?, disclosure_required?}\` with helpers \`:_contains_unsourced_statistics, _treats_contingent_as_certain\` (EV violation).

**Blocked by**: #31
**Acceptance**:
- [ ] Six category unit tests covering flow → USER_VALIDATED 0.85 else VALIDATED_RESEARCH else PROBABILITY_WEIGHTED else PRACTITIONER else HYPOTHESIS else SPECULATION 0.10`, labels:["ready-for-agent","enhancement","epic:claims"] },
  { title: "[9-02] CalculationGate MIN_CONFIDENCE 0.50 (PRACTITIONER passes, HYPOTHESIS/SPECULATION blocked) + provenance", body: `**Context**: §9.3 1704-1739 gate before any calc.

**Tech**:
- \`workers/claims/gate.ts\` \`check(ClassifiedClaim)→GateResult{allowed, reason, provenance}\` enforced before solvers. Provenance carried to audit_trail calculation_audit.inputs_used.

**Blocked by**: #34
**Acceptance**:
- [ ] PRACTITIONER 0.50 allowed reduced weight; HYPOTHESIS 0.30 blocked; gate logs to claim_classification_logs`, labels:["ready-for-agent","enhancement","epic:claims"] },
  { title: "[9-03] Audit trail integration: every calc input must be ClassifiedClaim with provenance", body: `**Context**: §24 audit.

**Tech**:
- All solvers reject unclassified inputs.

**Blocked by**: #35
**Acceptance**:
- [ ] Attempt calc with SPECULATION throws GateError; audit JSON matches §24 schema`, labels:["ready-for-agent","enhancement","epic:claims"] },

  // EPIC 10: EMERGENT DISCOVERY VALIDATION 5 STRATEGIES (3)
  { title: "[10-01] EmergentDiscoveryValidation: 5 strategy rules (analogical counterfactual perspective temporal constraint) + forbidden lists", body: `**Context**: v3.3 §10 1749-1979, STRATEGY_RULES per-strategy allowed ClaimTypes + confidence + forbidden domain-general.

**Tech**:
- \`workers/discovery/validation.ts\` \`validate_discovery(strategy, claim, classification, user_evidence)→DiscoveryValidation\` with checks \`:_asserts_specific_counterparty_psychology, _asserts_specific_temporal_fact\` requires user_evidence else valid False required_action ask.

**Blocked by**: #34
**Acceptance**:
- [ ] analogical "NEVER accept first offer" without practitioner label → REJECTED; rewrite A PRACTITIONER 0.45 passes with disclosure`, labels:["ready-for-agent","enhancement","epic:discovery"] },
  { title: "[10-02] Perspective/temporal discovery gates: assert specific counterparty psychology or temporal fact without user_evidence → ask", body: `**Context**: perspective_reversal and temporal_shifting require user_evidence.

**Tech**:
- Integration into Leverage Mapping Engine emergent session.

**Blocked by**: #37
**Acceptance**:
- [ ] "Client fears deadline" without recruiter evidence → valid False, required_action ask user`, labels:["ready-for-agent","enhancement","epic:discovery"] },
  { title: "[10-03] Discovery example §10.3 triage + D1 discovery_logs", body: `**Context**: Example claim rewrite A/B.

**Blocked by**: #37
**Acceptance**:
- [ ] Example claim correctly classified as REJECTED then PRACTITIONER/BATNA theory alternative`, labels:["ready-for-agent","enhancement","epic:discovery"] },

  // EPIC 11: EV ENFORCEMENT (2)
  { title: "[11-01] ExpectedValueEnforcement: CONTINGENT_MARKERS (14) + CERTAINTY_MARKERS (7) → EVViolation or compute_expected_value", body: `**Context**: v3.3 §11 2020-2118, markers for equity/bonus if/etc + is worth/equals.

**Tech**:
- \`workers/ev/enforcement.ts\` \`check_claim\` linguistic detection → EVViolation{original_claim, violation, research_basis, correction_prompt}; \`compute_expected_value(value,probability,basis)→ExpectedValueResult\` EV = P×value, classification PROBABILITY_WEIGHTED 0.65 if basis else 0.40. Research basis prospect_theory/vNM.

**Blocked by**: #34
**Acceptance**:
- [ ] "Your equity is worth $300k" → violation; "Expected equity =0.6×300k" → 0.65 correct`, labels:["ready-for-agent","enhancement","epic:ev"] },
  { title: "[11-02] Domain-general EV examples (equity, bonus, conditional promises) + audit", body: `**Context**: §11.3 examples.

**Blocked by**: #40
**Acceptance**:
- [ ] All 4 violation examples rejected; 4 corrected pass`, labels:["ready-for-agent","enhancement","epic:ev"] },

  // EPIC 12: BASE RATE DB (2)
  { title: "[12-01] BaseRateDatabase D1 schema + sparse seed (negotiation 0.57, employment 2-12, loss_aversion 2.25) + lookup/add", body: `**Context**: v3.3 §12 2128-2218, intentionally sparse.

**Tech**:
- D1 \`base_rates\` + \`workers/baseRates/db.ts\` \`lookup(key)→BaseRateResult\` partition by ".", not found → message options (1 user estimate, 2 research add, 3 proceed without). \`add_rate(key,rate,source,confidence) \` requires source len>=10, human review, LLM cannot invoke at runtime.

**Blocked by**: #10
**Acceptance**:
- [ ] \`lookup("negotiation.initiation_rate")\` found 0.57 HIGH; unknown key "Series B fail" not found with correct message`, labels:["ready-for-agent","enhancement","epic:baserate"] },
  { title: "[12-02] Base Rate gate in classification (unsourced % → SPECULATION) + EV basis integration", body: `**Context**: Flow: statistics without source → SPECULATION; EV probability_basis can be BaseRate lookup.

**Blocked by**: #34, #42
**Acceptance**:
- [ ] Unsourced "Common to negotiate equity 0.5→1.0 is common" rejected as SPECULATION`, labels:["ready-for-agent","enhancement","epic:baserate"] },

  // EPIC 13: SYSTEM BIAS DETECTOR 4 BIASES (2)
  { title: "[13-01] SystemBiasDetector: 4 system biases (plausibility, fabricated_specificity, prescriptive_as_descriptive, completeness) via regex", body: `**Context**: v3.3 §13 2244-2353, SYSTEM_BIASES map + check_output.

**Tech**:
- \`workers/bias/systemBias.ts\` \`check_output(llm_output)→SystemBiasFlag[]{bias_type, evidence, action, severity HIGH|MEDIUM|LOW}\` with detection_patterns regex (\\d+% etc) + helpers _has_nearby_source, _extract_claims, _has_classification_marker. Must run on ALL LLM outputs before pipeline.

**Blocked by**: #34
**Acceptance**:
- [ ] fabricated 85% without source flagged HIGH; completeness illusion flagged LOW + triggers closing`, labels:["ready-for-agent","enhancement","epic:systembias"] },
  { title: "[13-02] Bias middleware on every gateway chat response → system_bias_log + rerouting", body: `**Context**: Mirror of DA but for LLM.

**Tech**:
- Hono middleware wrapping llmGateway.chat; flags persisted to system_bias_logs.

**Blocked by**: #44, #16
**Acceptance**:
- [ ] Every LLM output checked; SYSTEM_BIASES violations block or reclassify before calc`, labels:["ready-for-agent","enhancement","epic:systembias"] },

  // EPIC 14: SESSION CLOSING PROTOCOL 3 LEVELS (2)
  { title: "[14-01] SessionClosingProtocol 3 levels (SELF, STAKEHOLDER template, SITUATION) + _is_substantive (>10 chars) → re-open", body: `**Context**: v3.3 §14 2366-2461, LEVEL1/2/3 prompts, non_substantive set.

**Tech**:
- \`workers/closing/protocol.ts\` \`conduct_closing(design_tree, stakeholders, phase)→ClosingResult{session_complete, new_information[], action, phase}\` + FOLLOW_UP_PROMPTS. If new_information → _extract_new_nodes → re-open design tree → new grilling rounds.

**Blocked by**: #1
**Acceptance**:
- [ ] Frontier empty → 3 questions; "no" → complete; >10 char substantive → session_complete false and tree re-opens`, labels:["ready-for-agent","enhancement","epic:closing"] },
  { title: "[14-02] Closing integration per phase (Phase1→1.5→2→3→Profile) + KV state", body: `**Context**: §14.3 integration workflow.

**Blocked by**: #46
**Acceptance**:
- [ ] Phase1 frontier empty → closing → if substantive → additional round triggered`, labels:["ready-for-agent","enhancement","epic:closing"] },

  // EPIC 15: GRILLING + DESIGN TREE (4)
  { title: "[15-01] DesignTree + DecisionNode dataclass (10 NodeTypes + v3.2 fields) + get_frontier + to_visualization", body: `**Context**: v3.1 §4.8 733-872 + v3.2 §4.7 MOD (TRANSLATION_CHECK/BIAS_CHECK + translated_value etc) + v3.3 §4.7 claim_classification/framework_citation/expected_value_basis.

**Spec**: NodeType 10 values, DecisionNode 12 fields, DesignTree get_frontier (not settled & all prereqs settled), visualization.

**Tech**:
- \`workers/grilling/designTree.ts\` TS port; D1 persistence via decision_nodes+edges tables; KV snapshot for active session. Renders "Translated: X (conf Y%)" + "Bias check: DETECTED/Clear".

**Blocked by**: #10
**Acceptance**:
- [ ] Frontier logic matches spec get_frontier impl; visualization test`, labels:["ready-for-agent","enhancement","epic:grilling"] },
  { title: "[15-02] EmergentGrillingEngine core loop (run_session, _generate_frontier_questions via gateway, _conduct_round facts vs USER_INPUT, batch parse)", body: `**Context**: v3.1 §5.3-5.4 1031-1214, 12 methods, Facts vs Decisions table.

**Tech**:
- \`workers/grilling/engine.ts\` class; llm via gateway, objective + visualization + frontier + previous_answers prompt, parse ❓ n: Title body ➡️ Recommended. _conduct_round splits facts (LLM internal) vs USER_INPUT_REQUIRED (halt). _ask_user_batch formats 🛑 + ❓+➡️ → KV halt queue (Workers cannot block on input).

**Blocked by**: #48, #16, #18
**Acceptance**:
- [ ] Run with mock gateway and 2-user answers advances frontier correctly; loop terminates when empty+closing confirms`, labels:["ready-for-agent","enhancement","epic:grilling"] },
  { title: "[15-03] Master system prompt v3.3 §4.6 267-387 (role, frontier, facts vs decisions, classification, framework, EV, base rate, DA, leverage, closing, forbidden 8)", body: `**Context**: Exact prompt text is canonical, versioned.

**Blocked by**: #16
**Acceptance**:
- [ ] Prompt contains all required blocks verbatim per spec §4.6; injection test prevents predetermined lists`, labels:["ready-for-agent","enhancement","epic:grilling"] },
  { title: "[15-04] Taxonomy-Guided Grilling (6 domains) as strategic guide not script + leverage precursor nodes", body: `**Context**: v3.1 §4.9, §6.2-6.3 design tree init.

**Blocked by**: #48
**Acceptance**:
- [ ] TaxonomyGuidedGrillingEngine extends EmergentGrillingEngine, seeds domain_structural etc nodes`, labels:["ready-for-agent","enhancement","epic:grilling"] },

  // EPIC 16: PHASE 1 (2)
  { title: "[16-01] Phase1 Context Ingestion emergent interview (objective 6 items + 12 nodes) + translation/bias/assumption per answer", body: `**Context**: §6 1267-1498 + v3.2 §9 Phase1 1371-1464 prompt 4-step translation.

**Tech**:
- \`workers/phases/phase1.ts\` runs TaxonomyGuidedGrillingEngine with leak-precursor nodes, per answer TR→DA→AE pipeline before settle.

**Blocked by**: #48, #23, #26, #28
**Acceptance**:
- [ ] Job example Round1 Q1-3 → Round2 Q4-7 expansion; JSON output schema §6.4 passes validation with leverage_precursors`, labels:["ready-for-agent","enhancement","epic:phase1"] },
  { title: "[16-02] Phase1 output schema validation (design_tree + stakeholders + choices + baseline + leverage_precursors + session_metadata)", body: `**Context**: §6.4 JSON schema.

**Blocked by**: #52
**Acceptance**:
- [ ] Zod schema matches §6.4 1418 JSON; missing field fails`, labels:["ready-for-agent","enhancement","epic:phase1"] },

  // EPIC 17: PHASE1.5 LEVERAGE MAPPING 6 DOMAINS (4)
  { title: "[17-01] Six-domain taxonomy (Structural Negotiation Psychological Resource Informational Positional ×5-6) + LeverageIntegrationManager", body: `**Context**: §7.2 1507-1668, mindmap 30+ types.

**Tech**:
- \`workers/leverage/taxonomy.ts\` definition; \`integrationManager.ts\` enhance_phase2/adjust_phase3/validate_red_line methods per §5.4.

**Blocked by**: #48
**Acceptance**:
- [ ] Taxonomy D1 lookup returns 30+ entries across 6 domains`, labels:["ready-for-agent","enhancement","epic:leverage"] },
  { title: "[17-02] LeverageMappingEngine (conduct session → deterministic → emergent → hybrid → confirm → compile) + TaxonomyGuidedGrillingEngine", body: `**Context**: §7.4 1669-1852, 6 steps.

**Tech**:
- \`workers/leverage/mappingEngine.ts\` class.

**Blocked by**: #54, #57
**Acceptance**:
- [ ] Run with phase1_output mock returns LeverageMap with domain_summary etc`, labels:["ready-for-agent","enhancement","epic:leverage"] },
  { title: "[17-03] LeverageMap dataclass 7 dataclasses (LeveragePoint 1-5, HiddenLeverage, DomainSummary, StakeholderLeverage, Trajectory, EnforcementLeverage, ValidationMetadata)", body: `**Context**: §7.5 1852-2019

**Tech**:
- \`workers/leverage/types.ts\` Zod/types + D1 storage + R2 markdown per §14.4 _leverage_map_to_markdown.

**Blocked by**: #54
**Acceptance**:
- [ ] Example JSON §7.6 2021 validates (3 points, 2 hidden, 6 domain summaries)`, labels:["ready-for-agent","enhancement","epic:leverage"] },
  { title: "[17-04] Leverage Map display data → Voice humanized (before/after §35.4 #6)", body: `**Context**: v3.5 §35.4 leverage summary before/after.

**Blocked by**: #56
**Acceptance**:
- [ ] Internal LeverageMap correct; rendered prose passes voice wall`, labels:["ready-for-agent","enhancement","epic:leverage"] },

  // EPIC 18: PHASE2 GAME THEORY (2)
  { title: "[18-01] Phase2 Game Theory emergent interview + grill-with-docs (CONTEXT+ADRs writes) + stakeholder utilities + ZOPA", body: `**Context**: §8 2202-2470, mode grill-with-docs writes Terms→CONTEXT glossary + ADRs if hard-to-reverse.

**Tech**:
- \`workers/phases/phase2.ts\`

**Blocked by**: #54
**Acceptance**:
- [ ] Client $50k vs $70k example Round1-2 passes; CONTEXT.md term added`, labels:["ready-for-agent","enhancement","epic:phase2"] },
  { title: "[18-02] ValidatedParetoAnalyzer: validated-only leverage (source_validation) + is_pareto_improvement LP → output schema §8.6", body: `**Context**: v3.2 §11 validated-only, v3.3 §8 supports.

**Tech**:
- \`workers/solvers/paretoAnalyzer.ts\` filtered leverage before LP; \`find_pareto_improvements\`.

**Blocked by**: #58, #29
**Acceptance**:
- [ ] No win-win test; improved set with leverage contribution tracked`, labels:["ready-for-agent","enhancement","epic:phase2"] },

  // EPIC 19: PHASE3 MINIMAX TREE GEN (2)
  { title: "[19-01] Phase3 Minimax decision tree gen (Choice→best/likely/worst + causal_chain with CONTEXT/FRAMEWORK/USER_INPUT + utility mapping 4 dims)", body: `**Context**: §9 2471-2761 prompt + design structure.

**Tech**:
- \`workers/phases/phase3.ts\` validation-aware (§12) blocks if confidence<0.50.

**Blocked by**: #58
**Acceptance**:
- [ ] Job decision choices including composite "Stay and negotiate" etc; branches with probability/red_line_risks/reversible`, labels:["ready-for-agent","enhancement","epic:phase3"] },
  { title: "[19-02] Phase3 output schema §9.4 JSON validation", body: `**Blocked by**: #60`, labels:["ready-for-agent","enhancement","epic:phase3"] },

  // EPIC 20: LEVERAGE-MODIFIED MINIMAX (4)
  { title: "[20-01] Utility functions: financial/emotional/temporal/reputational + AHP derive_weights (eigenvector + CR<0.1) + thresholds nonlinear", body: `**Context**: §3.1 210-345, 4 templates + derive_weights pairwise 1-9 scale + thresholds interpolation + example savings 1→-0.8 etc.

**Tech**:
- \`workers/solvers/utility.ts\` TS port; eigenvector via ml-matrix (no numpy in Workers). Consistency ratio Saaty.

**Blocked by**: #1
**Acceptance**:
- [ ] financial_utility tests for ≤red_line -1, ≥ceiling +1, baseline 0; derive_weights rejects CR>0.1`, labels:["ready-for-agent","enhancement","epic:math"] },
  { title: "[20-02] Standard MinimaxSolver.solve (minimax select, red_line -1.0, reversibility +0.1, confidence, baseline compare) §10.2-10.3", body: `**Tech**: \`workers/solvers/minimax.ts\``,

   labels:["ready-for-agent","enhancement","epic:math"] },
  { title: "[20-03] Leverage maths: calculate_leverage_strength (1-5×durability×transferability×enforceability) + multiplier + adjusted_utility (loss aversion 2.25) + BATNA floor §3.2", body: `**Tech**: \`workers/leverage/math.ts\` per §3.2.1-3.2.4`, labels:["ready-for-agent","enhancement","epic:math"] },
  { title: "[20-04] LeverageModifiedMinimaxSolver: filtered validated leverage, branch multiplier (worst 0.10 likely 0.08 best 0.05 cap 0.5-2.0), BATNA floor, red_line enforceability, confidence, leverage_strategy §10.2", body: `**Tech**: \`workers/solvers/leverageModifiedMinimax.ts\` 13 methods per spec + audit_trail.`, labels:["ready-for-agent","enhancement","epic:math"] },

  // EPIC 21: HIDDEN LEVERAGE 6 PATTERNS (4)
  { title: "[21-01] DeterministicHiddenLeverageDetector 6 patterns: BATNA underestimation, scarcity blindness, time asymmetry, dependency misreading, info asymmetry, network holes", body: `**Context**: §11.2 3388-3658, each with research basis + _calculate_actual_alternatives etc.

**Tech**:
- \`workers/leverage/hiddenDetector.ts\` + per-pattern helpers. Thresholds per spec.

**Blocked by**: #54
**Acceptance**:
- [ ] test_hidden_batna/scarcity/time tests pass (5726 etc); all 6 patterns handle start vs belief gaps`, labels:["ready-for-agent","enhancement","epic:hidden"] },
  { title: "[21-02] EmergentDiscoveryEngine 5 strategies (counterfactual, perspective_reversal, temporal_shifting, constraint_removal, analogical) prompts→_parse_findings → dedupe", body: `**Context**: §11.3 3662-3877`, labels:["ready-for-agent","enhancement","epic:hidden"] },
  { title: "[21-03] HybridValidationEngine: research/context/practicality scoring (0.4/0.4/0.2) + cross_validate + dedup + threshold (deterministic>0.7, emergent>0.5)", body: `**Context**: §11.4 3877-4005`, labels:["ready-for-agent","enhancement","epic:hidden"] },
  { title: "[21-04] ValidatedHiddenLeverageDetector guard: no validation → None + question (time_asymmetry example)", body: `**Context**: v3.2 §14 ValidatedHiddenLeverageDetector`, labels:["ready-for-agent","enhancement","epic:hidden"] },

  // EPIC 22: EPISTEMIC HALT (3)
  { title: "[22-01] HaltManager: 6 original triggers + 4 v3.2 (translation, assumption, bias, validation) → <<<HALT>>> format §12.2 + format_for_ui", body: `**Tech**: \`workers/grilling/haltManager.ts\` KV queue of halts, active_halt, create_halt/resolve_halt/format_for_ui. Halt format PHASE/ROUND/BLOCKING_NODE/WHY_BLOCKED/IMPACT_IF_ASSUMED/USER_QUESTION plus recommended.`, labels:["ready-for-agent","enhancement","epic:halt"] },
  { title: "[22-02] Halt processing flow (Evaluate frontier → CONTEXT/FRAMEWORK? → LLM internal vs halt → user → update → resume) mermaid §12.3", body: `**Blocked by**: #70`, labels:["ready-for-agent","enhancement","epic:halt"] },
  { title: "[22-03] Halt UI: HaltModal per-type copy + translation/bias/assumption variant phrasing (voice humanized downstream)", body: `**Blocked by**: #2`, labels:["ready-for-agent","enhancement","epic:halt"] },

  // EPIC 23: UTILITY QUANTIFICATION (3)
  { title: "[23-01] User Profile interview emergent (objective 5 items, 7 nodes) + example Q1-5", body: `**Context**: §13 4142-4350 prompt + example.`, labels:["ready-for-agent","enhancement","epic:utility"] },
  { title: "[23-02] User Profile JSON schema §13.3 (user_id, baselines, red_lines, weights sum 1, thresholds, risk params) + Zod", body: `**Blocked by**: #73`, labels:["ready-for-agent","enhancement","epic:utility"] },
  { title: "[23-03] LeverageAwareUtilityCalculator + ValidatedUtilityCalculator gate (requires TranslatedValue confidence≥0.5 else ValidationError)", body: `**Context**: §13.4 + v3.2 §16 ValidatedUtilityCalculator 1713-1733`, labels:["ready-for-agent","enhancement","epic:utility"] },

  // EPIC 24: ORCHESTRATOR (3)
  { title: "[24-01] EmergentOrchestrator.run_decision: Phase1 → 1.5 → 2 (grill-with-docs) win_win? → Phase3 → LeverageModifiedMinimax → store (v3.1 + v3.2 V32)", body: `**Context**: §15 4727-4899 RunResult+OutputType + sequence diagram + KV session state.`, labels:["ready-for-agent","enhancement","epic:orchestrator"] },
  { title: "[24-02] Orchestrator V33 with 6-gate Validation Stack (translation→bias→assumption→claim→framework→systemBias + EV + BaseRate) before calc", body: `**Context**: v3.3 §1.3 validation stack.`, labels:["ready-for-agent","enhancement","epic:orchestrator"] },
  { title: "[24-03] Queues orchestration: Workers Queues for phase transitions (phase1→1.5→2→3) + KV session snapshot + R2 audit", body: `**Blocked by**: #76`, labels:["ready-for-agent","enhancement","epic:orchestrator"] },

  // EPIC 25: REJECTION COUNTER 8 TYPES (4)
  { title: "[25-01] RejectionClassifier: 8 types enum (hard_no, soft_no, lowball, conditional_no, stalling, authority, ultimatum, relational) + LINGUISTIC_MARKERS + lowball ratio <0.70", body: `**Context**: v3.4 §33.2 36-130 markers per type, ratio detect.

**Tech**: \`workers/execution/rejectionClassifier.ts\` classify(text, context)→ClassifiedRejection`, labels:["ready-for-agent","enhancement","epic:rejection"] },
  { title: "[25-02] CounterProtocolLibrary 8 protocols: 3-4 steps each (Ury balcony, Fisher probe, anchoring rejection, ZOPA, temporal inquiry, signaling test, Schelling credibility, Cialdini reciprocity) + escalation + forbidden", body: `**Context**: v3.4 §33.3 132-577 each entry framework/citation/diagnosis/counter_sequence/escalation.`, labels:["ready-for-agent","enhancement","epic:rejection"] },
  { title: "[25-03] CounterProtocol integration: decision tree new branch, leverage map read, claim classification per counter, base rate not used, EV before deploy", body: `**Context**: §33.4 integration points.`, labels:["ready-for-agent","enhancement","epic:rejection"] },
  { title: "[25-04] RejectionCounter frontend: live classification + per-type counter suggestion (voice humanized §35.4 #10)", body: `**Blocked by**: #79`, labels:["ready-for-agent","enhancement","epic:rejection"] },

  // EPIC 26: BATNA LADDER 8 LEVELS (4)
  { title: "[26-01] BATNA Revelation Ladder 0-7 (silence→general→categorical→specific→verifiable→activation_signal(warning boundary)→final_clarification→activation) + gates (strength≥3.0/4.0 + reservation gap + verified)", body: `**Context**: v3.4 §34.2 704-980 + recommend_level algorithm gap>0.2/0 etc.

**Tech**: \`workers/execution/batnaLadder.ts\` recommend_level(context, leverageMap, profile)→{level, reason, gate_check}. Gate 5+ requires strength≥4.0+verified+reservation breach; bypass logs credibility destroy.`, labels:["ready-for-agent","enhancement","epic:batna"] },
  { title: "[26-02] Warning-vs-Threat grammar (Schelling) + linguistic frames: external clock + preference preserved vs threat contingent on YOUR choice; system defaults to WARNING", body: `**Context**: §34.3 982-1023 blocked shapes table.`, labels:["ready-for-agent","enhancement","epic:batna"] },
  { title: "[26-03] BATNAResponseHandler 5 responses (probe→deflection, match→intangibles, outwait→deadline, disparage→non-defensive, bluff→level check real vs bluff retreat + ledger)", body: `**Context**: §34.4 1025-1143`, labels:["ready-for-agent","enhancement","epic:batna"] },
  { title: "[26-04] BATNA DomainCalibration (career full ladder, relationship caps 0-3 safety override for boundaries) + CredibilityLedger (user_id+relationship_id, bluff destroyed, activated gains)", body: `**Context**: §34.5-34.6`, labels:["ready-for-agent","enhancement","epic:batna"] },

  // EPIC 27: VOICE LAYER v3.5 (5)
  { title: "[27-01] Vocabulary Wall: 15 banned terms hard-fail mechanical_pass + echo rule (reuse user's words)", body: `**Context**: §35.1 11-35 never say list + VOCAB_WALL breach detection is hard failure regenerate.

**Tech**: \`workers/voice/wall.ts\` mechanical_pass(text)→[text,flags] replace em dashes→, strip emoji etc; wall list exact per §35.1 + 35.6 mechanical checks 512-515.`, labels:["ready-for-agent","enhancement","epic:voice"] },
  { title: "[27-02] Numbers & confidence humanization §35.2: echo $4,500/five months, worst-case -0.05→roughly where you are... -0.60→this hurts..., -0.05 gap 0.58→not close, 0.08→tight, HIGH flat MEDIUM hedged LOW honest, contingent→could be", body: `**Blocked by**: #87`, labels:["ready-for-agent","enhancement","epic:voice"] },
  { title: "[27-03] Structural Bans §35.3 + Extended §35.6: no rule-of-three, not just X but Y, setup/payoff, summary beats, landing sentences, em dashes, emoji, bold-label lists, announcing, agreeable openers, closers, etc + Always vary length, is/has", body: `**Blocked by**: #87`, labels:["ready-for-agent","enhancement","epic:voice"] },
  { title: "[27-04] Three-pass pipeline §35.6+35.10: A mechanical→B structural LLM report-only→C targeted rewrite flagged spans→D fact-preservation (numbers/entities) → A+B re-check; leak = bug", body: `**Blocked by**: #87, #88, #89`, labels:["ready-for-agent","enhancement","epic:voice"] },
  { title: "[27-05] 10 output-type voice rules §35.4 (interview, halts→clarification, bias challenges without naming bias, source validation, closing, leverage summary, recommendation opens with answer, close choice, BATNA deployment, rejection counters)", body: `**Context**: Before/after pairs canonical.`, labels:["ready-for-agent","enhancement","epic:voice"] },

  // EPIC 28: UI PAGES (5)
  { title: "[28-01] InterviewRound.tsx: batch numbered questions UI, batch answer box n:..., Frontier progress, halt modals stacked", body: `**Spec**: §17.2 5042 mock, §17.1 mermaid.

**Blocked by**: #2, #70`, labels:["ready-for-agent","enhancement","epic:ui"] },
  { title: "[28-02] LeverageMapDisplay → Voice natural renderer (§35.4 #6) + trajectory warning countdown", body: `**Blocked by**: #56, #91`, labels:["ready-for-agent","enhancement","epic:ui"] },
  { title: "[28-03] RecommendationDisplay → Voice natural renderer (§35.4 #7) + leverage strategy timeline + confidence natural + audit expand", body: `**Blocked by**: #66, #91`, labels:["ready-for-agent","enhancement","epic:ui"] },
  { title: "[28-04] TranslationConfirmation / SourceValidation / ClosingQuestions UI (§20.1-20.3, §35.4) voice humanized", body: `**Blocked by**: #22, #29`, labels:["ready-for-agent","enhancement","epic:ui"] },
  { title: "[28-05] Decision dashboard + past decisions searchable (hybrid search) + design-tree visualization (to_visualization graph) + CONTEXT/ADR viewers", body: `**Blocked by**: #12, #15`, labels:["ready-for-agent","enhancement","epic:ui"] },

  // EPIC 29: TESTING & DEPLOY (5)
  { title: "[29-01] Unit tests: translation 90% (3+4+5 triggers + fuzzy + extreme) + bias 85% (9 detectors + severity + max5) + assumption 100% (9 cases) + validation 100% (§23.2 fixtures)", body: `**Spec**: v3.2 §23.2 TestTranslationSystem etc, v3.3 §30.`, labels:["ready-for-agent","enhancement","epic:test"] },
  { title: "[29-02] Integration tests: phase transitions with all systems + hidden leverage 85% + Pareto/e2e Sarah walkthrough v3.2->v3.3->v3.5", body: `**Blocked by**: #76`, labels:["ready-for-agent","enhancement","epic:test"] },
  { title: "[29-03] E2E fixtures: job toxic→startup full walkthrough (leverage-aware transcript) + client negotiation $50k→62k + relationship boundaries cap test", body: `**Blocked by**: #76`, labels:["ready-for-agent","enhancement","epic:test"] },
  { title: "[29-04] Voice layer tests: test_voice_layer.py port (vocab wall hard-fail, 5 invariants, fact-preservation numbers, structural bans)", body: `**Context**: §35.9-35.10 fixes, ADR 0005.`, labels:["ready-for-agent","enhancement","epic:test"] },
  { title: "[29-05] Deployment & ops: wrangler deploy, D1 migrations, Vectorize/R2/KV provisioning script, docs/env.md, smoke seed of 58 frameworks+3 base rates", body: `**Blocked by**: #1`, labels:["ready-for-agent","enhancement","epic:deploy"] },
];

const dryRun = process.argv.includes("--dry-run");

async function createOne(t) {
  const labelsArg = t.labels.map(l => `--label "${l}"`).join(" ");
  // Escape body for CLI: use file
  const tmp = `tmp_body_${Date.now()}_${Math.random().toString(36).slice(2)}.md`;
  const body = `${t.body}\n\n---\n*Generated from ADIE specs v3.1 (6350 lines) + v3.2 (2299) + v3.3 (3271) + v3.4 (1269) + v3.5 (617) = 13,806 total, addendum precedence v3.5>v3.4>v3.3>v3.2. Stack: Cloudflare free-tier Workers/Hono D1+FTS5 Vectorize R2 KV Queues Pages + qmd adapter, multi-user isolation, OpenAI-compatible cloud gateway only, no local models. File ref at Decision Engine workspace.*`;
  writeFileSync(tmp, body, "utf8");
  const cmd = `gh issue create --repo ${repo} --title "${t.title.replace(/"/g, '\\"')}" --body-file "${tmp}" ${labelsArg}`;
  if (dryRun) {
    console.log(`[DRY] ${t.title}`);
    execSync(`rm -f "${tmp}"`, { stdio: "ignore" });
    return { number: 0, title: t.title };
  }
  try {
    const out = execSync(cmd, { encoding: "utf8" });
    // gh prints URL https://github.com/oraekene/decision-engine/issues/123
    const m = out.match(/\/issues\/(\d+)/);
    const num = m ? parseInt(m[1], 10) : 0;
    console.log(`✓ #${num} ${t.title}`);
    execSync(`rm -f "${tmp}"`, { stdio: "ignore" });
    // throttle 400ms to avoid abuse detection
    execSync(`sleep 0.4`, { stdio: "ignore" });
    return { number: num, title: t.title };
  } catch (e) {
    console.error(`✗ FAILED ${t.title}:`, e.message);
    // Try to capture gh error
    if (e.stdout) console.error(e.stdout.toString());
    if (e.stderr) console.error(e.stderr.toString());
    execSync(`rm -f "${tmp}"`, { stdio: "ignore" });
    throw e;
  }
}

const resumeIdx = (()=>{ const a=process.argv.find(x=>x.startsWith("--resume=")); return a? parseInt(a.split("=")[1],10):0; })();
const toCreate = resumeIdx>0 ? tickets.slice(resumeIdx) : tickets;
console.log(`Creating ${toCreate.length} issues in ${repo} (addendum precedence respected, resume ${resumeIdx})...`);
const results = [];
for (const t of toCreate) {
  const r = await createOne(t);
  results.push(r);
}
console.log(`Done. Created ${results.length} issues.`);
console.log(results.map(r => `#${r.number} ${r.title}`).join("\n"));
writeFileSync("scripts/created_tickets.log", results.map(r=>`${r.number}: ${r.title}`).join("\n")+"\n");
