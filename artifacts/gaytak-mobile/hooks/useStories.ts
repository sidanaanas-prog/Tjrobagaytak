import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface Story {
  id: string;
  userId: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption?: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface StoryGroup {
  userId: string;
  userName: string;
  userAvatar: string | null;
  allViewed: boolean;
  stories: Story[];
}

export function useStories() {
  return useQuery<StoryGroup[]>({
    queryKey: ["stories"],
    queryFn: () => customFetch<StoryGroup[]>("/api/stories"),
    refetchInterval: 30000,
  });
}

export function useAddStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { mediaUrl: string; mediaType?: string; caption?: string }) =>
      customFetch<Story>("/api/stories", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stories"] }),
  });
}
