# CONTEXT.md — AI Decision Intelligence Engine (ADIE)

> Single-context. Read `docs/adr/*` alongside. User-confirmed addendum precedence: v3.5 > v3.4 > v3.3 > v3.2 > v3.1 (v3.1 = 6350 lines base, total 13,806). All decisions honor addendum-supersedes-previous.

## Ubiquitous Language

| Term | Definition | Never say to user (Voice Wall §35.1) | Say instead |
|---|---|---|---|
| **Decision** | A fork where a human must choose among mutually exclusive `Choices` under uncertainty, with conflicting stakeholder interests. `decision_id` = `%Y-%m-%d_{type}` | — | — |
| **Choice** | One arm of a Decision (e.g., accept / counter / walk away). Has `choice_id`, `description`, `leverage_enabled` | — | — |
| **Branch** | One scenario under a Choice (`best` / `likely` / `worst`). Carries `utility_impact` (4 dims), `probability`, `red_line_risks`, `reversible` | — | — |
| **Stakeholder** | Any actor whose utility is affected (user, counterparty, family). **Internal only** | stakeholder | who's involved / everyone affected |
| **LeverageMap** | Exhaustive mapping of all power across 6 domains (Structural, Negotiation, Psychological, Resource, Informational, Positional) + 30+ types. Never referenced as artifact to user. | leverage map | show findings naturally |
| **LeveragePoint** | Atomic power: `domain`, `type`, `strength 1-5`, `durability`, `transferability`, `enforceability`, `user_aware`, `batna`, `applies_to_choices`. Stored in D1 `leverage_points`. | leverage | where you have room to push / what's working in your favor |
| **BATNA** | Best Alternative To Negotiated Agreement. `strength 1-5`. **Never surfaced as term.** | BATNA | your other option / fallback / what you'd do instead |
| **HiddenLeverageDiscovery** | Leverage where `user_belief != actual_reality`, detected via deterministic patterns (6) + emergent discovery (5) + hybrid validation. | leverage | — (same humanized) |
| **Utility** | Worth to user on `[-1.0,+1.0]` where `0 = baseline (status quo)`, `-1 = red line`, `+1 = ceiling`. Computed via 4 dims (financial/emotional/temporal/reputational) + AHP weights. | utility / utility score | what this is worth to you / what it costs you |
| **RedLine** | Hard constraint whose violation = `-1.0` regardless of other gains, unless enforceability validates otherwise. | red line | deal-breaker / hard floor / thing you won't accept |
| **Minimax** | Decision rule `v_i = max_{a_i} min_{a_{-i}} v_i(a_i,a_{-i})` (von Neumann 1928). With Leverage-Modified variant: multiplies utility by `leverage_multiplier`, applies BATNA floor, reversibility bonus `+0.1`. | minimax / worst-case utility | how bad the bad scenario gets / the floor / downside |
| **ParetoImprovement** | Change where ≥1 stakeholder better off, none worse. Win-win is Pareto over disagreement point. | Pareto / win-win | version where you both end up better off |
| **DesignTree** | Directed graph of `DecisionNode`s pending resolution. `Frontier` = unsettled nodes whose prerequisites all settled. Drives emergent questioning. Never surfaced. | design tree / frontier / round / phase | conversation flows naturally |
| **EpistemicHalt** | `<<<HALT>>>` typed halt that blocks phase until user resolves missing/ambiguous/speculative/translation/bias/assumption info. 4 triggers in v3.2+ (translation, assumption, bias, validation) + 6 original. Never named. | epistemic halt / Tier 1-4 | just the question, humanized |
| **TranslatedValue** | Natural-language → numeric conversion with 4 tiers: Direct (regex ≥0.90), Qualitative (PANAS/GSE/Schwartz 0.80-0.85), Contextual (deterministic calc 0.90-0.95), Confirmation (<0.50 discrepancy triggers user confirm → 0.95) | Tier 1-4 / translation | echo user's number/words |
| **ClaimClassification** | Every claim tagged: `VALIDATED_RESEARCH (0.80-1.0, enters)` / `USER_VALIDATED (0.70-0.95, enters)` / `PRACTITIONER_HEURISTIC (0.40-0.60, enters reduced)` / `PROBABILITY_WEIGHTED (0.50-0.80, enters)` / `HYPOTHESIS (0.20-0.40, blocked)` / `SPECULATION (0.0-0.20, rejected)` | claim classification | confidence carried by phrasing |
| **BES** | Base Rate DB lookup for any `% / rate / frequency`. Sparse by design (3 seeded). Return `"I don't have validated data"` if not found, never hallucinate. | — | — |
| **ValidationStack** | 6 gates every claim passes: Translation → User Bias (9) → Assumption Elim → Claim Classification → Framework Validation (58 entries) → System Bias (4) + EV enforcement + Base Rate | framework / validated research | Research on this is solid that... |
| **CounterProtocol** | Per `RejectionType` (8 types: hard_no, soft_no, lowball_counter, conditional_no, stalling, authority, ultimatum, relational) validated 3-4 step sequence. Warnings not threats (Schelling). | — | natural counter phrasing |
| **RevelationLadder** | BATNA deployment 0-7 (silence → general → categorical → specific → verifiable → activation_signal (warning boundary) → final_clarification → activation). Gate 5+ requires strength≥4.0+verified+reservation breach. | — | vague alternative is stronger than specific |
| **VoiceLayer** | Output humanization skin: vocabulary wall (15 banned terms), numbers as echo, confidence without jargon (HIGH=flat, MEDIUM=hedged, LOW=honest), structural bans (§35.3), 3-pass pipeline (generate against rules → cleanup → re-check). Audit trail unchanged (machine underneath). | — | sharp friend who did homework |

## ADIE Pipeline (v3.5 final)

```
User Initiation (any domain: relationships, career, purchases, negotiations, life forks)
  → Validation Stack (Translation 4-tier → Devil's Advocate 9 biases → Assumption Elimination → Claim Classification 6 tiers → Framework Library 58 → System Bias 4 + EV + Base Rate)
  → Phase1 Context Ingestion (emergent grilling with taxonomy as guide, design-tree frontier, facts vs decisions, halt-aware)
  → Phase1.5 Leverage Mapping (6 domains×5-6 types, deterministic 6 patterns + emergent 5 strategies + hybrid validation)
  → LeverageMap (classified, sourced, trajectory use-it-or-lose-it)
  → Phase2 Game Theory (leverage-expanded Pareto search, validated-only, grill-with-docs writes CONTEXT+ADRs)
  → win_win? → Pareto recommendation + leverage strategy
  → else Phase3 Minimax Tree Gen (best/likely/worst per choice, causal_chain with CONTEXT/FRAMEWORK/USER_INPUT)
  → Leverage-Modified Minimax Solver (multiplier × BATNA floor × red-line enforceability × loss-aversion 2.25 × reversibility +0.1)
  → Recommendation + LeverageStrategy + Session Closing (3 levels self→stakeholder→situation, re-opens tree if substantive)
  → Rejection Counter (8 types) + BATNA Ladder (warning grammar) for execution
  → Voice Layer (wall + plain numbers/confidence + bans + 3-pass) → user-facing prose
  → Store Outcome (D1+Vectorize+R2+KV, audit_trail translation/bias/assumption/system_bias/EV/base-rate logs must have assumptions_in_calculation==[])
```

## Bounded Contexts

- **Interview & Grilling**: EmergentGrillingEngine, Frontier calculator, HaltManager, DesignTree (D1 `decision_nodes` + KV ephemeral)
- **Translation & Validation**: Translator (directExtractor → qualitativeMapper → contextualInference → confirmationProtocol), ClaimClassifier + CalculationGate, AssumptionEliminationProtocol, BaseRateDatabase, ExpectedValueEnforcement, SystemBiasDetector
- **Leverage**: Taxonomy (6 domains), LeverageMappingEngine, DeterministicHiddenLeverageDetector (6 patterns), EmergentDiscoveryEngine (5 strategies), HybridValidationEngine, LeverageIntegrationManager
- **Decision Maths**: UtilityCalculator (4 dims + AHP + thresholds + nonlinear), ParetoAnalyzer (validated-only LP), MinimaxSolver + LeverageModifiedMinimaxSolver, RedLineValidator
- **Execution**: CounterProtocolLibrary (8 types), BATNARevelationLadder + BATNACredibilityLedger + ResponseHandler (5 responses), DomainCalibration (relationship caps 0-3)
- **Storage & Retrieval**: D1 (SQLite FTS5) + Vectorize (embeddings) + R2 (markdown blobs) + KV (session/translation cache) + Queues (async indexing/rerank). qmd adapted: BM25→D1 FTS5, sqlite-vec→Vectorize, Jina→gateway embeddings, node-llama-cpp rerank→gateway rerank, RRF fusion in Worker.
- **Voice**: VocabularyWall (mechanical), Number/Confidence humanization, StructuralBans, ThreePassPipeline (A mechanical → B structural LLM report → C targeted rewrite → D fact-preservation → A+B re-check)

## Multi-User Invariant

Every row/object/cache-key is `user_id`-partitioned. D1 foreign keys + R2 prefix `/{user_id}/{type}/{session_id}.md` + Vectorize metadata `user_id` filter + KV `user:{id}:session:{id}:*`. Frontend Auth (Cloudflare Access / custom JWT in D1 `users`+`sessions`) gates all Hono routes. No cross-user retrieval.

## Tech Stack Invariant (free tier)

Workers (Hono router) + D1 (SQLite) + Vectorize + R2 + KV + Queues + Pages. All LLM via OpenAI-compatible gateway (`OPENAI_BASE_URL`, `apiKey`, `model`) — swappable provider, cloud only, no local models. qmd `better-sqlite3`/`sqlite-vec`/`node-llama-cpp` removed; qmd Store/BM25/RRF logic ported to D1/Vectorize/Worker. No paid CF features.

## External Systems

- **LLM Gateway**: OpenAI-compatible endpoint (OpenAI/Groq/Together/Anthropic compat). Workers binding `AI_GATEWAY`. All `llm.generate(prompt)` calls via `fetch(env.AI_GATEWAY_URL + "/v1/chat/completions")` with `model`, `response_format: json_object` for structured phases.
- **qmd-main**: Bundled at `qmd-main/` as reference implementation (MIT). Reused: `src/store.ts` hybridQuery/RRF logic, `src/collections.ts` collection config, `src/db.ts` cross-runtime wrapper pattern (ported to D1). Not executed via `better-sqlite3`.
- **GitHub**: Issue tracker. All tickets are GitHub Issues with blocking edges (native dependencies or `Blocked by: #n` fallback).
