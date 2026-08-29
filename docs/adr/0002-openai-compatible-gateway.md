# ADR 0002: OpenAI-Compatible Cloud LLM Gateway (No Local Models)

**Date:** 2026-08-29
**Status:** Accepted

## Context

Spec uses `llm_client.generate(prompt)` throughout (EmergentGrillingEngine, EmergentDiscoveryEngine, Translation qualitative mapping, rerank). `qmd-main/src/llm.ts` binds `node-llama-cpp` with embeddinggemma + qwen3-reranker local models. User constraint: all LLM gateways utilise open OpenAI-compatible endpoints so providers swappable; all AI/LLM endpoints cloud-based, no local models.

## Decision

- Single abstraction `LlmGateway` in `workers/lib/llmGateway.ts`:
  ```ts
  interface LlmGateway { chat(req: {messages, model?, temperature?, response_format?}): Promise<string>;
                         embed(texts: string[]): Promise<number[][]>;
                         rerank(query: string, docs: string[]): Promise<{doc, score}[]> }
  ```
  Implemented as `fetch(env.AI_GATEWAY_URL + "/v1/chat/completions")` (and `/v1/embeddings`) with `Authorization: Bearer env.AI_GATEWAY_KEY`. `env.AI_GATEWAY_URL` configurable per-provider (OpenAI, Groq, Together, Anthropic OpenAI-compat). `env.AI_GATEWAY_MODEL` swappable.
- All 5 phase prompts + master prompt v3.2+v3.5 voice rules injected as system message; structured phases request `response_format: {type:"json_object"}`.
- Rerank via gateway: first try provider rerank endpoint if available, fallback to LLM prompt-based reranking via `chat` (deterministic `temperature 0.1`).
- No `node-llama-cpp`, no `better-sqlite3` model loads. `qmd-main/src/llm.ts` retained as vendored reference only; Workers build excludes `optionalDependencies sqlite-vec-*`.

## Consequences

- Provider switch is env var change, no code change.
- Embeddings are remote; latency mitigated via Queues async indexing.
- Tests mock gateway via `fetch` stub, not `node-llama-cpp`.

## Verification

- `LlmGateway` unit test mocks `fetch` and asserts correct URL/header/body.
- Integration test hits OpenAI-compatible mock server and validates JSON parse + halt format `<<<HALT>>>`.

## Links

- Overrides spec §3.1-§18.1 LLM rows: Anthropic Claude → gateway, Jina/qwen3 local → gateway.
- Supports VoiceLayer §35.7 injection (prompt rule appended to every user-facing generation).
