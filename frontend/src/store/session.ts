import { create } from "zustand";

export const SESSION_TOKEN_KEY = "session";
export const SESSION_USER_KEY = "session_user";
export type SessionUser = { id: string; email: string };

type SessionState = {
  token: string | null; // in-memory only; httpOnly cookie is authoritative (XSS-safe). Not persisted to localStorage per V-01 review.
  user: SessionUser | null;
  setSession: (token: string, user: SessionUser) => void;
  clear: () => void;
  initFromStorage: () => void;
};

export const useSession = create<SessionState>((set) => ({
  token: null,
  user: null,
  setSession: (token, user) => {
    // Token kept in memory + httpOnly cookie (Set-Cookie from /api/auth/login); not written to localStorage to avoid XSS theft.
    // User kept for UI persistence.
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    set({ token, user });
  },
  clear: () => {
    localStorage.removeItem(SESSION_USER_KEY);
    set({ token: null, user: null });
  },
  initFromStorage: () => {
    // Only user is persisted; token is httpOnly cookie (credentials:include)
    const raw = localStorage.getItem(SESSION_USER_KEY);
    let user: SessionUser | null = null;
    try { user = raw ? JSON.parse(raw) : null; } catch { user = null; }
    set({ token: null, user });
  },
}));
