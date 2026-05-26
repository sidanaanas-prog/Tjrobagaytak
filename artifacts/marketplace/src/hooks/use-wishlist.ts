import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("glow_token");
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function useWishlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: wishlistIds = [] } = useQuery<string[]>({
    queryKey: ["wishlist-ids"],
    queryFn: () => apiFetch("/api/wishlist/ids"),
    enabled: !!user,
    staleTime: 60_000,
  });

  const idSet = new Set(wishlistIds);

  const toggle = async (productId: string) => {
    if (!user) return;
    const isIn = idSet.has(productId);
    // optimistic update
    queryClient.setQueryData<string[]>(["wishlist-ids"], (old = []) =>
      isIn ? old.filter((id) => id !== productId) : [...old, productId]
    );
    try {
      if (isIn) {
        await apiFetch(`/api/wishlist/${productId}`, { method: "DELETE" });
      } else {
        await apiFetch(`/api/wishlist/${productId}`, { method: "POST" });
      }
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    } catch {
      queryClient.invalidateQueries({ queryKey: ["wishlist-ids"] });
    }
  };

  return { wishlistIds: idSet, toggle };
}
