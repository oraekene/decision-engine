import { describe, it, expect } from "vitest";
import { store, rrf, retrieve, type RetrieveDeps } from "../storage/recallStore.js";

// Recall behavior is pinned through the module's public interface:
// store (blob + queue), rrf (pure fusion math), retrieve (fused, user-scoped).
// History: written RED against the missing module (3 failures), went GREEN
// with commit 021ceec; the explicit RetrieveDeps seam replaced an early
// env-punning draft during implementation.

describe("recallStore — seam", () => {
  it("store writes blob at /{user_id}/{collection}/{id}.md and queues one message", async () => {
    const blobs = new Map<string, string>();
    const messages: unknown[] = [];
    const env = {
      BLOBS: { put: async (k: string, v: string) => { blobs.set(k, v); } },
      INDEXING: { send: async (m: unknown) => { messages.push(m); } },
    };
    const key = await store(env, "u1", "decisions", "d1", "# hello");
    expect(key).toBe("/u1/decisions/d1.md");
    expect(blobs.get("/u1/decisions/d1.md")).toBe("# hello");
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ user_id: "u1", collection: "decisions", r2_key: "/u1/decisions/d1.md" });
  });

  it("store tolerates missing bindings and still returns the key", async () => {
    await expect(store({}, "u1", "decisions", "d1", "# hello")).resolves.toBe("/u1/decisions/d1.md");
  });

  it("rrf k=60 ranks dual-listed ids first", () => {
    const fts = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const vec = [{ id: "b" }, { id: "d" }];
    const fused = rrf(fts, vec, 60);
    expect(fused[0].id).toBe("b");
    expect(fused.find((r) => r.id === "b")!.score).toBeGreaterThan(fused.find((r) => r.id === "a")!.score);
    expect(fused.find((r) => r.id === "d")!.score).toBeGreaterThan(0);
  });

  it("retrieve is user-scoped: only the caller's ids surface", async () => {
    const deps: RetrieveDeps = {
      ftsQuery: async (_q, _c, uid) => (uid === "u1" ? ["d1"] : ["dX"]),
      vecQuery: async (_q, _c, uid) => (uid === "u1" ? ["d1"] : ["dX"]),
    };
    const hits = await retrieve({}, "u1", "hello", "decisions", deps);
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe("d1");
  });

  it("retrieve survives a failing leg with the other leg's results", async () => {
    const deps: RetrieveDeps = {
      ftsQuery: async () => { throw new Error("fts down"); },
      vecQuery: async () => ["d9"],
    };
    const hits = await retrieve({}, "u1", "hello", "decisions", deps);
    expect(hits.map((h) => h.id)).toEqual(["d9"]);
  });
});
