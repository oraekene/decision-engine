// frontend/src/lib/api.ts — typed client for Workers Hono (V-01: Bearer + cookie, 401 handling)
const API = import.meta.env.VITE_API_URL ?? "";

export async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("session") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((opts.headers as Record<string, string>) ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers: headers as HeadersInit, credentials: "include" as RequestCredentials });
  if (res.status === 401) {
    // let ProtectedRoute handle redirect; also clear optimistic session
    // Do not auto-redirect here to avoid loop on login page
  }
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
