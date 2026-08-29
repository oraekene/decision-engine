import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useSession } from "../store/session";

export default function DecisionInput() {
  const [health, setHealth] = useState<string>("checking...");
  const [input, setInput] = useState("");
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const clear = useSession((s) => s.clear);
  useEffect(() => {
    fetch("/api/health").then(r=>r.json()).then(j=>setHealth(JSON.stringify(j))).catch(()=>setHealth("offline (run wrangler dev)"));
  }, []);
  async function logout() {
    try { await apiFetch("/api/auth/logout", { method: "POST" }); } catch {}
    clear();
    navigate("/login");
  }
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">ADIE — What decision are you weighing?</h1>
        <div className="flex gap-3 items-center text-sm">
          <span className="text-zinc-500">{user?.email}</span>
          <button onClick={logout} className="underline">Log out</button>
        </div>
      </div>
      <p className="text-sm text-zinc-500">Health: {health}</p>
      <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Describe the situation, the choices, and what's at stake. The engine will grill you, not decide for you." className="w-full h-32 p-3 border rounded" />
      <button onClick={()=>apiFetch("/api/decisions",{method:"POST",body:JSON.stringify({description:input})}).then(j=>alert(JSON.stringify(j))).catch(e=>alert(String(e)))} className="px-4 py-2 bg-black text-white rounded">Start interview</button>
      <p className="text-xs text-zinc-400">Cloudflare-native: Workers/Hono D1+FTS5 Vectorize R2 KV Queues Pages + qmd adapter • OpenAI-compatible gateway • Multi-user isolation • Voice humanized</p>
    </div>
  );
}
