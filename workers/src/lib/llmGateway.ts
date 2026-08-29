// workers/src/lib/llmGateway.ts — OpenAI-compatible cloud gateway + Cloudflare Workers AI primary (ADR 0002, spec §18.1)
// No node-llama-cpp. Primary: env.AI (Workers AI free tier) when AI_PROVIDER=cloudflare; fallback: fetch(AI_GATEWAY_URL). Swappable via one var.

export type AiProvider = "cloudflare" | "gateway";

export interface LlmGatewayOpts {
  provider: AiProvider; // one-click switch
  // Cloudflare Workers AI (free tier)
  aiBinding?: unknown; // env.AI — Ai type from @cloudflare/workers-types
  cloudflareChatModel?: string; // e.g. @cf/meta/llama-3.1-8b-instruct
  cloudflareEmbedModel?: string; // e.g. @cf/baai/bge-base-en-v1.5
  // Gateway fallback (OpenAI-compatible)
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

  private useCloudflare(): boolean {
    return this.opts.provider === "cloudflare" && !!this.opts.aiBinding;
  }

  async chat(req: ChatOpts): Promise<string> {
    // Primary: Cloudflare Workers AI (free) — no key, edge-local, OpenAI-compatible via gateway fallback contract
    if (this.useCloudflare()) {
      try {
        const ai = this.opts.aiBinding as { run: (model: string, input: Record<string, unknown>) => Promise<unknown> };
        const model = req.model ?? this.opts.cloudflareChatModel ?? "@cf/meta/llama-3.1-8b-instruct";
        // Workers AI chat contract: { messages } → { response }
        const res = (await ai.run(model, {
          messages: req.messages,
          max_tokens: req.max_tokens,
        })) as { response?: string };
        if (res?.response) return res.response;
        // Some models return { response } else fallback
      } catch (e) {
        console.warn("Cloudflare AI chat failed, falling back to gateway:", e);
        // fall through to gateway
      }
    }
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
    if (this.useCloudflare()) {
      try {
        const ai = this.opts.aiBinding as { run: (model: string, input: Record<string, unknown>) => Promise<unknown> };
        const model = this.opts.cloudflareEmbedModel ?? "@cf/baai/bge-base-en-v1.5";
        // BGE expects { text: string[] } → { data: number[][] } or { shape, data }
        const results: number[][] = [];
        for (const txt of input) {
          const res = (await ai.run(model, { text: [txt] })) as { data?: number[][]; embedding?: number[] };
          if (res?.data?.[0]) results.push(res.data[0]);
          else if ((res as { embedding?: number[] })?.embedding) results.push((res as { embedding: number[] }).embedding!);
          else throw new Error("Unexpected Cloudflare embed response");
        }
        if (results.length === input.length) return results;
      } catch (e) {
        console.warn("Cloudflare AI embed failed, falling back to gateway:", e);
      }
    }
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
    const provider = ((env.AI_PROVIDER as string) || "cloudflare") as AiProvider;
    const aiBinding = env.AI as unknown | undefined;
    const cloudflareChatModel = (env.AI_CLOUDFLARE_CHAT_MODEL as string) || "@cf/meta/llama-3.1-8b-instruct";
    const cloudflareEmbedModel = (env.AI_CLOUDFLARE_EMBED_MODEL as string) || "@cf/baai/bge-base-en-v1.5";
    const url = (env.AI_GATEWAY_URL as string) || "https://api.openai.com";
    const apiKey = env.AI_GATEWAY_KEY as string | undefined;
    const model = (env.AI_GATEWAY_MODEL as string) || "gpt-4o-mini";
    const embedModel = (env.AI_GATEWAY_EMBED_MODEL as string) || "text-embedding-3-small";
    return new LlmGateway({ provider, aiBinding, cloudflareChatModel, cloudflareEmbedModel, url, apiKey, model, embedModel });
  }

  /** One-click switch helper: call before chat/embed to override provider at runtime (e.g., from admin UI) */
  withProvider(provider: AiProvider): LlmGateway {
    return new LlmGateway({ ...this.opts, provider });
  }
}
