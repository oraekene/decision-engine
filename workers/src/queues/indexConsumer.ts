// workers/src/queues/indexConsumer.ts — Queues async embed/index (ticket [3-02])
import { LlmGateway } from "../lib/llmGateway.js";

export async function handleIndexingBatch(batch: MessageBatch, env: Record<string, unknown>) {
  for (const msg of batch.messages) {
    const payload = msg.body as { collection: string; r2_key: string; user_id: string; content: string };
    try {
      const gw = LlmGateway.fromEnv(env as Record<string, unknown>);
      const [embedding] = await gw.embed([payload.content.slice(0, 8000)]);
      // Vectorize upsert — binding name varies by collection
      const idx = (env.VECTORIZE as VectorizeIndex | undefined) ?? (env.VECTORIZE as unknown as VectorizeIndex);
      if (idx && embedding) {
        await idx.upsert([
          {
            id: payload.r2_key,
            values: embedding,
            metadata: { user_id: payload.user_id, collection: payload.collection, r2_key: payload.r2_key },
          },
        ]);
      }
      msg.ack();
    } catch (e) {
      console.error("indexing failed", e);
      msg.retry();
    }
  }
}
