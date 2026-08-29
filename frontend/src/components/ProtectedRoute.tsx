import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useSession } from "../store/session";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useSession((s) => s.token);
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const t = token ?? localStorage.getItem("session");
    if (!t) { setChecked(true); setAuthed(false); return; }
    fetch(`/api/users/me`, { headers: { Authorization: `Bearer ${t}` }, credentials: "include" })
      .then((r) => {
        setAuthed(r.ok);
        setChecked(true);
        if (!r.ok) {
          // clear stale token
          localStorage.removeItem("session");
          localStorage.removeItem("session_user");
        }
      })
      .catch(() => { setChecked(true); setAuthed(false); });
  }, [token]);

  if (!checked) return <div className="p-6 text-sm text-zinc-500">Checking session…</div>;
  if (!authed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
