import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useSession } from "../store/session";
import AuthForm from "../components/AuthForm";

export default function Login() {
  const setSession = useSession((s) => s.setSession);
  const navigate = useNavigate();

  return (
    <AuthForm
      title="Log in to ADIE"
      submitLabel="Log in"
      loadingLabel="Signing in…"
      onSubmit={async (email, password) => {
        const res = await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }) as { token: string; user: { id: string; email: string } };
        setSession(res.token, res.user);
        navigate("/", { replace: true });
      }}
      errorForStatus={(status, msg) => (status === 401 ? "Invalid email or password" : msg)}
      footer={<>No account? <Link to="/register" className="underline">Register</Link></>}
    />
  );
}
