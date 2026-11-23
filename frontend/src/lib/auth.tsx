import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, getToken, setToken, UNAUTHORIZED_EVENT } from "./api";
import type { User } from "./types";

interface AuthState {
  /** The signed-in learner, or null when signed out. */
  user: User | null;
  /** False until a stored session token has been checked with the server. */
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
}

interface TokenResponse {
  token: string;
  user: User;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(() => !getToken());

  // Restore the session from a stored token.
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    api<User>("/auth/me")
      .then((u) => { if (!cancelled) setUser(u); })
      .catch((e) => {
        // A 401 has already discarded the token; on other failures keep it so a reload can retry.
        if (!cancelled && !(e instanceof ApiError && e.status === 401)) console.warn("Could not restore session:", e);
      })
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  // Any request rejected with 401 (expired or revoked token) signs the learner out.
  useEffect(() => {
    const onUnauthorized = () => { setUser(null); qc.clear(); };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [qc]);

  const start = useCallback((r: TokenResponse) => {
    qc.clear(); // never show the previous learner's cached progress
    setToken(r.token);
    setUser(r.user);
    setReady(true);
  }, [qc]);

  const login = useCallback(async (username: string, password: string) => {
    start(await api<TokenResponse>("/auth/login", { method: "POST", json: { username, password } }));
  }, [start]);

  const register = useCallback(async (username: string, password: string, displayName?: string) => {
    start(await api<TokenResponse>("/auth/register", { method: "POST", json: { username, password, display_name: displayName } }));
  }, [start]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    qc.clear();
  }, [qc]);

  const value = useMemo<AuthState>(() => ({ user, ready, login, register, logout }), [user, ready, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
