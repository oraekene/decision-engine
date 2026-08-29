import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useSession } from "../store/session";

const API = import.meta.env.VITE_API_URL ?? "";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useSession((s) => s.token);
  const clear = useSession((s) => s.clear);
  const initFromStorage = useSession((s) => s.initFromStorage);
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  useEffect(() => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    // Use same API prefix as api.ts; always try httpOnly cookie via credentials:include even when token is null
    fetch(`${API}/api/users/me`, { headers, credentials: "include" })
      .then((r) => {
        setAuthed(r.ok);
        setChecked(true);
        if (!r.ok) {
          clear();
        }
      })
      .catch(() => { setChecked(true); setAuthed(false); });
  }, [token, clear]);

  if (!checked) return <div className="p-6 text-sm text-zinc-500">Checking session…</div>;
  if (!authed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
