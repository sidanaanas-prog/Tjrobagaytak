import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/api-url";

const BASE = getApiUrl("");

/**
 * PinOnlyGuard — يفحص PIN فقط إذا كان المستخدم مسجل داخل.
 * للصفحات العامة التي تسمح للزوار والمستخدمين المسجلين.
 */
export function PinOnlyGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [checking, setChecking] = useState(true);
  const [needsPin, setNeedsPin] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { setChecking(false); return; }

    const token = localStorage.getItem("glow_token") || "";
    if (!token) { setChecking(false); return; }

    const unlockedAt = localStorage.getItem(`pin_unlocked_${user.id}`);
    if (unlockedAt) {
      const age = Date.now() - parseInt(unlockedAt);
      if (age < 15 * 60 * 1000) {
        setChecking(false);
        return;
      }
    }

    fetch(`${BASE}/api/auth/pin/has-pin`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.hasPin) {
          setNeedsPin(true);
        } else {
          setLocation("/pin-setup");
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [user, isLoading]);

  if (isLoading || checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (needsPin) {
    setLocation("/pin-lock");
    return null;
  }

  return <>{children}</>;
}
