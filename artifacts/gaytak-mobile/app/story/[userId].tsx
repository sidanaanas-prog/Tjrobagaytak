import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useStories, StoryGroup } from "@/hooks/useStories";
import { customFetch } from "@workspace/api-client-react";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

const { width: W, height: H } = Dimensions.get("window");
const STORY_DURATION = 6000;

export default function StoryViewerScreen() {
  const { userId: targetUserId } = useLocalSearchParams<{ userId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: storyGroups } = useStories();

  const [groupIndex, setGroupIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const groups: StoryGroup[] = storyGroups ?? [];
  const startIndex = groups.findIndex((g) => g.userId === targetUserId);

  useEffect(() => {
    if (startIndex >= 0) setGroupIndex(startIndex);
  }, [startIndex]);

  const currentGroup = groups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];

  const markViewed = useCallback(async (storyId: string) => {
    if (!user) return;
    try {
      await customFetch(`/api/stories/${storyId}/view`, { method: "POST" });
    } catch {}
  }, [user]);

  const goNext = useCallback(() => {
    if (!currentGroup) return;
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex((i) => i + 1);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1);
      setStoryIndex(0);
    } else {
      router.back();
    }
  }, [currentGroup, storyIndex, groupIndex, groups.length]);

  const goPrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
    } else if (groupIndex > 0) {
      setGroupIndex((g) => g - 1);
      setStoryIndex(0);
    }
  }, [storyIndex, groupIndex]);

  useEffect(() => {
    if (!currentStory) return;

    markViewed(currentStory.id);

    progressAnim.setValue(0);
    animRef.current?.stop();

    animRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) goNext();
    });

    return () => {
      animRef.current?.stop();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentStory?.id, groupIndex, storyIndex]);

  if (!currentGroup || !currentStory) {
    router.back();
    return null;
  }

  const isOwn = currentGroup.userId === user?.id;

  async function handleDelete() {
    Alert.alert("حذف الحالة", "هل تريد حذف هذه الحالة؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        style: "destructive",
        onPress: async () => {
          try {
            await customFetch(`/api/stories/${currentStory.id}`, { method: "DELETE" });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          } catch {
            Alert.alert("خطأ", "تعذر حذف الحالة");
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      {/* Background image */}
      <Image
        source={{ uri: currentStory.mediaUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />

      {/* Dark overlay */}
      <View style={styles.overlay} />

      {/* Progress bars */}
      <View style={[styles.progressRow, { paddingTop: insets.top + 8 }]}>
        {currentGroup.stories.map((s, i) => (
          <View key={s.id} style={[styles.progressTrack, { backgroundColor: "rgba(255,255,255,0.35)" }]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: i < storyIndex
                    ? "100%"
                    : i === storyIndex
                    ? progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] })
                    : "0%",
                },
              ]}
            />
          </View>
        ))}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={[styles.avatarCircle, { backgroundColor: "#AA33FF40" }]}>
            {currentGroup.userAvatar ? (
              <Image source={{ uri: currentGroup.userAvatar }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <Text style={styles.avatarText}>{currentGroup.userName[0]?.toUpperCase()}</Text>
            )}
          </View>
          <View>
            <Text style={styles.userName}>{currentGroup.userName}</Text>
            <Text style={styles.timeAgo}>{formatTimeAgo(currentStory.createdAt)}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {isOwn && (
            <TouchableOpacity onPress={handleDelete} style={styles.actionBtn}>
              <Feather name="trash-2" size={20} color="#FFF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.back()} style={styles.actionBtn}>
            <Feather name="x" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tap zones */}
      <View style={styles.tapRow}>
        <TouchableWithoutFeedback onPress={goPrev}>
          <View style={styles.tapLeft} />
        </TouchableWithoutFeedback>
        <TouchableWithoutFeedback onPress={goNext}>
          <View style={styles.tapRight} />
        </TouchableWithoutFeedback>
      </View>

      {/* Caption */}
      {currentStory.caption ? (
        <View style={[styles.captionBox, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.captionText}>{currentStory.caption}</Text>
        </View>
      ) : null}
    </View>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (h >= 1) return `منذ ${h} ساعة`;
  if (m >= 1) return `منذ ${m} دقيقة`;
  return "الآن";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
  progressRow: {
    flexDirection: "row-reverse",
    paddingHorizontal: 12,
    gap: 4,
    zIndex: 10,
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FFF",
    borderRadius: 2,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    zIndex: 10,
  },
  userInfo: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#AA33FF",
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarText: { color: "#AA33FF", fontSize: 16, fontWeight: "700" },
  userName: { color: "#FFF", fontSize: 14, fontWeight: "700", textAlign: "right" },
  timeAgo: { color: "rgba(255,255,255,0.7)", fontSize: 11, textAlign: "right" },
  headerActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 18,
  },
  tapRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    zIndex: 5,
    top: 120,
  },
  tapLeft: { flex: 1 },
  tapRight: { flex: 1 },
  captionBox: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 10,
  },
  captionText: {
    color: "#FFF",
    fontSize: 16,
    textAlign: "right",
    lineHeight: 24,
  },
});
