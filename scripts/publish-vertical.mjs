#!/usr/bin/env node
// Strict /to-tickets vertical slices — publish with native GitHub blocking (fallback to body)
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.startsWith("github_pat_")) delete process.env.GITHUB_TOKEN;

const repo = "oraekene/decision-engine";

// 14 tracer-bullet vertical slices approved 2026-08-29
const tickets = [
  {
    title: "[V-01] Auth vertical — register/login/session + protected Decision Input",
    blockedBy: [],
    what: `User can register, log in, and reach a protected Decision Input. Cuts through D1 \`users/sessions\` (migration 0001), Hono \`authMiddleware\` (Bearer + httpOnly cookie, KV cache), Pages Login/Register + ProtectedRoute, and tests for login→me→logout and cross-user isolation. Uses Cloudflare primary for no extra provider.`,
    criteria: [
      "Register → login → GET /api/users/me 200, logout → 401; password never returned, token hashed SHA-256",
      "ProtectedRoute redirects to /login on 401, persists via Zustand + cookie; second user cannot read first profile",
      "Vitest covers happy/expired/missing + KV cache hit; `wrangler d1 execute` migration applies clean",
    ],
  },
  {
    title: "[V-02] Profile + Tier1 translation vertical — save $4,500 → profile stored + FTS indexed",
    blockedBy: [0],
    what: `User saves baselines/red_lines and answers "About $4,500" → Tier1 \`directExtractor\` (regex financial $4,500 → 4500 tolerance 450 HIGH ≥0.90) persists to D1 \`profiles\` JSON + R2 \`/{user_id}/user_profiles/{id}.md\` with YAML frontmatter, enqueued to Vectorize, retrievable via hybrid search scoped to user.`,
    criteria: [
      "PUT /api/profiles/me round-trips; R2 object exists with frontmatter user_id/created",
      "POST /api/translation/tier1-extract {\"About $4,500\"} → 4500 tolerance 450 HIGH; FTS search finds profile by user_id only",
      "Cross-user search never returns other profile (isolation test)",
    ],
  },
  {
    title: "[V-03] Tiers 2-4 + confirmation vertical — 3 vs 4 discrepancy → user confirm 0.95",
    blockedBy: [1],
    what: `End-to-end 4-tier translation: Tier2 PANAS “miserable”→3 (0.85), Tier3 deterministic runway 22.5k/4.5k→5.0 (0.90), Tier4 triggers (discrepancy T1 3 vs T2 4, extreme ≤2/≥9, conf<0.50) → halt → user confirms 3 → final confidence 0.95 logged to translation_logs.`,
    criteria: [
      "POST /api/translation/translate \"miserable, maybe 3/10\" → tier1 3 HIGH, tier2 4.0, needsConfirmation true",
      "Confirm → 0.95; POST /api/translation/confirm persists to D1+R2 translation_logs",
      "Extreme ≤2 and low_confidence <0.50 each trigger confirmation halt (4 trigger tests)",
    ],
  },
  {
    title: "[V-04] Bias + assumption gate vertical — challenge + halt before calc",
    blockedBy: [1],
    what: `Per-answer bias check (9 detectors, loss-aversion “devastating, cannot risk” + savings 5mo → MEDIUM challenge) and assumption elimination (3 categories 9 cases, “How do you know?”) block calculations until user validates.`,
    criteria: [
      "POST /api/bias/evaluate {\"devastating cannot risk\", expectedValue 0.3} → loss_aversion MEDIUM, evidence includes savings",
      "POST /api/assumption/validate {counterparty_constraint, \"They need ASAP\", \"assumed\"} → valid false halt_required true",
      "Max 5 challenges/session enforced via KV; banned phrase “Probably” triggers halt",
    ],
  },
  {
    title: "[V-05] Framework + claim gate vertical — 58 entries, 6 tiers, calc gate 0.50",
    blockedBy: [0],
    what: `Framework Library D1 seeded 58 entries (batna_theory … gouldner/pruitt), validate_claim (supports/does_not_support, Vectorize semantic), ClaimClassifier 6 tiers (0.95/0.85/0.50/0.65/0.30/0.10) + CalculationGate 0.50 blocks HYPOTHESIS/SPECULATION from solvers, provenance carried to audit.`,
    criteria: [
      "GET /api/frameworks count 58; POST /api/frameworks/validate-claim \"Having alternatives\"+batna_theory → valid HIGH",
      "Unknown ID rejected, misapplication detected; SPECULATION 0.10 cannot enter calc",
      "PRACTITIONER 0.50 allowed reduced weight, HYPOTHESIS 0.30 blocked with GateError",
    ],
  },
  {
    title: "[V-06] Discovery + EV + BaseRate vertical — analogical → EV → base rate honesty",
    blockedBy: [4],
    what: `5 discovery strategies (analogical counterfactual perspective temporal constraint) validated per §10 forbidden lists, EV enforcement (14 contingent markers + 7 certainty markers → EVViolation vs compute 0.65), BaseRate sparse lookup (negotiation 0.57 true, “Series B fail” → not found).`,
    criteria: [
      "POST /api/discovery/validate analogical \"NEVER accept\" without label → REJECTED; practitioner rewrite 0.45 passes",
      "POST /api/ev/check \"equity is worth $300k\" → violation; POST /api/ev/compute 0.6×300k → 180k PROBABILITY_WEIGHTED 0.65",
      "GET /api/baserates/negotiation.initiation_rate → 0.57 HIGH; unknown → message with 3 options",
    ],
  },
  {
    title: "[V-07] SystemBias + closing vertical — hallucination flagged, 3-level close re-opens",
    blockedBy: [4],
    what: `SystemBiasDetector (4 biases, fabricated_specificity HIGH on \\d+%) flags LLM output before pipeline, triggers closing protocol 3 levels (SELF, stakeholder template, SITUATION) with _is_substantive (>10 chars) re-opens DesignTree.`,
    criteria: [
      "POST /api/system-bias/check \"85% succeed\" → fabricated_specificity HIGH flagged",
      "POST /api/closing/level1 \"no\" → complete; \"I’m scared of losing health insurance\" → session_complete false, tree re-opens",
      "Completeness illusion triggers closing; logs to system_bias_logs + closing_logs",
    ],
  },
  {
    title: "[V-08] DesignTree + frontier vertical — 10 NodeTypes + get_frontier + visualization",
    blockedBy: [0],
    what: `DesignTree with 10 NodeTypes (incl. TRANSLATION_CHECK/BIAS_CHECK), DecisionNode 12+ fields (translated_value ... claim_classification), get_frontier (not settled & prereqs settled), to_visualization renders Translated/Bias, D1 decision_nodes+edges + KV snapshot, GET visualization graph.`,
    criteria: [
      "GET /api/design-tree/:id shows frontier = unsettled where prereqs settled; settled node removed from next frontier",
      "Visualization includes \"Translated: 4500 (conf 0.90)\" and \"Bias: DETECTED\" when present",
      "D1 persistence round-trips via decision_nodes table with user_id FK",
    ],
  },
  {
    title: "[V-09] Phase1 → leverage mapping vertical — 6 domains → LeverageMap with hidden",
    blockedBy: [7,3],
    what: `Phase1 emergent interview (6 objectives + 12 nodes) → Phase1.5 taxonomy-guided grilling 6 domains ×5-6 types (Structural … Positional) → deterministic 6-pattern + emergent 5-strategy + hybrid 0.4/0.4/0.2 → LeverageMap 7 dataclasses (LeveragePoint 1-5, HiddenLeverage, DomainSummary…) per §7.5 example 3 points 2 hidden.`,
    criteria: [
      "POST /api/phases/1/run → Phase1 JSON with leverage_precursors; POST /api/phases/1.5/run → LeverageMap with domain_summary 6",
      "GET /api/leverage/taxonomy returns 30+ types across 6 domains",
      "Example JSON §7.6 validates (BATNA 4.0, informational 4.5, user 3.7 vs belief 2.0 gap +1.7)",
    ],
  },
  {
    title: "[V-10] Hidden 6 + emergent 5 + hybrid validation vertical — validated only",
    blockedBy: [8],
    what: `Full hidden leverage pipeline validated-only: deterministic patterns (BATNA underest., scarcity, time asymmetry, dependency, info asymmetry, network holes) guarded (no validation → None + question), emergent 5 prompts → parse → dedupe → HybridValidationEngine research>0.7 etc, ValidatedHiddenLeverageDetector.`,
    criteria: [
      "POST /api/leverage/hidden/deterministic with validated BATNA gap → HiddenLeverageDiscovery; without validation → None + ask",
      "POST /api/leverage/hidden/emergent counterfactual → parsed findings, cross_validated flag set when pattern overlap",
      "test_hidden_batna/scarcity/time fixtures pass (spec 5726 etc)",
    ],
  },
  {
    title: "[V-11] Pareto + Phase3 tree + leverage-modified solver vertical — recommendation + audit clean",
    blockedBy: [8],
    what: `ValidatedParetoAnalyzer (leverage filtered), Phase3 tree Choice→best/likely/worst + causal_chain (CONTEXT/FRAMEWORK/USER_INPUT) + utility 4 dims + AHP CR<0.1, Standard Minimax + LeverageModifiedMinimax (multiplier worst 0.10 likely 0.08 best 0.05 cap 0.5-2.0, BATNA floor -strength*0.15, red-line enforceability, loss aversion 2.25, reversibility +0.1) → recommendation + leverage_strategy + audit assumptions_in_calculation==[].`,
    criteria: [
      "POST /api/pareto/find with mixed valid/invalid leverage → invalid excluded; win_win correctly false when ZOPA empty",
      "POST /api/minimax/leverage-modified-solve branch multiplier capped 0.5-2.0, BATNA floor applied on worst-case",
      "Audit JSON calculation_audit.assumptions_in_calculation empty; confidence HIGH when gap 0.58",
    ],
  },
  {
    title: "[V-12] Orchestrator V33 6-gate vertical — run_decision + Queues + KV session",
    blockedBy: [10],
    what: `EmergentOrchestrator run_decision chains Translation→Bias→Assumption→Claim→Framework→SystemBias + EV + BaseRate before calc, Phase1 → Phase1.5 → Phase2 (grill-with-docs writes CONTEXT/ADRs) → Phase3 → solver → Queues phase transitions + KV snapshot + R2 audit, Cloudflare AI primary with gateway fallback via one var.`,
    criteria: [
      "POST /api/orchestrator/run {situation} → full pipeline JSON with translation/bias/assumption logs, win_win path vs minimax path",
      "GET /api/orchestrator/status/:session shows KV phase/round/leverageMap; grill-with-docs writes term to GET /api/context",
      "AI_PROVIDER=cloudflare uses env.AI when present, AI_PROVIDER=gateway uses fetch; both return same contract",
    ],
  },
  {
    title: "[V-13] Rejection 8 + BATNA 0-7 vertical — execution layer warning grammar",
    blockedBy: [10],
    what: `RejectionClassifier 8 types + LINGUISTIC_MARKERS + lowball ratio <0.70, CounterProtocolLibrary 8 ×3-4 steps (Ury balcony, Fisher probe, anchoring rejection, ZOPA, temporal inquiry, signaling test, Schelling credibility, Cialdini reciprocity) + escalation, BATNA ladder 0-7 with gates (strength≥3.0/4.0, reservation gap), warning vs threat grammar (Schelling), 5 response handlers, domain caps (relationship 0-3), CredibilityLedger per relationship.`,
    criteria: [
      "POST /api/rejection/classify \"final answer\" → HARD_NO 0.85; counter $40k vs ask $70k ratio 0.57 → LOWBALL",
      "POST /api/rejection/counter HARD_NO → 4-step balcony sequence; LOWBALL forbids midpoint, suggests component split",
      "POST /api/batna/recommend-level gap 0.2 → L1, gap≤0+strength4.0 → L5 warning-framed; relationship domain caps at 3 without safety_override",
    ],
  },
  {
    title: "[V-14] Voice 3-pass vertical — humanized interview/recommendation, invariants untouched",
    blockedBy: [10],
    what: `Voice layer end-to-end: vocab wall 15 terms hard-fail mechanical_pass (—→, emoji strip, curly→straight), numbers humanized (-0.05→roughly where you are, -0.60→hurts, gap 0.58→not close), confidence natural (HIGH flat, MEDIUM hedged, LOW honest, contingent→could be), structural bans, 3-pass A mechanical→B structural report→C targeted rewrite→D fact-preservation (numbers/entities) → re-check, 10 output-type templates (interview → BATNA) preserve protocol numbering underneath, audit retains scores.`,
    criteria: [
      "POST /api/voice/three-pass \"Your leverage is 3.7\" → VOCAB WALL BREACH rejected; humanized → \"where you have room to push is 3.7\" passes",
      "Worst -0.05 vs baseline renders \"roughly where you are today\" via POST /api/voice/humanize; recommendation opens with answer not reasoning",
      "Strip to claims before/after identical (numbers/entities preserved); audit retains -0.60",
    ],
  },
];

let created = [];
for (let i=0;i<tickets.length;i++) {
  const t = tickets[i];
  const blockedByText = t.blockedBy.length===0 ? "None — can start immediately" : t.blockedBy.map(idx=>`#${tickets[idx].title}`).join(", ");
  // But we need real numbers after creation — use placeholder for now, will wire native dependencies after
  const body = `## Parent\n\nADIE vertical tracer bullet (specs 13,806 lines, precedence v3.5>v3.4). Hono kept per ADR 0001.\n\n## What to build\n\n${t.what}\n\n## Acceptance criteria\n\n${t.criteria.map(c=>`- [ ] ${c}`).join("\n")}\n\n## Blocked by\n\n${blockedByText}\n`;
  const tmp = `tmp_vert_${i}.md`;
  writeFileSync(tmp, body, "utf8");
  const labels = `--label "ready-for-agent" --label "enhancement" --label "epic:infra"`;
  // epic label generic for vertical; could map but keep infra for now — we will add wayfinder:map label to map later
  const cmd = `gh issue create --repo ${repo} --title "${t.title.replace(/"/g,'\\"')}" --body-file "${tmp}" ${labels}`;
  console.log(`Creating ${i+1}/${tickets.length}: ${t.title}`);
  const out = execSync(cmd, {encoding:"utf8"});
  const m = out.match(/\/issues\/(\d+)/);
  const num = m ? parseInt(m[1],10) : 0;
  const idOut = execSync(`gh api repos/${repo}/issues/${num} --jq .id`, {encoding:"utf8"}).trim();
  console.log(`✓ #${num} id ${idOut}`);
  execSync(`rm -f "${tmp}"`,{stdio:"ignore"});
  execSync(`sleep 0.5`,{stdio:"ignore"});
  created.push({ idx:i, num, id: idOut, title: t.title, blockedBy: t.blockedBy });
}
writeFileSync("scripts/vertical_created.json", JSON.stringify(created,null,2));
console.log("Created vertical tickets:", created.map(c=>`#${c.num}`).join(", "));

// Wire native blocking dependencies (second pass, issues need ids)
console.log("Wiring native blocking dependencies...");
for (const c of created) {
  for (const blockerIdx of c.blockedBy) {
    const blocker = created[blockerIdx];
    const childNum = c.num;
    const blockerId = blocker.id;
    const url = `repos/${repo}/issues/${childNum}/dependencies/blocked_by`;
    try {
      execSync(`gh api --method POST ${url} -F issue_id=${blockerId}`, {encoding:"utf8", stdio:"pipe"});
      console.log(`  #${childNum} blocked by #${blocker.num} ✓`);
    } catch (e) {
      // Fallback: dependency not available (not enabled) — leave Blocked by text already in body
      console.log(`  #${childNum} blocked by #${blocker.num} (native not available, body fallback)`);
    }
    execSync(`sleep 0.2`,{stdio:"ignore"});
  }
}
console.log("Done vertical slices with native blocking (where available).");
