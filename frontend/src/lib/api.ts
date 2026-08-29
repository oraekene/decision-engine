// frontend/src/lib/api.ts — typed client for Workers Hono (V-01: Bearer + httpOnly cookie, 401 handling)
import { useSession } from "../store/session";

const API = import.meta.env.VITE_API_URL ?? "";

export async function apiFetch(path: string, opts: RequestInit = {}) {
  // Token is in-memory (Zustand) + httpOnly cookie (credentials:include). No localStorage token to avoid XSS per review.
  // External tools can still pass Authorization explicitly via opts.headers.
  const token = (opts.headers as Record<string, string> | undefined)?.["Authorization"] ? undefined : useSession.getState().token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((opts.headers as Record<string, string>) ?? {}),
  };
  if (token && !headers["Authorization"]) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers: headers as HeadersInit, credentials: "include" as RequestCredentials });
  if (!res.ok) {
    const txt = await res.text();
    let body: unknown;
    try { body = JSON.parse(txt); } catch { body = txt; }
    throw Object.assign(new Error(`${res.status} ${txt}`), { status: res.status, body });
  }
  // 204 has no body
  if (res.status === 204) return null;
  const ct = res.headers.get("Content-Type") ?? "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}
