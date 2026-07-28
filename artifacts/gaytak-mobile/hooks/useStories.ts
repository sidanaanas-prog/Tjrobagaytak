import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface Story {
  id: string;
  userId: string;
  mediaUrl: string | null;
  mediaType: "image" | "video" | "text";
  bgColor?: string | null;
  fontFamily?: string | null;
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

export interface AddStoryPayload {
  mediaUrl?: string | null;
  mediaType?: string;
  caption?: string | null;
  bgColor?: string | null;
  fontFamily?: string | null;
}

export function useAddStory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddStoryPayload) =>
      customFetch<Story>("/api/stories", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stories"] }),
  });
}
