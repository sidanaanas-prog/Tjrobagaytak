import { useState, useEffect, useCallback } from "react";
import { getMemToken } from "@/hooks/use-auth";
import { getApiUrl } from "@/lib/api-url";

const BASE = getApiUrl("");

export type SubscriptionStatus = {
  isActive: boolean;
  isVerified: boolean;
  expiresAt: string | null;
  latestRequest: {
    id: string;
    plan: string;
    paymentMethod: string;
    status: "pending" | "approved" | "rejected";
    createdAt: string;
  } | null;
};

export function useSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const token = getMemToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(`${BASE}/api/subscriptions/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStatus(await res.json());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { status, loading, refetch };
}
