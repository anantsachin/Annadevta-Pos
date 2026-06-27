import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { offlineStorage } from "../lib/offlineStorage";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);   // null = loading, false = anon, obj = signed in
  const [ready, setReady] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const checkAuth = useCallback(async () => {
    setReady(false);
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      offlineStorage.saveUser(data); // cache for offline use
      setIsOffline(false);
    } catch (err) {
      if (!err.response) {
        // Network error — backend unreachable. Load cached user if available.
        const cachedUser = offlineStorage.loadUser();
        setUser(cachedUser || false);
        setIsOffline(true);
      } else {
        // Server responded (e.g., 401) — user not logged in
        setUser(false);
        setIsOffline(false);
      }
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // When network comes back, re-check auth silently
  useEffect(() => {
    const handleOnline = () => {
      if (isOffline) checkAuth();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [isOffline, checkAuth]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("pos_token", data.token);
    setUser(data.user);
    offlineStorage.saveUser(data.user);
    setIsOffline(false);
    return data.user;
  };

  const googleSession = async (sessionId) => {
    const { data } = await api.get("/auth/session", { headers: { "X-Session-ID": sessionId } });
    localStorage.setItem("pos_token", data.token);
    setUser(data.user);
    offlineStorage.saveUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.warn("logout request failed", err);
    }
    localStorage.removeItem("pos_token");
    setUser(false);
    setIsOffline(false);
  };

  const signup = async (email, password, restaurant_name) => {
    await api.post("/auth/signup", { email, password, restaurant_name });
    return await login(email, password);
  };

  return (
    <AuthCtx.Provider value={{
      user, ready, isOffline,
      login, signup, googleSession, logout, setUser,
      retryConnection: checkAuth,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
