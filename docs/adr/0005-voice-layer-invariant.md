# ADR 0005: Voice Layer as Output Skin (Invariant-Preserving)

**Date:** 2026-08-29
**Status:** Accepted
**References:** Spec §35 (v3.5 Voice Layer, 617 lines, highest precedence)

## Context

v3.5 adds humanization that closes "user never sees the machine": 15-term Vocabulary Wall, numbers-as-echo, confidence without jargon, structural bans (§35.3), 10 output-type templates (§35.4), 3-pass pipeline (generate against rules → cleanup → re-check). It declares `§35.5` 5 invariants: don't soften challenges, don't round warnings, don't drop caveats, don't change recommendation, don't invent sentiment. Audit trail (`§24`) is untouched (machine layer persists).

## Decision

- **Generation-time injection:** Voice rules §35.7 prompt block appended to Master System Prompt (§4.6) for every user-facing generation. Never patch afterwards as sole mechanism.
- **3-pass pipeline (specified §35.10):**
  - **A Mechanical** (deterministic, no LLM): replace `—`/`–`→`,/./()`, strip `❓➡️🎯⚡`, `“”‘’`→`"'`, hard-fail on `VOCAB_WALL` `["leverage","batna","utility","minimax","pareto","red line","frontier","epistemic","tier 1","ward..."]` → regenerate, never patch.
  - **B Structural check** (cheap LLM report-only): given draft + ban list, report violations with line refs, no rewrite.
  - **C Targeted rewrite** (conditional LLM): rewrite only flagged spans.
  - **D Fact-preservation** (deterministic): extract numbers/entities/conditionals pre vs post; mismatch → fail. For analytical outputs strict; interview lighter.
  - Re-run A+B after any C.
  - Final assertion: search for wall term leak → hard bug.
- **Audit trail invariant:** `docs/agents` storage retains all internal scores/classifications/citations; voice is one-directional display transformation. `strip()-to-claims` test: claims before/after voice identical.
- **Templates:** `RecommendationDisplay`, `LeverageMapDisplay`, `BiasChallenge`, `SourceValidation`, `ClosingQuestions` are natural-language renderers per §35.4 before/after pairs; internal protocol markers (`❓`, `➡️`, `<<<HALT>>>`) remain in protocol but never shown (UI numbers questions, shows suggested answer as tentative guess).

## Consequences

- Voice module `workers/voice/` (wall, humanize, threePass) is invoked on every Hono response that surfaces to user; not on internal audit writes.
- `test_voice_layer.py` (ported to `workers/voice/voice.test.ts`) asserts wall breach = hard fail, invariants, and round-trip claim preservation.

## Verification

- `mechanical_pass` unit test: wall breach for all 15 terms → error list.
- `fact_preservation` test: number leaking/modification → fail.
- Manual QA: recommendation `-0.60` renders as "this one hurts if it goes wrong" (per §35.2) while audit retains `-0.60`.
