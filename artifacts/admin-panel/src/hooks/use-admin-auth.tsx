import React, { createContext, useContext, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { setAuthTokenGetter } from "@workspace/api-client-react/custom-fetch";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";

setAuthTokenGetter(() => localStorage.getItem("glow_admin_token"));

type AdminAuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: ReturnType<typeof useLogin>["mutateAsync"];
  logout: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const token = localStorage.getItem("glow_admin_token");

  const { data: user, isLoading, isError } = useGetMe({
    query: { enabled: !!token, retry: false, queryKey: getGetMeQueryKey() },
  });

  const loginMutation = useLogin();

  const logout = () => {
    localStorage.removeItem("glow_admin_token");
    queryClient.clear();
    setLocation("/login");
  };

  useEffect(() => {
    if (location === "/login") return;

    // No token at all → go to login immediately
    if (!token) {
      setLocation("/login");
      return;
    }

    // Token exists but fetch settled with error or non-admin user
    if (!isLoading) {
      if (isError || (user && user.role !== "admin")) {
        localStorage.removeItem("glow_admin_token");
        queryClient.clear();
        setLocation("/login");
      }
    }
  }, [token, user, isError, isLoading, location, setLocation, queryClient]);

  // Loading spinner while validating token
  if (token && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-primary font-mono tracking-widest text-sm">
        <Loader2 className="w-6 h-6 animate-spin mr-3" />
        AUTHENTICATING...
      </div>
    );
  }

  return (
    <AdminAuthContext.Provider
      value={{ user: user || null, isLoading, login: loginMutation.mutateAsync, logout }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return context;
}
