import { describe, it, expect, beforeEach } from "vitest";
import app from "../src/index.js";
import { mockEnv, registerLogin } from "../src/api/testUtils.js";
import { validate_information, triggersHaltForPhrase } from "./assumptionElimination.js";

// The gate logic is frozen; the route is new. Module pins plus route smoke.

describe("assumption gate — module", () => {
  it("confirmed facts validate without halt", () => {
    const r = validate_information("user_fact", "I earn 5000", "user_confirmed");
    expect(r.valid).toBe(true);
    expect(r.halt_required).toBe(false);
  });

  it("inferred facts halt with a source question", () => {
    const r = validate_information("user_fact", "they must agree", "inferred");
    expect(r.valid).toBe(false);
    expect(r.halt_required).toBe(true);
    expect(r.source_question).toBeTruthy();
  });

  it("assumed counterparty claims halt", () => {
    const r = validate_information("counterparty_constraint", "they will accept", "assumed");
    expect(r.valid).toBe(false);
    expect(r.halt_required).toBe(true);
  });

  it("observed situational detail validates", () => {
    const r = validate_information("situational_detail", "we met twice", "user_observed");
    expect(r.valid).toBe(true);
    expect(r.halt_required).toBe(false);
  });

  it("hedge phrases trigger halt, plain reports do not", () => {
    expect(triggersHaltForPhrase("I assume they agree")).toBe(true);
    expect(triggersHaltForPhrase("We met twice last week")).toBe(false);
  });
});

describe("assumption gate — route", () => {
  let env: ReturnType<typeof mockEnv>;
  let token: string;

  beforeEach(async () => {
    env = mockEnv();
    token = await registerLogin(env, "assumption@example.com");
  });

  it("validates confirmed facts without halt", async () => {
    const res = await app.request("/api/validation/check", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: "user_fact", value: "I earn 5000", source: "user_confirmed" }),
    }, env as never);
    expect(res.status).toBe(200);
    const body = await res.json() as { valid: boolean; halt_required: boolean };
    expect(body.valid).toBe(true);
    expect(body.halt_required).toBe(false);
  });

  it("halts inferred claims", async () => {
    const res = await app.request("/api/validation/check", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ type: "user_fact", value: "they must agree", source: "inferred" }),
    }, env as never);
    expect(res.status).toBe(200);
    const body = await res.json() as { valid: boolean; halt_required: boolean; source_question?: string };
    expect(body.valid).toBe(false);
    expect(body.halt_required).toBe(true);
    expect(body.source_question).toBeTruthy();
  });

  it("rejects unauthenticated calls", async () => {
    const res = await app.request("/api/validation/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "user_fact", value: "x", source: "user_confirmed" }),
    }, env as never);
    expect(res.status).toBe(401);
  });
});
