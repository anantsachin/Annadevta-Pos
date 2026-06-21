import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = loading, false = anon, obj = signed in
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
      } catch {
        setUser(false);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("pos_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const googleSession = async (sessionId) => {
    const { data } = await api.get("/auth/session", { headers: { "X-Session-ID": sessionId } });
    localStorage.setItem("pos_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      // Logout is best-effort: clear local state even if API call fails (e.g. offline).
      console.warn("logout request failed", err);
    }
    localStorage.removeItem("pos_token");
    setUser(false);
  };

  return (
    <AuthCtx.Provider value={{ user, ready, login, googleSession, logout, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
