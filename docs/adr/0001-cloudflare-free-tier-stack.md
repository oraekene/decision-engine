# ADR 0001: Cloudflare Free Tier as Primary Platform

**Date:** 2026-08-29
**Status:** Accepted
**Supersedes:** Implicit Python+qmd+local-llm stack from v3.1 spec §18.1

## Context

Spec v3.1 §18.1 prescribes Python 3.11 + FastAPI + `better-sqlite3`+`sqlite-vec`+Jina v3 local embeddings + `node-llama-cpp` rerank + local filesystem `~/.decision_engine/`. User constraint: all tech must be Cloudflare free tier + qmd+sqlite included in folder, multi-user, OpenAI-compatible cloud gateways only, no local models, addendums supersede.

Workers cannot run `better-sqlite3` native bindings. Local LLM violates "cloud only". Filesystem `~/.decision_engine` is not multi-tenant or edge-deployable.

## Decision

- **Backend:** Cloudflare Workers with Hono router. TypeScript. Single Worker `api` + scheduled Queue consumer.
- **Relational + FTS:** Cloudflare D1 (SQLite with FTS5). Replaces `better-sqlite3`. All QMD BM25 logic ported to D1 FTS5 virtual tables.
- **Vector search:** Cloudflare Vectorize. Replaces `sqlite-vec` + Jina local embeddings. Embeddings via gateway `text-embedding-3-*` → Vectorize upsert; recall via Vectorize query.
- **Blob/log markdown:** Cloudflare R2. Replaces filesystem collections (`user_profiles/`, `decision_trees/`, `leverage_maps/`, `translation_logs/`, `bias_challenge_logs/`, `adrs/`, `knowledge_base/`). Path: `/{user_id}/{collection}/{id}.md`. D1 holds metadata + FTS index of markdown.
- **Session/ephemeral:** Cloudflare KV. Replaces in-memory `EmergentOrchestrator` state, `HaltManager` queue, `DesignTree` transient nodes, translation cache, prompt version cache. Key: `user:{user_id}:session:{session_id}:*`.
- **Async:** Cloudflare Queues. Replaces synchronous `qmd index update` + `_update_qmd_index` subprocess calls. Embed/index/rerank enqueued.
- **Frontend:** Cloudflare Pages (React + Vite + Tailwind, Zustand retained from spec). Deploys static, calls Workers API.
- **Embeddings & Rerank:** OpenAI-compatible gateway (configurable `baseUrl`/`apiKey`/`model`). No `node-llama-cpp`. RRF fusion computed in Worker, not via local model.

## Consequences

- `qmd-main/src/db.ts`, `src/store.ts`, `src/llm.ts` are reference only; D1 adapter re-implements their interfaces (`createStore`, `hybridQuery`, `structuredSearch`, `generateEmbeddings`, `Rerank`) against bindings.
- `wrangler.toml` declares `d1_databases`, `vectorize`, `r2_buckets`, `kv_namespaces`, `queues`.
- Free tier limits (D1 5GB/5M reads/day, Workers 100k req/day, Vectorize 5M queried vectors) acceptable for multi-user preview; need quota monitoring.
- Local dev uses `wrangler dev --local --persist` with D1/Vectorize simulators; `vitest` retains CI contract from spec.

## Verification

- `wrangler dev` serves Hono routes locally.
- D1 FTS5 search returns same relevance as BM25 fixture `test/eval.test.ts` (ported).
- Vectorize recall parity with `sqlite-vec` on sampled `knowledge_base` (bench: `src/bench/bench.ts`).
