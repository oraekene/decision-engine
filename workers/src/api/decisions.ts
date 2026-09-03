// decisions module — user-scoped decision records (ADR 0004: every row is user_id-partitioned).
// Small interface: creation and listing keyed by user. Routes stay thin adapters
// (request parsing + envelope) while persistence lives behind this seam.

export type DecisionRecord = { id: string; description: string; created_at: string };

export async function listDecisions(db: D1Database, user_id: string): Promise<DecisionRecord[]> {
  try {
    const { results } = await db.prepare("SELECT id, description, created_at FROM decisions WHERE user_id = ? ORDER BY created_at DESC").bind(user_id).all<DecisionRecord>();
    return results ?? [];
  } catch {
    return [];
  }
}

export async function createDecision(db: D1Database, user_id: string, description: string): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  try {
    await db.prepare("INSERT INTO decisions (id, user_id, description) VALUES (?, ?, ?)").bind(id, user_id, description).run();
  } catch {}
  return { id };
}
