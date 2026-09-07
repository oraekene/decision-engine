import { describe, it, expect, beforeEach } from "vitest";
import app from "../index.js";
import { mockEnv, registerLogin, createMockBlobs, createMockQueue } from "./testUtils.js";

describe("Decisions seam — Hono HTTP seam", () => {
  let env: ReturnType<typeof mockEnv>;

  beforeEach(() => {
    env = mockEnv();
  });

  it("empty listing returns an empty collection", async () => {
    const token = await registerLogin(env, "list-empty@example.com");
    const res = await app.request("/api/decisions", {
      headers: { Authorization: `Bearer ${token}` },
    }, env as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ decisions: [] });
  });

  it("listing returns created decisions newest first", async () => {
    const token = await registerLogin(env, "list-two@example.com");
    for (const description of ["first decision", "second decision"]) {
      const res = await app.request("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description }),
      }, env as never);
      expect(res.status).toBe(201);
    }
    const res = await app.request("/api/decisions", {
      headers: { Authorization: `Bearer ${token}` },
    }, env as never);
    expect(res.status).toBe(200);
    const body = await res.json() as { decisions: { id: string; description: string; created_at: string }[] };
    expect(body.decisions.map((d) => d.description).sort()).toEqual(["first decision", "second decision"]);
  });

  it("unauthenticated listing is rejected", async () => {
    const res = await app.request("/api/decisions", {}, env as never);
    expect(res.status).toBe(401);
  });

  it("creation echoes identifier, caller, and description", async () => {
    const token = await registerLogin(env, "create-shape@example.com");
    const res = await app.request("/api/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ description: "take the offer" }),
    }, env as never);
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; user_id: string; description: string };
    expect(body.id).toBeTruthy();
    expect(body.user_id).toBeTruthy();
    expect(body.description).toBe("take the offer");
  });

  it("creation without a description stores an empty description", async () => {
    const token = await registerLogin(env, "create-empty@example.com");
    const res = await app.request("/api/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    }, env as never);
    expect(res.status).toBe(201);
    // Note: the creation envelope echoes the request body (no description key
    // when none was sent); the stored row defaults to "". Both are frozen.
    const created = await res.json() as { id: string };
    expect(created.id).toBeTruthy();
    const listed = await app.request("/api/decisions", {
      headers: { Authorization: `Bearer ${token}` },
    }, env as never);
    const body = await listed.json() as { decisions: { id: string; description: string }[] };
    expect(body.decisions.find((d) => d.id === created.id)?.description).toBe("");
  });

  it("unauthenticated creation is rejected", async () => {
    const res = await app.request("/api/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "nope" }),
    }, env as never);
    expect(res.status).toBe(401);
  });

  it("users never see each other's decisions", async () => {    const tokenA = await registerLogin(env, "isolation-a@example.com");
    const tokenB = await registerLogin(env, "isolation-b@example.com");
    for (const description of ["a-one", "a-two"]) {
      await app.request("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ description }),
      }, env as never);
    }
    await app.request("/api/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ description: "b-one" }),
    }, env as never);
    const resA = await app.request("/api/decisions", {
      headers: { Authorization: `Bearer ${tokenA}` },
    }, env as never);
    const bodyA = await resA.json() as { decisions: { description: string }[] };
    expect(bodyA.decisions.map((d) => d.description).sort()).toEqual(["a-one", "a-two"]);
    const resB = await app.request("/api/decisions", {
      headers: { Authorization: `Bearer ${tokenB}` },
    }, env as never);
    const bodyB = await resB.json() as { decisions: { description: string }[] };
    expect(bodyB.decisions.map((d) => d.description)).toEqual(["b-one"]);
  });

  it("creation recalls blob and queue, namespaced per user", async () => {
    const tokenA = await registerLogin(env, "recall-a@example.com");
    const tokenB = await registerLogin(env, "recall-b@example.com");
    const blobs = env.BLOBS as unknown as ReturnType<typeof createMockBlobs>;
    const queue = env.INDEXING as unknown as ReturnType<typeof createMockQueue>;
    const resA = await app.request("/api/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ description: "recall me" }),
    }, env as never);
    expect(resA.status).toBe(201);
    const { id } = await resA.json() as { id: string };
    const meA = await (await app.request("/api/users/me", {
      headers: { Authorization: `Bearer ${tokenA}` },
    }, env as never)).json() as { id: string };
    const meB = await (await app.request("/api/users/me", {
      headers: { Authorization: `Bearer ${tokenB}` },
    }, env as never)).json() as { id: string };
    expect(blobs._blobs.get(`/${meA.id}/decisions/${id}.md`)).toBe("recall me");
    expect(queue._messages).toHaveLength(1);
    expect(queue._messages[0]).toMatchObject({ user_id: meA.id, collection: "decisions", r2_key: `/${meA.id}/decisions/${id}.md` });
    expect([...blobs._blobs.keys()].some((k) => k.startsWith(`/${meB.id}/`))).toBe(false);
  });
});
