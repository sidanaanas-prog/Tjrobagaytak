import { useState, useEffect, useRef } from "react";
import { useLiveCount } from "@/hooks/use-live-count";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, ChevronLeft, ChevronRight, MessageCircle, Eye, Heart, Users, Loader2 } from "lucide-react";
import { VerifiedBadge } from "./VerifiedBadge";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api-url";

interface StoryItem {
  id: string;
  mediaUrl: string | null;
  mediaType: string;
  bgColor?: string | null;
  fontFamily?: string | null;
  caption?: string | null;
  expiresAt: string;
  createdAt: string;
  viewCount?: number;
  likeCount?: number;
  likedByMe?: boolean;
}

interface StoryGroup {
  userId: string;
  userName: string;
  userAvatar: string | null;
  userRole?: string | null;
  userIsVerified?: boolean | null;
  stories: StoryItem[];
  allViewed?: boolean;
}

interface Viewer {
  id: string;
  name: string;
  avatar: string | null;
  viewedAt: string;
}

interface Liker {
  id: string;
  name: string;
  avatar: string | null;
  likedAt: string;
}

const BASE = getApiUrl("");

async function fetchStories(): Promise<StoryGroup[]> {
  try {
    const res = await fetch(`${BASE}/api/stories`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function markStoryViewed(storyId: string, token: string) {
  try {
    await fetch(`${BASE}/api/stories/${storyId}/view`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // silent
  }
}

async function toggleStoryLike(storyId: string, token: string): Promise<{ liked: boolean; likeCount: number } | null> {
  try {
    const res = await fetch(`${BASE}/api/stories/${storyId}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchStoryViewers(storyId: string, token: string): Promise<Viewer[]> {
  try {
    const res = await fetch(`${BASE}/api/stories/${storyId}/viewers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function fetchStoryLikers(storyId: string, token: string): Promise<Liker[]> {
  try {
    const res = await fetch(`${BASE}/api/stories/${storyId}/likes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function startConversation(recipientId: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ recipientId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id;
  } catch {
    return null;
  }
}

function avatarColor(name: string) {
  const hues = [280, 320, 180, 40, 140, 220];
  const idx = name.charCodeAt(0) % hues.length;
  return `hsl(${hues[idx]}, 80%, 50%)`;
}

interface StoryViewerProps {
  groups: StoryGroup[];
  startGroupIndex: number;
  onClose: () => void;
  currentUserId?: string;
  onLikeToggle?: (storyId: string, liked: boolean, likeCount: number) => void;
}

function StoryViewer({ groups, startGroupIndex, onClose, currentUserId, onLikeToggle }: StoryViewerProps) {
  const [groupIdx, setGroupIdx] = useState(startGroupIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [messaging, setMessaging] = useState(false);
  const [liking, setLiking] = useState(false);
  const [showDetails, setShowDetails] = useState<"viewers" | "likes" | null>(null);
  const [detailsData, setDetailsData] = useState<(Viewer | Liker)[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];
  const DURATION = 5000;
  const isMyStory = currentUserId === group?.userId;

  // عدادات حية — تصعد تدريجياً عند فتح الحالة وتزيد +1 كل 15 ثانية
  const liveViews = useLiveCount(story?.viewCount ?? 0, 60);
  const liveLikes = useLiveCount(story?.likeCount ?? 0, 90);

  const viewedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (story && !isMyStory) {
      const token = localStorage.getItem("glow_token");
      if (token && !viewedRef.current.has(story.id)) {
        markStoryViewed(story.id, token);
        viewedRef.current.add(story.id);
      }
    }
  }, [story?.id, isMyStory]);

  useEffect(() => {
    if (showDetails) return;
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timerRef.current!);
          setTimeout(goNext, 0);
          return 0;
        }
        return p + 100 / (DURATION / 100);
      });
    }, 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [groupIdx, storyIdx, showDetails]);

  function goNext() {
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx((i) => i + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((g) => g + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }

  function goPrev() {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
    } else if (groupIdx > 0) {
      setGroupIdx((g) => g - 1);
      setStoryIdx(0);
    }
  }

  async function handleContact() {
    const token = localStorage.getItem("glow_token");
    if (!token || !currentUserId) {
      onClose();
      navigate("/login");
      return;
    }
    setMessaging(true);
    const convId = await startConversation(group.userId, token);
    setMessaging(false);
    if (convId) {
      onClose();
      navigate(`/chat/${convId}`);
    }
  }

  async function handleLike() {
    const token = localStorage.getItem("glow_token");
    if (!token || !story) return;
    setLiking(true);
    const result = await toggleStoryLike(story.id, token);
    setLiking(false);
    if (result && onLikeToggle) {
      onLikeToggle(story.id, result.liked, result.likeCount);
    }
    if (!result) {
      toast({ variant: "destructive", title: "تعذر الإعجاب" });
    }
  }

  async function openDetails(type: "viewers" | "likes") {
    const token = localStorage.getItem("glow_token");
    if (!token || !story) return;
    setShowDetails(type);
    setLoadingDetails(true);
    const data = type === "viewers"
      ? await fetchStoryViewers(story.id, token)
      : await fetchStoryLikers(story.id, token);
    setDetailsData(data);
    setLoadingDetails(false);
  }

  if (!group || !story) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
    >
      <div className="relative w-full max-w-lg h-full">
        {/* Media with swipe gesture — TikTok vertical */}
        <motion.div
          className="absolute inset-0"
          style={story.mediaType === "text" ? { background: story.bgColor ?? "linear-gradient(160deg,#0f0c29,#302b63,#24243e)" } : { background: "#000" }}
          drag="y"
          dragElastic={0.15}
          dragConstraints={{ top: 0, bottom: 0 }}
          onDragEnd={(_, info) => {
            if (info.offset.y < -80) goNext();      // swipe up → next
            else if (info.offset.y > 80) goPrev();  // swipe down → prev
          }}
        >
          {story.mediaType === "text" ? (
            <>
              {/* subtle radial highlight */}
              <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.07) 0%, transparent 70%)" }} />
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <p
                  className="text-white text-center text-3xl leading-relaxed break-words w-full"
                  style={{
                    fontFamily: story.fontFamily ? `'${story.fontFamily}', serif` : "'Amiri', serif",
                    textShadow: "0 2px 20px rgba(0,0,0,0.5)",
                    direction: "rtl",
                  }}
                >
                  {story.caption}
                </p>
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50" />
            </>
          ) : (
            <>
              <img src={story.mediaUrl ?? ""} alt="" className="w-full h-full object-cover" draggable={false} loading="lazy" decoding="async" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70" />
            </>
          )}
        </motion.div>

        {/* Progress Bars */}
        {!showDetails && (
          <div className="absolute top-0 left-0 right-0 z-10 flex gap-1 p-3 pt-12">
            {group.stories.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full"
                  style={{ width: i < storyIdx ? "100%" : i === storyIdx ? `${progress}%` : "0%" }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center gap-3 px-4 pt-16">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white border-2 border-white/40 shrink-0 overflow-hidden"
            style={{ background: avatarColor(group.userName) }}
          >
            {group.userAvatar
              ? <img src={group.userAvatar} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async" />
              : group.userName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate flex items-center gap-1">
              {group.userName}
              {(group.userIsVerified || group.userRole === "admin") && <VerifiedBadge size="xs" role={group.userRole} />}
            </p>
            <p className="text-white/50 text-[10px]">
              {new Date(story.createdAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
              {isMyStory && (
                <>
                  {(story.viewCount ?? 0) > 0 && <span className="mr-2">• 👁 {liveViews}</span>}
                  {(story.likeCount ?? 0) > 0 && <span className="mr-2">• ❤️ {liveLikes}</span>}
                </>
              )}
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Tap zones — vertical: bottom half = next, top half = prev */}
        {!showDetails && (
          <div className="absolute inset-0 flex flex-col z-10 pointer-events-none">
            <div className="w-full h-1/3 pointer-events-auto" onClick={goPrev} />
            <div className="w-full h-1/3 pointer-events-none" />
            <div className="w-full h-1/3 pointer-events-auto" onClick={goNext} />
          </div>
        )}

        {/* Caption — only for image/video stories, not text (text IS the caption) */}
        {story.caption && story.mediaType !== "text" && !showDetails && (
          <div className="absolute bottom-32 left-0 right-0 z-10 px-5">
            <p className="text-white text-sm font-semibold text-center drop-shadow-lg bg-black/30 rounded-2xl px-4 py-2 backdrop-blur-sm">
              {story.caption}
            </p>
          </div>
        )}

        {/* Bottom actions — TikTok style */}
        {!showDetails && (
          <div className="absolute bottom-6 left-0 right-0 z-30 px-5">
            <div className="flex items-center justify-between">
              {/* Left: Caption + user info */}
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-white font-bold text-sm flex items-center gap-1.5 mb-1">
                  {group.userName}
                  {(group.userIsVerified || group.userRole === "admin") && <VerifiedBadge size="xs" role={group.userRole} />}
                </p>
                {story.caption && story.mediaType !== "text" && (
                  <p className="text-white/80 text-xs leading-relaxed line-clamp-3">{story.caption}</p>
                )}
                {story.mediaType === "text" && (
                  <p className="text-white/80 text-xs leading-relaxed line-clamp-3">{story.caption ?? "حالة نصية"}</p>
                )}
              </div>

              {/* Right: action buttons column */}
              <div className="flex flex-col items-center gap-4">
                {/* Avatar on top */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white border-2 border-white/50 shrink-0 overflow-hidden"
                  style={{ background: avatarColor(group.userName) }}
                >
                  {group.userAvatar
                    ? <img src={group.userAvatar} className="w-full h-full object-cover" alt="" />
                    : group.userName[0]}
                </div>

                {/* Like button — for others */}
                {!isMyStory && (
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={(e) => { e.stopPropagation(); handleLike(); }}
                    disabled={liking}
                    className="flex flex-col items-center gap-0.5"
                  >
                    <Heart
                      className={`w-8 h-8 transition-colors ${story.likedByMe ? "text-red-500 fill-red-500" : "text-white"}`}
                    />
                    <span className="text-white text-[10px] font-bold">{liveLikes}</span>
                  </motion.button>
                )}

                {/* Viewers / Likes — for me */}
                {isMyStory && (
                  <>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); openDetails("viewers"); }}
                      className="flex flex-col items-center gap-0.5"
                    >
                      <Users className="w-7 h-7 text-white" />
                      <span className="text-white text-[10px] font-bold">{liveViews}</span>
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); openDetails("likes"); }}
                      className="flex flex-col items-center gap-0.5"
                    >
                      <Heart className="w-7 h-7 text-red-400 fill-red-400" />
                      <span className="text-white text-[10px] font-bold">{liveLikes}</span>
                    </motion.button>
                  </>
                )}

                {/* دردشة button — always visible for others */}
                {!isMyStory && (
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={(e) => { e.stopPropagation(); handleContact(); }}
                    disabled={messaging}
                    className="flex flex-col items-center gap-0.5"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center shadow-[0_0_16px_rgba(168,85,247,0.5)]">
                      <MessageCircle className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white text-[10px] font-bold">دردشة</span>
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Details panel (viewers / likes) */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute bottom-0 left-0 right-0 z-40 bg-[#0a0a10]/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl max-h-[70%] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <p className="text-white font-bold text-sm">
                  {showDetails === "viewers" ? "من شاهد الحالة" : "الإعجابات"}
                </p>
                <button
                  onClick={() => setShowDetails(null)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-3">
                {loadingDetails ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : detailsData.length === 0 ? (
                  <p className="text-white/30 text-xs text-center py-8">
                    {showDetails === "viewers" ? "لا مشاهدات بعد" : "لا إعجابات بعد"}
                  </p>
                ) : (
                  detailsData.map((person, i) => (
                    <motion.div
                      key={person.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.045, duration: 0.25, ease: "easeOut" }}
                      className="flex items-center gap-3"
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white border border-white/20 shrink-0 overflow-hidden"
                        style={{ background: avatarColor(person.name) }}
                      >
                        {person.avatar
                          ? <img src={person.avatar} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async" />
                          : person.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{person.name}</p>
                        <p className="text-white/30 text-[10px]">
                          {new Date((person as any).viewedAt ?? (person as any).likedAt).toLocaleTimeString("ar", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vertical swipe hint */}
        {!showDetails && (
          <div className="absolute bottom-1 left-0 right-0 z-20 flex justify-center">
            <div className="w-8 h-1 rounded-full bg-white/20" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function StoriesBar() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStart, setViewerStart] = useState(0);

  useEffect(() => {
    fetchStories().then(setGroups);
    const interval = setInterval(() => fetchStories().then(setGroups), 60_000);
    return () => clearInterval(interval);
  }, []);

  function openViewer(index: number) {
    setViewerStart(index);
    setViewerOpen(true);
  }

  function handleLikeToggle(storyId: string, liked: boolean, likeCount: number) {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        stories: g.stories.map((s) =>
          s.id === storyId ? { ...s, likedByMe: liked, likeCount } : s
        ),
      }))
    );
  }

  return (
    <>
      <div className="space-y-2">
        {/* Stories Row — Instagram/WhatsApp Style */}
        <div className="flex gap-[14px] overflow-x-auto scrollbar-none px-5 py-2">
          {/* Add Story Button */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate(user ? "/add-story" : "/login")}
            className="flex flex-col items-center gap-1.5 shrink-0"
          >
            <div className="relative w-[72px] h-[72px] flex items-center justify-center">
              <div className="absolute inset-0 rounded-full p-[2.5px] bg-gradient-to-br from-primary via-secondary to-accent shadow-[0_0_16px_rgba(168,85,247,0.35)]" />
              <div className="absolute inset-[2.5px] rounded-full bg-background flex items-center justify-center overflow-hidden">
                <div className="w-full h-full rounded-full bg-primary/15 flex items-center justify-center">
                  <Plus className="w-7 h-7 text-primary" strokeWidth={2.5} />
                </div>
              </div>
            </div>
            <span className="text-[11px] text-white/80 font-semibold max-w-[72px] truncate">حالتي</span>
          </motion.button>

          {/* Story Groups */}
          {groups.map((group, i) => {
            const isMe = user?.id === group.userId;
            const hasNew = !group.allViewed;
            return (
              <motion.button
                key={group.userId}
                whileTap={{ scale: 0.92 }}
                onClick={() => openViewer(i)}
                className="flex flex-col items-center gap-1.5 shrink-0"
              >
                {/* Avatar Ring */}
                {(() => {
                  const firstStory = group.stories[0];
                  const isTextStory = firstStory?.mediaType === "text";
                  const textBg = isTextStory ? (firstStory.bgColor ?? "linear-gradient(160deg,#0f0c29,#302b63,#24243e)") : null;
                  const textPreview = isTextStory ? (firstStory.caption ?? "") : null;
                  return (
                    <div className="relative w-[72px] h-[72px] flex items-center justify-center">
                      {hasNew ? (
                        <div className="absolute inset-0 rounded-full p-[2.5px] bg-gradient-to-br from-primary via-secondary to-accent shadow-[0_0_16px_rgba(168,85,247,0.35)]">
                          <div className="w-full h-full rounded-full bg-background" />
                        </div>
                      ) : (
                        <div className="absolute inset-0 rounded-full p-[2.5px] bg-white/15" />
                      )}
                      <div className="absolute inset-[2.5px] rounded-full overflow-hidden bg-muted">
                        {isTextStory ? (
                          <div className="w-full h-full flex items-center justify-center" style={{ background: textBg! }}>
                            <span className="text-white text-xs font-bold px-1 text-center leading-tight line-clamp-2 drop-shadow"
                              style={{ fontFamily: firstStory.fontFamily ? `'${firstStory.fontFamily}', serif` : "'Amiri', serif", fontSize: 11 }}>
                              {textPreview && textPreview.length > 12 ? textPreview.slice(0,12)+"…" : (textPreview || "نص")}
                            </span>
                          </div>
                        ) : group.userAvatar ? (
                          <img src={group.userAvatar} className="w-full h-full object-cover" alt="" loading="lazy" decoding="async" />
                        ) : (
                          <span className="text-[22px] font-black flex items-center justify-center w-full h-full" style={{ color: avatarColor(group.userName) }}>
                            {group.userName[0]}
                          </span>
                        )}
                      </div>
                      {/* Live dot */}
                      {hasNew && (
                        <div className="absolute -bottom-0.5 right-0 w-3.5 h-3.5 rounded-full bg-background flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                        </div>
                      )}
                    </div>
                  );
                })()}
                {/* Name + badge */}
                <div className="flex items-center gap-1 max-w-[72px]">
                  <span className={`text-[11px] font-semibold truncate ${hasNew ? "text-white" : "text-white/50"}`}>
                    {isMe ? "حالتي" : group.userName.split(" ")[0]}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Empty State */}
        {groups.length === 0 && (
          <div className="mx-5 rounded-2xl bg-white/3 border border-white/8 px-4 py-3 text-center">
            <p className="text-white/30 text-xs">لا توجد حالات بعد — كن أول من ينشر!</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {viewerOpen && groups.length > 0 && (
          <StoryViewer
            groups={groups}
            startGroupIndex={viewerStart}
            onClose={() => setViewerOpen(false)}
            currentUserId={user?.id}
            onLikeToggle={handleLikeToggle}
          />
        )}
      </AnimatePresence>
    </>
  );
}
