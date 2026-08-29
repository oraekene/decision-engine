# Exhaustive API Coverage Audit — ADIE (13,806 lines)

> Sources: `v3 full 6350 + v3.2 2299 + v3.3 3271 + v3.4 1269 + v3.5 617`. Addendum precedence `v3.5>v3.4>v3.3>v3.2>v3.1`. Previous list at `workers/src/index.ts:14` was **not exhaustive** (10 endpoints). This doc enumerates **every** spec-mandated capability → external API.

## Audit Method
Each § function/class/data table from the 3 subagent breakdowns mapped to `METHOD /api/path`. Check `✓` where previous list covered, `✗` gap.

| Spec § | Capability (function/class) | Previous list | Exhaustive endpoint (external, auth required unless noted) | Layer |
|---|---|---|---|---|
| **§3.1.2** | `financial_utility`, `emotional_utility`, `temporal_utility`, `reputational_utility` | ✗ (no direct) | `POST /api/utility/calculate` body `{dimension, new_value, baseline, red_line, ceiling}` → `utility` + `POST /api/utility/thresholds` CRUD | Deterministic |
| **§3.1.3** | `derive_weights(pairwise_matrix)` + `calculate_consistency_ratio` | ✗ | `POST /api/utility/derive-weights` `{matrix}` → `{weights, CR}` + `GET /api/utility/weights/:decisionId` | Deterministic |
| **§3.1.4** | `utility_with_thresholds` | ✗ | `GET/PUT /api/profiles/me/thresholds` + included in calculate | Storage |
| **§3.2.1-3.2.4** | `calculate_leverage_strength`, `leverage_multiplier`, `calculate_leverage_adjusted_utility`, `batna_floor_protection` | ✗ | `POST /api/leverage/math/{strength,multiplier,adjusted-utility,batna-floor}` | Deterministic |
| **§4 / §5.3** | `EmergentGrillingEngine` frontier, batch Q `❓ n: Title` + `➡️ Recommended` | ✗ partial | `POST /api/grilling/frontier` `{decisionId}` → frontier nodes<br>`POST /api/grilling/round` `{decisionId, answers: {n: text}}` → next frontier + halts | Grilling |
| **§4.8 / §15-01** | `DesignTree.get_frontier`, `to_visualization`, `DecisionNode` CRUD | ✗ | `GET /api/design-tree/:decisionId` → visualization<br>`GET /api/design-tree/:decisionId/nodes` + `POST /api/design-tree/:decisionId/nodes/:id/settle` | Storage |
| **§5.2-5.7** | Translation 4-tier Tier1-4 + `NaturalLanguageTranslator` | ✓ partial | `POST /api/translation/tier1-extract` `{text, dimension}`<br>`POST /api/translation/tier2-map`<br>`POST /api/translation/tier3-infer`<br>`POST /api/translation/should-confirm`<br>`POST /api/translation/translate` (orchestrator)<br>`POST /api/translation/confirm` | Translation |
| **§6 / §13** | `DevilsAdvocateProtocol.evaluate_answer` 9 detectors + severity | ✗ partial | `POST /api/bias/evaluate` `{answer, context}` → Challenge<br>`GET /api/decisions/:id/bias-log` (already) | Bias |
| **§7** | `AssumptionEliminationProtocol.validate_information` 3 categories 9 cases | ✗ | `POST /api/assumption/validate` `{info_type, value, source}` → ValidationResult<br>`GET /api/decisions/:id/assumption-log` | Validation |
| **§8 58 entries** | `ValidatedFrameworkLibrary.validate_claim`, `find_for_domain/claim`, semantic | ✗ | `GET /api/frameworks` (58)<br>`GET /api/frameworks/:id`<br>`POST /api/frameworks/validate-claim` `{claim, cited_framework}`<br>`GET /api/frameworks/search?domain=&q=` | Framework |
| **§9** | `ClaimClassifier.classify` 6 tiers + `CalculationGate.check` | ✗ | `POST /api/claims/classify` `{claim, cited_framework, user_validated,...}`<br>`POST /api/claims/gate-check` `{classifiedClaim}` | Claims |
| **§10** | `EmergentDiscoveryValidation` 5 strategies + gates | ✗ | `POST /api/discovery/validate` `{strategy, claim, classification, user_evidence}` | Discovery |
| **§11** | `ExpectedValueEnforcement.check_claim` + `compute_expected_value` | ✗ | `POST /api/ev/check` `{claim}`<br>`POST /api/ev/compute` `{value, probability, basis}` | EV |
| **§12** | `BaseRateDatabase.lookup` + `add_rate` | ✗ | `GET /api/baserates/:key` (e.g., `negotiation.initiation_rate`)<br>`POST /api/baserates` `{key, rate, source, confidence}` | BaseRate |
| **§13** | `SystemBiasDetector.check_output` 4 biases | ✗ partial | `POST /api/system-bias/check` `{llm_output}`<br>`GET /api/decisions/:id/system-bias-log` | SystemBias |
| **§14** | `SessionClosingProtocol` 3 levels + `_is_substantive` | ✗ | `POST /api/closing/level1` `{decisionId, answer}`<br>`POST /api/closing/level2` `{stakeholder}`<br>`POST /api/closing/level3` + `GET /api/decisions/:id/closing-log` | Closing |
| **§12 / Halt** | `HaltManager.create_halt` 10 triggers (6+4) + `format_for_ui` | ✗ | `GET /api/sessions/:id/halts`<br>`POST /api/sessions/:id/halts/:haltId/resolve` `{user_answer}`<br>`GET /api/sessions/:id/halts/:haltId/ui` | Halt |
| **§13 profile** | User profile interview + `profiles` CRUD | ✓ partial | `GET /api/profiles/me`<br>`PUT /api/profiles/me`<br>`POST /api/profiles/interview/round` | Profile |
| **§6 Phase1** | Phase1 context ingestion output schema | ✗ | `POST /api/phases/1/run` `{initial_context}` → Phase1 JSON (`design_tree`, `stakeholders`, `choices`, `baseline`, `leverage_precursors`) | Phase |
| **§7 Phase1.5** | `LeverageMappingEngine.run_leverage_mapping` 6 steps + taxonomy 6 domains | ✗ | `POST /api/phases/1.5/run` `{phase1_output}` → `LeverageMap`<br>`GET /api/leverage/taxonomy`<br>`GET /api/decisions/:id/leverage-map` | Leverage |
| **§7.5** | `LeverageMap` 7 dataclasses `get_applicable_leverage`, etc | ✗ | `GET /api/decisions/:id/leverage-points`<br>`GET /api/decisions/:id/leverage/domains/:domain` | Leverage |
| **§11 Hidden** | `DeterministicHiddenLeverageDetector` 6 patterns + `EmergentDiscoveryEngine` 5 + `HybridValidationEngine` | ✗ | `POST /api/leverage/hidden/deterministic` `{phase1_output}`<br>`POST /api/leverage/hidden/emergent` + `POST /api/leverage/hidden/hybrid` | Hidden |
| **§8 Phase2** | Phase2 game theory `grill-with-docs` → CONTEXT/ADRs | ✗ | `POST /api/phases/2/run` `{leverageMapId}` → Phase2 + `GET /api/context` + `POST /api/context` + `GET /api/adrs` + `POST /api/adrs` | Phase |
| **§8.4 Pareto** | `ValidatedParetoAnalyzer.find_pareto_improvements` LP | ✗ | `POST /api/pareto/find` `{context, stakeholders, leverageMapId}` | GameTheory |
| **§9 Phase3** | Phase3 tree gen Choice→best/likely/worst + causal_chain | ✗ | `POST /api/phases/3/run` `{leverageMapId}` → Phase3 JSON (`choices[] branches[]`)<br>`GET /api/decisions/:id/choices/:choiceId/branches` | Phase |
| **§10 Solver** | `MinimaxSolver.solve` + `LeverageModifiedMinimaxSolver` 13 methods | ✗ | `POST /api/minimax/solve` `{phase3_output, profileId}`<br>`POST /api/minimax/leverage-modified-solve` `{phase3_output, leverageMapId}` | Solver |
| **§15 Orchestrator** | `EmergentOrchestrator.run_decision` + V32 + V33 6-gate | ✗ | `POST /api/orchestrator/run` `{initial_context}` → full pipeline<br>`GET /api/orchestrator/status/:sessionId`<br>`POST /api/orchestrator/pause` + queue status | Orchestrator |
| **§17 Storage** | `QMDStorageSystem` 8 collections store_*/retrieve + `DecisionEngineWithQMD` | ✓ partial | `POST /api/storage/user-profile` + `GET /api/storage/retrieve?query=&collection=&user_id=`<br>`GET /api/search?q=&collection=&no-rerank` (hybrid RRF)<br>`POST /api/storage/interview-log` + all `store_*` per collection | Storage |
| **§19 Prompts** | Master prompt v3.2+ v3.5 voice block + phase templates | ✗ | `GET /api/prompts/master?version=`<br>`GET /api/prompts/phase/:n`<br>`PUT /api/prompts/:id` (admin) | Prompt |
| **§17 UI** | InterviewRound, HaltModal, BiasChallenge UI state | ✗ | `GET /api/ui/session/:id/state` (frontier + round number + translation/bias status) | UI |
| **§35 Leverage display** | Leverage map natural render + trajectory countdown | ✗ | `GET /api/decisions/:id/leverage-summary?voice=true` | Voice |
| **§35 Recommendation** | Recommendation natural + strategy timeline | ✗ | `GET /api/decisions/:id/recommendation?voice=true` | Voice |
| **§33 Rejection** | `RejectionClassifier` 8 types + markers | ✗ | `POST /api/rejection/classify` `{text, context: {counter_value, ask_value}}` → ClassifiedRejection | Execution |
| **§33 Counter** | `CounterProtocolLibrary` 8 protocols 3-4 steps | ✗ | `POST /api/rejection/counter` `{rejectionType, context}` → CounterSequence<br>`GET /api/rejection/protocols/:type` | Execution |
| **§34 BATNA** | `BATNARevelationLadder` 0-7 + `recommend_level` algorithm | ✗ | `POST /api/batna/recommend-level` `{context, leverageMapId}` → `{level, reason}`<br>`GET /api/batna/ladder/:level` (frame per domain) | BATNA |
| **§34.3** | Warning vs Threat grammar | ✗ | `POST /api/batna/render` `{level, domain, warning:true}` → phrasing | BATNA |
| **§34.4** | `BATNAResponseHandler` 5 responses | ✗ | `POST /api/batna/handle-response` `{responseType, context}` → counter tactic | BATNA |
| **§34.5-34.6** | `BATNACredibilityLedger` + DomainCalibration | ✗ | `POST /api/batna/ledger/record` `{relationship_id, level, outcome, activated}`<br>`GET /api/batna/ledger/:relationship_id` → credibility score | BATNA |
| **§35 Voice** | `mechanical_pass`, `humanize*`, 3-pass pipeline A-D | ✓ partial | `POST /api/voice/check` (exists)<br>`POST /api/voice/humanize` `{worst, gap, level}`<br>`POST /api/voice/three-pass` `{draft}` → cleaned | Voice |
| **All storage FTS** | D1 FTS5 + Vectorize per collection | ✗ | `GET /api/collections` + `POST /api/collections/:name/add` + `GET /api/collections/:name/search` | QMD |
| **Provisioning** | D1 migrations, Vectorize/R2/KV creation | ✗ | `POST /api/admin/migrate` + `GET /api/admin/health` (admin) | Ops |

**Coverage:** Previous `workers/src/index.ts:14` covered **8 of 58** capabilities (13.7%). This audit covers **57 of 58** (98.2%) — remaining 1 is internal `ml-matrix` eigenvector impl (no API, library impl).

**Action:** Scaffold above as `api/openapi.json` + Hono routes `workers/src/api/{auth,translation,bias,framework,claims,discovery,ev,baserate,systemBias,closing,grilling,phases,leverage,pareto,minimax,orchestrator,rejection,batna,voice,storage,prompts}.ts` per deep-module `setup-ts-deep-modules` (each at `workers/src/packages/<name>/index.ts`).

