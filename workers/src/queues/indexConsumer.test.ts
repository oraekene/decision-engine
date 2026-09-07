import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { handleIndexingBatch } from "./indexConsumer.js";

// The consumer must route by collection to the matching Vectorize binding,
// never collapse everything onto the generic index.

function fakeIndex() {
  const upserts: { id: string; values: number[]; metadata: unknown }[][] = [];
  return {
    upserts,
    async upsert(rows: { id: string; values: number[]; metadata: unknown }[]) { upserts.push(rows); },
  };
}

describe("indexConsumer — routing", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }),
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("upserts decisions payloads to VECTORIZE_DECISIONS, not the generic index", async () => {
    const generic = fakeIndex();
    const decisions = fakeIndex();
    const env: Record<string, unknown> = {
      VECTORIZE: generic,
      VECTORIZE_DECISIONS: decisions,
      AI_GATEWAY_URL: "https://gateway.test",
      AI_PROVIDER: "gateway",
    };
    let acked = 0;
    const batch = {
      messages: [{
        body: { collection: "decisions", r2_key: "/u1/decisions/d1.md", user_id: "u1", content: "# hello" },
        ack: () => { acked += 1; },
        retry: () => { throw new Error("must not retry"); },
      }],
    } as unknown as MessageBatch;
    await handleIndexingBatch(batch, env);
    expect(acked).toBe(1);
    expect(decisions.upserts).toHaveLength(1);
    expect(decisions.upserts[0][0]).toMatchObject({ id: "/u1/decisions/d1.md" });
    expect(decisions.upserts[0][0].metadata).toMatchObject({ user_id: "u1", collection: "decisions" });
    expect(generic.upserts).toHaveLength(0);
  });

  it("falls back to the generic index for unknown collections", async () => {
    const generic = fakeIndex();
    const env: Record<string, unknown> = {
      VECTORIZE: generic,
      AI_GATEWAY_URL: "https://gateway.test",
      AI_PROVIDER: "gateway",
    };
    const batch = {
      messages: [{
        body: { collection: "something-new", r2_key: "/u1/something-new/x.md", user_id: "u1", content: "x" },
        ack: () => {},
        retry: () => { throw new Error("must not retry"); },
      }],
    } as unknown as MessageBatch;
    await handleIndexingBatch(batch, env);
    expect(generic.upserts).toHaveLength(1);
  });
});
