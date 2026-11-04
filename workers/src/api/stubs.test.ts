import { describe, it, expect, beforeEach } from "vitest";
import app from "../index.js";
import { mockEnv, registerLogin } from "./testUtils.js";

// Route-level before/after smoke for the three stub seams (T4-T6).
// Behavior is frozen exactly as-is; these tests pin the current contract
// so the static-import move cannot silently change it.

describe("Stub seams — Hono HTTP seam", () => {
  let env: ReturnType<typeof mockEnv>;
  let token: string;

  beforeEach(async () => {
    env = mockEnv();
    token = await registerLogin(env, "stubs@example.com");
  });

  it("translate returns a value with its log", async () => {
    const res = await app.request("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: "I will save $4,500", dimension: "financial" }),
    }, env as never);
    expect(res.status).toBe(200);
    const body = await res.json() as { value: unknown; needsConfirmation: boolean; log: unknown };
    expect(body.value).toBeTruthy();
    expect(body.log).toBeTruthy();
  });

  it("translate reaches Tier3 for savings-plus-monthly prose", async () => {
    const res = await app.request("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: "My savings are 18000 and I spend 3000 a month", dimension: "financial" }),
    }, env as never);
    expect(res.status).toBe(200);
    const body = await res.json() as { value: { method: string; value: number } | null; needsConfirmation: boolean };
    expect(body.value?.method).toBe("contextual_inference");
    expect(body.value?.value).toBe(6);
    expect(body.needsConfirmation).toBe(true);
  });

  it("voice check reports wall verdict and cleaned text", async () => {
    const res = await app.request("/api/voice/check", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: "hello world" }),
    }, env as never);
    expect(res.status).toBe(200);
    const body = await res.json() as { cleaned: string; violations: string[] };
    expect(body.cleaned).toBe("hello world");
    expect(body.violations).toEqual([]);
  });

  it("bias check flags percentage figures and clears plain text", async () => {
    let res = await app.request("/api/bias/check", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ llm_output: "50% of users agree with this" }),
    }, env as never);
    expect(res.status).toBe(200);
    const flagged = await res.json() as { flags: unknown[] };
    expect(flagged.flags.length).toBeGreaterThan(0);
    res = await app.request("/api/bias/check", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ llm_output: "no numbers here" }),
    }, env as never);
    expect(res.status).toBe(200);
    const clear = await res.json() as { flags: unknown[] };
    expect(clear.flags).toEqual([]);
  });

  it("bias check adds a protocol challenge for loaded answers", async () => {
    const res = await app.request("/api/bias/check", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ answer: "it would be a total disaster" }),
    }, env as never);
    expect(res.status).toBe(200);
    const body = await res.json() as { flags: unknown[]; challenge: { type: string } | null };
    expect(body.flags).toEqual([]);
    expect(body.challenge?.type).toBe("catastrophizing");
  });

  it("stub routes reject unauthenticated calls", async () => {
    for (const path of ["/api/translate", "/api/voice/check", "/api/bias/check"]) {
      const res = await app.request(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }, env as never);
      expect(res.status).toBe(401);
    }
  });
});
