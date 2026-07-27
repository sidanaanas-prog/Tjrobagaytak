import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const TOKEN_KEY = "glow_token";

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: string;
  banned: boolean;
  createdAt: string;
  walletBalance?: number | null;
  points?: number | null;
  noShowCount?: number | null;
  rideBannedUntil?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAuthTokenGetter(async () => {
      return await AsyncStorage.getItem(TOKEN_KEY);
    });
    loadToken();
  }, []);

  async function loadToken() {
    try {
      const stored = await AsyncStorage.getItem(TOKEN_KEY);
      if (stored) {
        setToken(stored);
        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        const res = await fetch(`https://${domain}/api/auth/me`, {
          headers: { Authorization: `Bearer ${stored}` },
        });
        if (res.ok) {
          const u = await res.json();
          setUser(u);
        } else {
          await AsyncStorage.removeItem(TOKEN_KEY);
          setToken(null);
        }
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }

  const login = useCallback(async (t: string, u: User) => {
    await AsyncStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser, isLoggedIn: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
