import { create } from "zustand";

type SessionState = {
  token: string | null;
  user: { id: string; email: string } | null;
  setSession: (token: string, user: { id: string; email: string }) => void;
  clear: () => void;
  initFromStorage: () => void;
};

export const useSession = create<SessionState>((set) => ({
  token: typeof localStorage !== "undefined" ? localStorage.getItem("session") : null,
  user: (() => {
    try { const raw = localStorage.getItem("session_user"); return raw ? JSON.parse(raw) : null; } catch { return null; }
  })(),
  setSession: (token, user) => {
    localStorage.setItem("session", token);
    localStorage.setItem("session_user", JSON.stringify(user));
    set({ token, user });
  },
  clear: () => {
    localStorage.removeItem("session");
    localStorage.removeItem("session_user");
    set({ token: null, user: null });
  },
  initFromStorage: () => {
    const token = localStorage.getItem("session");
    const raw = localStorage.getItem("session_user");
    let user: { id: string; email: string } | null = null;
    try { user = raw ? JSON.parse(raw) : null; } catch { user = null; }
    set({ token, user });
  },
}));
