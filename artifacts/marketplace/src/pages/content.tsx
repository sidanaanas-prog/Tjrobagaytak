import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import {
  Heart, MessageCircle, Plus, Trash2, Play,
  Volume2, VolumeX, ChevronUp, ChevronDown, UserCheck,
  Eye, TrendingUp, TrendingDown, Send, X, Clock,
} from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { getMemToken } from "@/hooks/use-auth";

function TrendArrow({ value, median, size = "sm" }: { value: number; median: number; size?: "sm" | "xs" }) {
  if (median === 0 && value === 0) return null;
  const ratio = median > 0 ? value / median : 1;
  if (ratio >= 1.3) return <TrendingUp className={`${size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"} text-green-400 flex-shrink-0`} />;
  if (ratio <= 0.7) return <TrendingDown className={`${size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"} text-red-400 flex-shrink-0`} />;
  return null;
}

interface ContentVideo {
  id: string;
  userId: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  likesCount: number;
  viewsCount: number;
  commentsCount: number;
  createdAt: string;
  userName: string;
  userAvatar: string | null;
  likedByMe: boolean;
}

interface Comment {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  userRole?: string | null;
  createdAt: string;
}

function getEmbedUrl(url: string): { type: "iframe" | "video"; src: string } {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      let vid = u.searchParams.get("v");
      if (!vid) vid = u.pathname.split("/").pop() ?? "";
      return { type: "iframe", src: `https://www.youtube.com/embed/${vid}?autoplay=1&mute=1&loop=1&playlist=${vid}&controls=0&rel=0&playsinline=1` };
    }
    if (u.hostname.includes("tiktok.com")) {
      return { type: "iframe", src: `https://www.tiktok.com/embed/${u.pathname.split("/").pop()}` };
    }
    return { type: "video", src: url };
  } catch {
    return { type: "video", src: url };
  }
}

function CommentsDrawer({
  videoId, open, onClose, currentUserId,
}: {
  videoId: string; open: boolean; onClose: () => void; currentUserId?: string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const token = getMemToken();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/content/${videoId}/comments`)
      .then((r) => r.json())
      .then((data) => setComments(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [open, videoId]);

  const handleSend = async () => {
    if (!text.trim() || !token) return;
    setSending(true);
    try {
      const res = await fetch(`/api/content/${videoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const c = await res.json();
        setComments((prev) => [c, ...prev]);
        setText("");
      }
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    const res = await fetch(`/api/content/${videoId}/comments/${commentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 z-40 bg-zinc-900 rounded-t-2xl flex flex-col"
            style={{ maxHeight: "70%" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <span className="text-white font-bold text-sm">التعليقات</span>
              <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scrollbar-none">
              {loading && (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!loading && comments.length === 0 && (
                <p className="text-center text-white/40 text-sm py-8">لا توجد تعليقات بعد — كن أول من يعلّق!</p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                    {c.userAvatar
                      ? <img src={c.userAvatar} className="w-full h-full object-cover" alt={c.userName} />
                      : <span className="text-white text-xs font-black">{c.userName?.[0]}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-white/70 text-xs font-bold flex items-center gap-1">
                      @{c.userName}
                      {c.userRole === "admin" && <VerifiedBadge size="xs" />}
                    </span>
                    <p className="text-white text-sm leading-snug mt-0.5">{c.text}</p>
                  </div>
                  {c.userId === currentUserId && (
                    <button onClick={() => handleDelete(c.id)} className="text-white/30 hover:text-red-400 transition-colors shrink-0 mt-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-t border-white/10">
              {token ? (
                <>
                  <input
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="اكتب تعليقاً..."
                    className="flex-1 bg-white/10 text-white placeholder:text-white/30 rounded-full px-4 py-2 text-sm outline-none border border-white/10 focus:border-primary/50"
                  />
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    disabled={!text.trim() || sending}
                    onClick={handleSend}
                    className="w-9 h-9 rounded-full bg-primary flex items-center justify-center disabled:opacity-40"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </motion.button>
                </>
              ) : (
                <p className="text-white/50 text-sm text-center w-full py-1">
                  <Link href="/login" onClick={onClose} className="text-primary underline">سجّل دخول</Link> للتعليق
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ViewersDrawer({ videoId, open, onClose }: { videoId: string; open: boolean; onClose: () => void }) {
  const [viewers, setViewers] = useState<{ userId: string | null; userName: string | null; userAvatar: string | null; viewedAt: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const token = getMemToken();

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    fetch(`/api/content/${videoId}/viewers`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setViewers(Array.isArray(data) ? data : []))
      .catch(() => setViewers([]))
      .finally(() => setLoading(false));
  }, [open, videoId]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 bg-black/40" onClick={onClose} />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 z-40 bg-zinc-900 rounded-t-2xl flex flex-col"
            style={{ maxHeight: "65%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <span className="text-white font-bold text-sm flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" /> المشاهدون
              </span>
              <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-none">
              {loading && (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {!loading && viewers.length === 0 && (
                <p className="text-center text-white/40 text-sm py-8">لا توجد مشاهدات مسجّلة بعد</p>
              )}
              {viewers.map((v, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                    {v.userAvatar
                      ? <img src={v.userAvatar} className="w-full h-full object-cover" alt={v.userName ?? ""} />
                      : <span className="text-white text-sm font-black">{v.userName?.[0] ?? "؟"}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold">{v.userName ?? "مستخدم مجهول"}</p>
                    <p className="text-white/40 text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(v.viewedAt).toLocaleString("ar-SA", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function VideoCard({
  video, isActive, onLike, onView, onDelete, isMine, onNext, onPrev, hasNext, hasPrev,
  medianLikes, medianViews, currentUserId,
}: {
  video: ContentVideo;
  isActive: boolean;
  onLike: (id: string) => void;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
  isMine: boolean;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  medianLikes: number;
  medianViews: number;
  currentUserId?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(video.likedByMe);
  const [likesCount, setLikesCount] = useState(video.likesCount);
  const [commentsCount, setCommentsCount] = useState(video.commentsCount ?? 0);
  const [heartAnim, setHeartAnim] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const viewed = useRef(false);
  const embed = getEmbedUrl(video.videoUrl);
  const token = getMemToken();

  useEffect(() => { viewed.current = false; }, [video.id]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive) {
      el.play()
        .then(() => setPaused(false))
        .catch(() => setPaused(true)); // autoplay blocked — أظهر زر التشغيل
      if (!viewed.current) { onView(video.id); viewed.current = true; }
    } else {
      el.pause();
      el.currentTime = 0;
      setPaused(false);
    }
  }, [isActive]);

  useEffect(() => {
    if (isActive && !viewed.current) { onView(video.id); viewed.current = true; }
  }, [isActive]);

  const handleDoubleTap = () => {
    if (!liked) {
      setLiked(true);
      setLikesCount((c) => c + 1);
      setHeartAnim(true);
      onLike(video.id);
      setTimeout(() => setHeartAnim(false), 900);
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikesCount((c) => (wasLiked ? c - 1 : c + 1));
    if (!wasLiked) { setHeartAnim(true); setTimeout(() => setHeartAnim(false), 900); }
    onLike(video.id);
  };

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token || followLoading) return;
    setFollowLoading(true);
    try {
      if (following) {
        await fetch("/api/follows", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sellerId: video.userId }),
        });
        setFollowing(false);
      } else {
        await fetch("/api/follows", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sellerId: video.userId }),
        });
        setFollowing(true);
      }
    } finally {
      setFollowLoading(false);
    }
  };

  return (
    <div
      className="relative w-full h-full flex-shrink-0 bg-black overflow-hidden"
      onDoubleClick={handleDoubleTap}
    >
      {embed.type === "video" ? (
        <>
          <video
            ref={videoRef}
            src={embed.src}
            className="absolute inset-0 w-full h-full object-cover"
            loop
            muted={muted}
            playsInline
            preload="metadata"
            onClick={() => {
              const el = videoRef.current;
              if (!el) return;
              if (el.paused) {
                el.play().then(() => setPaused(false)).catch(() => {});
              } else {
                el.pause();
                setPaused(true);
              }
            }}
          />
          {paused && isActive && (
            <button
              className="absolute inset-0 flex items-center justify-center z-10"
              onClick={() => {
                videoRef.current?.play().then(() => setPaused(false)).catch(() => {});
              }}
            >
              <div className="w-20 h-20 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <Play className="w-10 h-10 text-white fill-white ml-1" />
              </div>
            </button>
          )}
        </>
      ) : (
        <iframe
          src={isActive ? embed.src : undefined}
          className="absolute inset-0 w-full h-full border-0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={video.caption ?? "video"}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10 pointer-events-none" />

      {heartAnim && (
        <AnimatePresence>
          <motion.div
            key="heart"
            initial={{ scale: 0.5, opacity: 1 }}
            animate={{ scale: 2.2, opacity: 0 }}
            transition={{ duration: 0.75 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          >
            <Heart className="w-28 h-28 text-red-500 fill-red-500 drop-shadow-lg" />
          </motion.div>
        </AnimatePresence>
      )}

      {/* ── أسهم التنقل — يسار الشاشة ─── */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-3 z-20">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          disabled={!hasPrev}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all
            ${hasPrev ? "bg-white/15 backdrop-blur-sm text-white hover:bg-white/25" : "opacity-0 pointer-events-none"}`}
        >
          <ChevronUp className="w-6 h-6" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          disabled={!hasNext}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all
            ${hasNext ? "bg-white/15 backdrop-blur-sm text-white hover:bg-white/25" : "opacity-0 pointer-events-none"}`}
        >
          <ChevronDown className="w-6 h-6" />
        </motion.button>
      </div>

      {/* ── أزرار التفاعل — يمين الشاشة ─── */}
      <div className="absolute right-2 bottom-24 flex flex-col items-center gap-5 z-20">

        {/* البروفايل */}
        <Link href={`/seller/${video.userId}`} onClick={(e) => e.stopPropagation()}>
          <div className="relative flex flex-col items-center gap-1">
            <div className="w-11 h-11 rounded-full border-2 border-white overflow-hidden bg-primary/20 shadow-lg">
              {video.userAvatar ? (
                <img src={video.userAvatar} className="w-full h-full object-cover" alt={video.userName} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-white text-base font-black">{video.userName?.[0]}</span>
                </div>
              )}
            </div>
            {!isMine && (
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleFollow(e as any); }}
                disabled={followLoading}
                className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-black shadow border border-black/30 transition-all
                  ${following ? "bg-primary" : "bg-white text-black"}`}
              >
                {following ? <UserCheck className="w-3 h-3" /> : <span>+</span>}
              </motion.button>
            )}
          </div>
        </Link>

        {/* إعجاب */}
        <button onClick={handleLike} className="flex flex-col items-center gap-0.5">
          <motion.div whileTap={{ scale: 1.4 }}
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all
              ${liked ? "bg-red-500/25" : "bg-black/40 backdrop-blur-sm"}`}
          >
            <Heart className={`w-6 h-6 transition-colors ${liked ? "fill-red-500 text-red-500" : "text-white"}`} />
          </motion.div>
          <span className="text-white text-[11px] font-bold drop-shadow">{likesCount}</span>
          <TrendArrow value={likesCount} median={medianLikes} size="xs" />
        </button>

        {/* تعليق */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
          className="flex flex-col items-center gap-0.5"
        >
          <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center shadow-lg">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-[11px] font-bold drop-shadow">{commentsCount}</span>
        </button>

        {/* مشاهدات — لصاحب الفيديو: اضغط لترى من شاهد */}
        <button
          onClick={(e) => { e.stopPropagation(); if (isMine) setShowViewers(true); }}
          className="flex flex-col items-center gap-0.5"
        >
          <div className={`w-11 h-11 rounded-full backdrop-blur-sm flex items-center justify-center shadow-lg transition-all ${isMine ? "bg-primary/20 ring-1 ring-primary/40" : "bg-black/40"}`}>
            <Eye className={`w-6 h-6 ${isMine ? "text-primary" : "text-white/80"}`} />
          </div>
          <span className="text-white text-[11px] font-bold drop-shadow">{video.viewsCount}</span>
          <TrendArrow value={video.viewsCount} median={medianViews} size="xs" />
        </button>


        {/* صوت */}
        {embed.type === "video" && (
          <button onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
            className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center shadow-lg">
            {muted ? <VolumeX className="w-5 h-5 text-white/60" /> : <Volume2 className="w-5 h-5 text-white" />}
          </button>
        )}

        {/* حذف */}
        {isMine && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(video.id); }}
            className="w-11 h-11 rounded-full bg-red-500/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
            <Trash2 className="w-5 h-5 text-red-400" />
          </button>
        )}
      </div>

      {/* اسم صاحب الفيديو + وصف */}
      <div className="absolute bottom-24 left-14 right-16 z-10">
        <span className="text-white font-bold text-sm drop-shadow flex items-center gap-1 mb-1">
          @{video.userName}
          {(video as any).userRole === "admin" && <VerifiedBadge size="xs" />}
        </span>
        {video.caption && (
          <p className="text-white/90 text-sm leading-relaxed drop-shadow line-clamp-3">{video.caption}</p>
        )}
      </div>

      {/* درج التعليقات */}
      <CommentsDrawer
        videoId={video.id}
        open={showComments}
        onClose={() => setShowComments(false)}
        currentUserId={currentUserId}
      />

      {/* درج المشاهدين — لصاحب الفيديو فقط */}
      {isMine && (
        <ViewersDrawer
          videoId={video.id}
          open={showViewers}
          onClose={() => setShowViewers(false)}
        />
      )}
    </div>
  );
}

export default function ContentPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [videos, setVideos] = useState<ContentVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const token = getMemToken();
  const abortRef = useRef<AbortController | null>(null);

  const fetchVideos = useCallback(async (showSpinner = false) => {
    // إلغاء أي طلب سابق لمنع race condition
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    if (showSpinner) setLoading(true);
    try {
      const res = await fetch("/api/content?limit=30", {
        signal: ctrl.signal,
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setVideos(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchVideos(true); // أظهر spinner فقط عند التحميل الأول
    return () => { abortRef.current?.abort(); };
  }, [fetchVideos]);

  // يُربط الـscroll listener بعد انتهاء التحميل لأن containerRef.current = null خلال الـspinner
  useEffect(() => {
    if (loading || videos.length === 0) return;
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const h = el.clientHeight;
      setActiveIndex(Math.round(el.scrollTop / h));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [loading, videos.length]);

  const scrollTo = (index: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: index * el.clientHeight, behavior: "smooth" });
  };

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid]! : ((sorted[mid - 1]! + sorted[mid]!) / 2);
  };
  const medianLikes = median(videos.map((v) => v.likesCount));
  const medianViews = median(videos.map((v) => v.viewsCount));

  const handleLike = async (id: string) => {
    if (!user) { navigate("/login"); return; }
    await fetch(`/api/content/${id}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  const handleView = async (id: string) => {
    await fetch(`/api/content/${id}/view`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف هذا الفيديو؟")) return;
    const res = await fetch(`/api/content/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setVideos((v) => v.filter((x) => x.id !== id));
      toast({ title: "تم الحذف" });
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 pb-16">
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
          <Play className="w-12 h-12 text-primary" />
        </div>
        <div className="text-center">
          <p className="text-white text-xl font-bold mb-2">لا يوجد محتوى بعد</p>
          <p className="text-white/50 text-sm">كن أول من يشارك فيديو!</p>
        </div>
        <Link href="/add-content">
          <motion.button
            whileTap={{ scale: 0.92, boxShadow: "0 0 60px rgba(168,85,247,1), 0 0 120px rgba(168,85,247,0.6)" }}
            animate={{
              boxShadow: [
                "0 0 20px rgba(168,85,247,0.6), 0 0 40px rgba(168,85,247,0.3)",
                "0 0 35px rgba(168,85,247,0.95), 0 0 70px rgba(168,85,247,0.5)",
                "0 0 20px rgba(168,85,247,0.6), 0 0 40px rgba(168,85,247,0.3)",
              ],
            }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="flex items-center gap-3 bg-primary text-white px-8 py-4 rounded-full font-black text-base tracking-wide border border-white/20"
          >
            <motion.div
              animate={{ rotate: [0, 90, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <Plus className="w-6 h-6" />
            </motion.div>
            شارك إبداعك
          </motion.button>
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black">
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll"
        style={{ scrollSnapType: "y mandatory", scrollbarWidth: "none" }}
      >
        {videos.map((video, i) => (
          <div
            key={video.id}
            style={{ scrollSnapAlign: "start", height: "100dvh" }}
            className="w-full flex-shrink-0"
          >
            <VideoCard
              video={video}
              isActive={i === activeIndex}
              onLike={handleLike}
              onView={handleView}
              onDelete={handleDelete}
              isMine={user?.id === video.userId}
              onNext={() => scrollTo(i + 1)}
              onPrev={() => scrollTo(i - 1)}
              hasNext={i < videos.length - 1}
              hasPrev={i > 0}
              medianLikes={medianLikes}
              medianViews={medianViews}
              currentUserId={user?.id}
            />
          </div>
        ))}
      </div>

      {/* زر شارك إبداعك */}
      <Link href="/add-content">
        <motion.button
          whileTap={{ scale: 0.92, boxShadow: "0 0 60px rgba(168,85,247,1), 0 0 120px rgba(168,85,247,0.6)" }}
          animate={{
            boxShadow: [
              "0 0 18px rgba(168,85,247,0.55), 0 0 36px rgba(168,85,247,0.25)",
              "0 0 28px rgba(168,85,247,0.85), 0 0 56px rgba(168,85,247,0.45)",
              "0 0 18px rgba(168,85,247,0.55), 0 0 36px rgba(168,85,247,0.25)",
            ],
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-primary px-5 py-3 rounded-full font-black text-white text-sm tracking-wide border border-white/20"
          style={{ backdropFilter: "blur(8px)" }}
        >
          <motion.div
            animate={{ rotate: [0, 90, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Plus className="w-5 h-5" />
          </motion.div>
          شارك إبداعك
        </motion.button>
      </Link>
    </div>
  );
}
