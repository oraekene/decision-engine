// workers/src/lib/llmGateway.ts — OpenAI-compatible cloud gateway (ADR 0002, spec §18.1)
// No node-llama-cpp. All LLM via fetch(env.AI_GATEWAY_URL). Swappable baseUrl/apiKey/model. Cloud only.

export interface LlmGatewayOpts {
  url: string; // e.g. https://api.openai.com or https://api.groq.com/openai
  apiKey?: string;
  model: string;
  embedModel?: string;
}

export interface ChatOpts {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  model?: string;
  temperature?: number;
  response_format?: { type: "json_object" };
  max_tokens?: number;
}

export interface EmbedOpts {
  input: string[];
  model?: string;
}

export class LlmGateway {
  constructor(private opts: LlmGatewayOpts) {}

  private baseUrl(): string {
    return this.opts.url.replace(/\/+$/, "");
  }

  async chat(req: ChatOpts): Promise<string> {
    const url = `${this.baseUrl()}/v1/chat/completions`;
    const body: Record<string, unknown> = {
      model: req.model ?? this.opts.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.1,
      ...(req.response_format ? { response_format: req.response_format } : {}),
      ...(req.max_tokens ? { max_tokens: req.max_tokens } : {}),
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.opts.apiKey ? { Authorization: `Bearer ${this.opts.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`LLM gateway chat failed ${res.status}: ${txt}`);
    }
    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    return json.choices[0]?.message?.content ?? "";
  }

  async embed(input: string[]): Promise<number[][]> {
    const url = `${this.baseUrl()}/v1/embeddings`;
    const body = {
      model: this.opts.embedModel ?? "text-embedding-3-small",
      input,
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.opts.apiKey ? { Authorization: `Bearer ${this.opts.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`LLM gateway embed failed ${res.status}: ${txt}`);
    }
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  }

  // Rerank via LLM prompt fallback (gateway may not expose rerank endpoint)
  async rerank(query: string, docs: string[]): Promise<{ index: number; score: number; doc: string }[]> {
    const prompt = `Re-rank these documents for relevance to the query on a 0-1 scale. Query: "${query}"\n\nDocuments:\n${docs.map((d, i) => `${i}: ${d.slice(0, 400)}`).join("\n")}\n\nReturn ONLY JSON: {"ranked": [{"index":0,"score":0.9}, ...]} sorted descending.`;
    const raw = await this.chat({
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      response_format: { type: "json_object" },
    });
    try {
      const parsed = JSON.parse(raw) as { ranked: { index: number; score: number }[] };
      return parsed.ranked.map((r) => ({ ...r, doc: docs[r.index] })).sort((a, b) => b.score - a.score);
    } catch {
      // fallback: preserve original order with neutral scores
      return docs.map((doc, index) => ({ index, score: 0.5, doc }));
    }
  }

  static fromEnv(env: Record<string, unknown>): LlmGateway {
    const url = (env.AI_GATEWAY_URL as string) || "https://api.openai.com";
    const apiKey = env.AI_GATEWAY_KEY as string | undefined;
    const model = (env.AI_GATEWAY_MODEL as string) || "gpt-4o-mini";
    const embedModel = (env.AI_GATEWAY_EMBED_MODEL as string) || "text-embedding-3-small";
    return new LlmGateway({ url, apiKey, model, embedModel });
  }
}
