import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export function useStreak() {
  const { user } = useAuth();

  const { data } = useQuery<{ streakCount: number; streakLastDate: string }>({
    queryKey: ["streak"],
    queryFn: async () => {
      const token = localStorage.getItem("glow_token");
      const res = await fetch(`${BASE}/api/users/ping`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error("ping failed");
      return res.json();
    },
    enabled: !!user,
    staleTime: 60 * 60_000,
    refetchOnWindowFocus: false,
  });

  return { streakCount: data?.streakCount ?? 0 };
}
