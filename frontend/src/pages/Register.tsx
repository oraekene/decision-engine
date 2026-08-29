import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useSession } from "../store/session";
import AuthForm from "../components/AuthForm";

export default function Register() {
  const setSession = useSession((s) => s.setSession);
  const navigate = useNavigate();

  return (
    <AuthForm
      title="Create account"
      submitLabel="Create account"
      loadingLabel="Creating…"
      passwordMinLength={8}
      onSubmit={async (email, password) => {
        await apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password }) });
        const res = await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }) as { token: string; user: { id: string; email: string } };
        setSession(res.token, res.user);
        navigate("/", { replace: true });
      }}
      errorForStatus={(status, msg) => (status === 409 ? "Email already exists" : msg)}
      footer={<>Have an account? <Link to="/login" className="underline">Log in</Link></>}
    />
  );
}
