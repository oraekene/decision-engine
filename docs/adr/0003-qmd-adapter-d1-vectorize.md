# ADR 0003: qmd + SQLite Adapted to D1 + Vectorize + R2 + KV

**Date:** 2026-08-29
**Status:** Accepted
**References:** `qmd-main/src/store.ts:4429` QMDStorageSystem, `src/db.ts`, `src/collections.ts`, `src/paths.ts`

## Context

Spec §14 mandates QMD with hybrid BM25 + vector + LLM rerank + RRF fusion, 8 collections under `~/.decision_engine/`, indexed via `qmd collection add` subprocess, `better-sqlite3` FTS5 + `sqlite-vec` for retrieval. v3.2/v3.3 add `translation_logs` + `bias_challenge_logs` collections and audit trail schema (§17.2). User includes `qmd-main` for reuse but requires Cloudflare single-context and multi-user.

## Decision

- **Schema mapping:**
  - `better-sqlite3` → D1. Preserve FTS5: each collection gets `*_fts(content, file UNINDEXED, user_id UNINDEXED)` virtual table with BM25 ranking. Triggers keep FTS in sync.
  - `sqlite-vec` → Vectorize. One index per collection kind: `adie-profiles`, `adie-decisions`, `adie-leverage`, `adie-knowledge`. Metadata: `user_id`, `collection`, `file`, `chunk_id`.
  - Filesystem `~/.decision_engine/{collection}/{id}.md` → R2 `/{user_id}/{collection}/{id}.md`. D1 rows store `r2_key`, `user_id`, JSON frontmatter, `fts_content` for BM25.
  - In-memory store → D1 + KV. `createStore({dbPath})` adapter `workers/lib/qmdAdapter.ts` exposes same API (`search`, `vsearch`, `query`, `get`, `multiGet`, `upsert`, `reindexCollection`, `generateEmbeddings`) but against bindings.

- **Hybrid query (port `hybridQuery` from store.ts):**
  1. D1 FTS5 `SELECT ... WHERE *_fts MATCH ? ORDER BY rank` (BM25)
  2. Vectorize `query(embedding, filter: user_id)` → vector results
  3. RRF fusion `score = Σ 1/(k+rank)` with `k=60` in Worker (pure TS, no native)
  4. Gateway rerank (LLM) → final ranking (spec §14.2). Queued if latency-sensitive (`?no-rerank`).

- **Collections (D1 `collections(user_id, name, mask, description, r2_prefix, fts_table, vectorize_index)` + R2):**
  `user_profiles`, `decision_trees`, `interview_logs`, `leverage_maps`, `translation_logs` (NEW v3.2), `bias_challenge_logs` (NEW v3.2), `claim_classification_logs` (NEW v3.3), `stakeholders`, `outcomes`, `context_glossary` (CONTEXT.md), `adrs`, `knowledge_base`.

- **Multi-user scoping:** Every search adds `WHERE user_id=?` (D1) and `filter: {user_id}` (Vectorize). KV namespace isolated: `user:{id}:*`.

## Consequences

- `qmd-main` remains as reference/vendor; `workers/lib/qmdAdapter.ts` re-implements `QMDStorageSystem` interface (§14.4) against Cloudflare bindings, preserving methods `store_user_profile`, `store_decision_tree`, `store_leverage_map`, `store_translation_log`, `store_bias_challenge_log`, `retrieve_relevant_context`, `_update_qmd_index` (now Queue).
- Migration script `scripts/migrate-d1.ts` (port of `migrate-schema.ts`) creates D1 tables + FTS5 + seeds collections/README.
- Bench parity harness ports `qmd bench <fixture.json>` to D1/Vectorize (`workers/bench/bench.ts`).

## Verification

- `vitest` suite ports `test/store.test.ts`, `test/store-*.test.ts`, `test/eval.test.ts` to D1+Vectorize mock bindings; BM25 fixture passes.
- Manual `wrangler d1 execute` confirms FTS5 queries and Vectorize recall.

## Links

- Spec §14.1-14.5, §17 Persistent Storage, §30 Testing (D1 migration)
- ADR 0001 (stack), ADR 0002 (gateway for embeddings/rerank)
