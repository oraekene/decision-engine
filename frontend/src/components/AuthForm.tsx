import { useState } from "react";
import type { SessionUser } from "../store/session";

type Props = {
  title: string;
  submitLabel: string;
  loadingLabel: string;
  passwordMinLength?: number;
  onSubmit: (email: string, password: string) => Promise<{ token: string; user: SessionUser } | void>;
  errorForStatus: (status: number | undefined, message: string) => string;
  footer: React.ReactNode;
};

export default function AuthForm({ title, submitLabel, loadingLabel, passwordMinLength, onSubmit, errorForStatus, footer }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await onSubmit(email, password);
    } catch (e: unknown) {
      const errObj = e as { status?: number; message?: string };
      const status = errObj.status;
      const msg = errObj.message ?? String(e);
      setErr(errorForStatus(status, msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" type="email" required className="w-full p-2 border rounded" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" required minLength={passwordMinLength} className="w-full p-2 border rounded" />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button disabled={loading} className="w-full px-4 py-2 bg-black text-white rounded disabled:opacity-50">{loading ? loadingLabel : submitLabel}</button>
      </form>
      <p className="text-sm text-zinc-500">{footer}</p>
    </div>
  );
}
