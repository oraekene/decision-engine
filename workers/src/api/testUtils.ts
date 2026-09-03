// Shared test doubles extracted verbatim from the auth suite (T1 prefactor) —
// one fake D1 + KV pair for every route-level test in this directory.
export type UserRow = { id: string; email: string; password_hash: string; created_at: string };
export type SessionRow = { id: string; user_id: string; token_hash: string; expires_at: string; created_at: string };

export type DecisionRow = { id: string; user_id: string; description: string; created_at: string };

export function createMockDB() {
  const users = new Map<string, UserRow>();
  const sessions = new Map<string, SessionRow>();
  const decisions = new Map<string, DecisionRow>();
  // also index by email/token_hash for lookups
  return {
    _users: users,
    _sessions: sessions,
    _decisions: decisions,
    prepare(sql: string) {
      const lower = sql.toLowerCase().replace(/\s+/g, " ").trim();
      return {
        bind(...params: unknown[]) {
          return {
            first: async <T>(): Promise<T | null> => {
              if (lower.includes("from users where email")) {
                const email = params[0] as string;
                for (const u of users.values()) if (u.email === email) return u as unknown as T;
                return null;
              }
              if (lower.includes("from users where id")) {
                const id = params[0] as string;
                return (users.get(id) as unknown as T) ?? null;
              }
              if (lower.includes("from sessions where token_hash")) {
                const hash = params[0] as string;
                for (const s of sessions.values()) if (s.token_hash === hash) return s as unknown as T;
                return null;
              }
              if (lower.includes("select user_id, expires_at from sessions")) {
                const hash = params[0] as string;
                for (const s of sessions.values()) if (s.token_hash === hash) return { user_id: s.user_id, expires_at: s.expires_at } as unknown as T;
                return null;
              }
              return null;
            },
            all: async <T>(): Promise<{ results: T[] }> => {
              if (lower.includes("from sessions where user_id")) {
                const uid = params[0] as string;
                const res = [...sessions.values()].filter((s) => s.user_id === uid) as unknown as T[];
                return { results: res };
              }
              if (lower.includes("from decisions where user_id")) {
                const uid = params[0] as string;
                const res = [...decisions.values()].filter((d) => d.user_id === uid) as unknown as T[];
                return { results: res };
              }
              if (lower.includes("from decisions")) {
                return { results: [...decisions.values()] as unknown as T[] };
              }
              return { results: [] };
            },
            run: async (): Promise<{ success: boolean }> => {
              if (lower.startsWith("insert into users")) {
                const [id, email, hash] = params as string[];
                if ([...users.values()].some((u) => u.email === email)) {
                  throw new Error("UNIQUE constraint failed: users.email");
                }
                users.set(id, { id, email, password_hash: hash, created_at: new Date().toISOString() });
                return { success: true };
              }
              if (lower.startsWith("insert into sessions")) {
                const [id, user_id, token_hash, expires_at] = params as string[];
                sessions.set(id, { id, user_id, token_hash, expires_at, created_at: new Date().toISOString() });
                return { success: true };
              }
              if (lower.startsWith("insert into decisions")) {
                const [id, user_id, description] = params as string[];
                decisions.set(id, { id, user_id, description, created_at: new Date().toISOString() });
                return { success: true };
              }
              if (lower.startsWith("insert into profiles")) {
                // profiles insert is no-op for mock
                return { success: true };
              }
              if (lower.startsWith("delete from sessions where token_hash")) {
                const hash = params[0] as string;
                for (const [k, v] of sessions.entries()) if (v.token_hash === hash) sessions.delete(k);
                return { success: true };
              }
              if (lower.startsWith("delete from sessions where id")) {
                const id = params[0] as string;
                sessions.delete(id);
                return { success: true };
              }
              return { success: true };
            },
          };
        },
      };
    },
  };
}

export function createMockKV() {
  const store = new Map<string, string>();
  return {
    _store: store,
    async get(key: string) { return store.get(key) ?? null; },
    async put(key: string, value: string, opts?: { expirationTtl?: number }) { store.set(key, value); },
    async delete(key: string) { store.delete(key); },
  };
}

import app from "../index.js";

export function mockEnv() {
  return {
    DB: createMockDB() as unknown as D1Database,
    SESSIONS: createMockKV() as unknown as KVNamespace,
    AI: undefined,
    AI_PROVIDER: "cloudflare",
    AI_GATEWAY_URL: "https://api.openai.com",
    AI_GATEWAY_MODEL: "gpt-4o-mini",
  };
}

export async function registerLogin(env: ReturnType<typeof mockEnv>, email: string, password = "password123"): Promise<string> {
  let res = await app.request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }, env as never);
  if (res.status !== 201) throw new Error(`register failed: ${res.status}`);
  res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }, env as never);
  if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
  const { token } = await res.json() as { token: string };
  return token;
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
