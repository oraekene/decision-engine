// frontend/src/lib/api.ts — typed client for Workers Hono
const API = import.meta.env.VITE_API_URL ?? "";

export async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("session");
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts.headers as Record<string, string> ?? {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}
