// decisions module — user-scoped decision records (ADR 0004: every row is user_id-partitioned).
// Small interface: creation and listing keyed by user. Routes stay thin adapters
// (request parsing + envelope) while persistence lives behind this seam.
// Creation additionally recalls through recallStore (blob + index queue) so a
// new decision is stored and retrievable in the same seam.
import { store } from "../storage/recallStore.js";

export type DecisionRecord = { id: string; description: string; created_at: string };

export async function listDecisions(db: D1Database, user_id: string): Promise<DecisionRecord[]> {
  try {
    const { results } = await db.prepare("SELECT id, description, created_at FROM decisions WHERE user_id = ? ORDER BY created_at DESC").bind(user_id).all<DecisionRecord>();
    return results ?? [];
  } catch {
    return [];
  }
}

export async function createDecision(
  env: { DB: D1Database; BLOBS?: unknown; INDEXING?: unknown },
  user_id: string,
  description: string,
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare("INSERT INTO decisions (id, user_id, description) VALUES (?, ?, ?)").bind(id, user_id, description).run();
  } catch {}
  try {
    await store(env, user_id, "decisions", id, description);
  } catch (e) {
    console.error("recall store failed for decision", id, e);
  }
  return { id };
}
