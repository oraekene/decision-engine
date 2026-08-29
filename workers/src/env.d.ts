declare type D1Database = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
      run(): Promise<{ success: boolean; meta?: unknown }>;
    };
  };
};
declare type KVNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};
declare type VectorizeIndex = {
  upsert(vectors: { id: string; values: number[]; metadata?: Record<string, unknown> }[]): Promise<void>;
  query(vector: number[], opts?: { topK?: number; filter?: Record<string, unknown> }): Promise<{ matches: { id: string; score: number; metadata?: Record<string, unknown> }[] }>;
};
declare type MessageBatch = {
  messages: { body: unknown; ack(): void; retry(): void }[];
};
declare module "bcryptjs" {
  export function hash(s: string, rounds: number): Promise<string>;
  export function compare(s: string, hash: string): Promise<boolean>;
}
