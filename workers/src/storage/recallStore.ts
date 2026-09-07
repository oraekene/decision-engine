// recallStore module — the single owner of recall persistence (ADR 0001, ADR 0003).
// Small interface: store + retrieve. Thin callers pass collection, identifier,
// and content only; blob keys, queueing, per-collection index routing, FTS
// ranking, vector recall, and their RRF fusion all live behind this seam.
// Gateway rerank stays with the future search route, not here.
import { LlmGateway } from "../lib/llmGateway.js";

export const RRF_K = 60;

export const COLLECTION_INDEX: Record<string, string> = {
  knowledge: "VECTORIZE",
  profiles: "VECTORIZE_PROFILES",
  decisions: "VECTORIZE_DECISIONS",
  leverage: "VECTORIZE_LEVERAGE",
};

export type IndexMessage = { user_id: string; collection: string; r2_key: string; content: string };

export function blobKey(user_id: string, collection: string, id: string): string {
  return `/${user_id}/${collection}/${id}.md`;
}

type BlobStore = { put: (key: string, value: string) => Promise<unknown> };
type IndexQueue = { send: (msg: IndexMessage) => Promise<unknown> };

export async function store(
  env: { BLOBS?: unknown; INDEXING?: unknown },
  user_id: string,
  collection: string,
  id: string,
  content: string,
): Promise<string> {
  const key = blobKey(user_id, collection, id);
  const blobs = env.BLOBS as BlobStore | undefined;
  const queue = env.INDEXING as IndexQueue | undefined;
  await blobs?.put(key, content);
  await queue?.send({ user_id, collection, r2_key: key, content });
  return key;
}

export type RankedId = { id: string };

export function rrf(fts: RankedId[], vec: RankedId[], k = RRF_K): { id: string; score: number }[] {
  const scores = new Map<string, number>();
  fts.forEach((d, rank) => scores.set(d.id, (scores.get(d.id) ?? 0) + 1 / (k + rank + 1)));
  vec.forEach((d, rank) => scores.set(d.id, (scores.get(d.id) ?? 0) + 1 / (k + rank + 1)));
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

export type RetrieveDeps = {
  ftsQuery: (query: string, collection: string, user_id: string) => Promise<string[]>;
  vecQuery: (query: string, collection: string, user_id: string) => Promise<string[]>;
};

async function d1FtsIds(env: Record<string, unknown>, query: string, collection: string, user_id: string): Promise<string[]> {
  const db = env.DB as D1Database | undefined;
  if (!db) return [];
  try {
    if (collection === "decisions") {
      const { results } = await db
        .prepare("SELECT decision_id AS id FROM decisions_fts WHERE decisions_fts MATCH ? AND user_id = ? ORDER BY rank")
        .bind(query, user_id)
        .all<{ id: string }>();
      return (results ?? []).map((r) => r.id);
    }
    if (collection === "translation_logs") {
      const { results } = await db
        .prepare("SELECT rowid AS id FROM translation_logs_fts WHERE translation_logs_fts MATCH ? AND user_id = ? ORDER BY rank")
        .bind(query, user_id)
        .all<{ id: number }>();
      return (results ?? []).map((r) => String(r.id));
    }
    return [];
  } catch {
    return [];
  }
}

async function vectorIds(env: Record<string, unknown>, query: string, collection: string, user_id: string): Promise<string[]> {
  try {
    const gw = LlmGateway.fromEnv(env);
    const [embedding] = await gw.embed([query]);
    if (!embedding) return [];
    const binding = COLLECTION_INDEX[collection] ?? "VECTORIZE";
    const idx = env[binding] as VectorizeIndex | undefined;
    if (!idx) return [];
    const res = await idx.query(embedding, { topK: 10, filter: { user_id } });
    return (res.matches ?? []).map((m) => m.id);
  } catch {
    return [];
  }
}

export async function retrieve(
  env: Record<string, unknown>,
  user_id: string,
  query: string,
  collection: string,
  deps?: RetrieveDeps,
): Promise<{ id: string; score: number }[]> {
  const io = deps ?? {
    ftsQuery: (q, c, u) => d1FtsIds(env, q, c, u),
    vecQuery: (q, c, u) => vectorIds(env, q, c, u),
  };
  const [ftsIds, vecIds] = await Promise.all([
    io.ftsQuery(query, collection, user_id).catch(() => [] as string[]),
    io.vecQuery(query, collection, user_id).catch(() => [] as string[]),
  ]);
  return rrf(
    ftsIds.map((id) => ({ id })),
    vecIds.map((id) => ({ id })),
  );
}
