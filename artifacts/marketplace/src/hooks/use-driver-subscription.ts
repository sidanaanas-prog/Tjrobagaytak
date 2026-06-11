import { useState, useEffect, useCallback } from "react";
import { getMemToken } from "@/hooks/use-auth";
import { getApiUrl } from "@/lib/api-url";

const BASE = getApiUrl("");

export type DriverSubscriptionStatus = {
  isSubscribed: boolean;
  expiresAt: string | null;
  isPending: boolean;
  plan: string | null;
  hasProfile: boolean;
  latestRequest: {
    id: string;
    status: string;
    plan: string;
    paymentMethod: string;
    price: string;
    createdAt: string;
  } | null;
};

export function useDriverSubscription() {
  const [status, setStatus] = useState<DriverSubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const token = getMemToken();
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(`${BASE}/api/driver/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStatus(await res.json());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { status, loading, refetch };
}
