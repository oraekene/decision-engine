import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useSession } from "../store/session";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSession = useSession((s) => s.setSession);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true);
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }) as { token: string; user: { id: string; email: string } };
      setSession(res.token, res.user);
      navigate("/", { replace: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(msg.includes("401") ? "Invalid email or password" : msg);
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Log in to ADIE</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="email" type="email" required className="w-full p-2 border rounded" />
        <input value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="password" type="password" required className="w-full p-2 border rounded" />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button disabled={loading} className="w-full px-4 py-2 bg-black text-white rounded disabled:opacity-50">{loading ? "Signing in…" : "Log in"}</button>
      </form>
      <p className="text-sm text-zinc-500">No account? <Link to="/register" className="underline">Register</Link></p>
    </div>
  );
}
