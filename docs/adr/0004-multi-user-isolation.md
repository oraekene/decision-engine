# ADR 0004: Multi-User Product Isolation

**Date:** 2026-08-29
**Status:** Accepted

## Context

Spec §6-14 assume single `user_profile` at `~/.decision_engine/user_profiles/`. User constraint: multi-user product. All phases (leverage precursors, BATNA, credibility ledger §34.6) are per-user; retrieval must never leak across users.

## Decision

- **Identity:** `users(id PK, email UNIQUE, password_hash, created_at)` + `sessions(id PK, user_id FK, token_hash, expires_at)` + `profiles(user_id PK, baselines_json, red_lines_json, utility_weights_json, thresholds_json, risk_params_json, stakeholders_json, updated_at)`. Auth middleware `withUser` validates `Authorization: Bearer <session>` against D1+KV (KV cache `session:{token}:user` TTL 1h).
- **Scoping rule:** Every D1 table includes `user_id FK NOT NULL` + index. R2 keys namespaced `/{user_id}/...`. Vectorize metadata always includes `user_id`. KV keys `user:{user_id}:session:{session_id}:*`.
- **Leverage & credibility:** `leverage_maps(decision_id+user_id)`, `leverage_points(decision_id+user_id)`, `batna_ledger(user_id, relationship_id)` composite; `get_credibility(relationship_id)` scoped to `(user_id, relationship_id)`.
- **Frontend:** Pages auth flow stores `session_token` in httpOnly cookie (Workers `Set-Cookie`); `Pages` calls `Workers` Hono `authMiddleware` for every `/api/*`.
- **QMD retrieval:** `retrieve_relevant_context(query, user_id)` adds `WHERE user_id=?` and Vectorize `filter: user_id` before RRF.

## Consequences

- No anonymous collection access; `qmd context add` semantics become per-user API.
- Tests create isolated users with `beforeEach` D1 reset per `user_id`.
- GDPR-style `DELETE /users/me` cascades deletes D1 rows + R2 prefix + Vectorize filter + KV namespace.

## Verification

- Cross-user search test: user A query never returns user B docs (D1+Vectorize isolation).
- Credibility ledger isolation test: user A's BATNA history doesn't affect user B's recommendation.
