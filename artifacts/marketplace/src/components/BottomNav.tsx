import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Home, Search, Plus, MessageCircle, User, Heart, Play } from "lucide-react";
import { motion } from "framer-motion";
import { useListConversations, getListConversationsQueryKey } from "@workspace/api-client-react";

type NavTab = {
  href: string;
  icon: typeof Home;
  label: string;
  auth: boolean;
  isSell?: boolean;
  isChat?: boolean;
};

const tabs: NavTab[] = [
  { href: "/", icon: Home, label: "الرئيسية", auth: false },
  { href: "/products", icon: Search, label: "استكشف", auth: false },
  { href: "/content", icon: Play, label: "المحتوى", auth: false },
  { href: "/sell", icon: Plus, label: "بيع", auth: true, isSell: true },
  { href: "/chat", icon: MessageCircle, label: "محادثات", auth: true, isChat: true },
  { href: "/wishlist", icon: Heart, label: "مفضلتي", auth: true },
  { href: "/profile", icon: User, label: "حسابي", auth: true },
];

export function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();

  const { data: conversations } = useListConversations({
    query: { enabled: !!user, refetchInterval: 15_000, queryKey: getListConversationsQueryKey() },
  });

  const totalUnread = conversations?.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0) ?? 0;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-[68px] bg-black/80 backdrop-blur-xl border-t border-white/10">
      <div className="flex items-center justify-around h-full px-1 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = tab.href === "/" ? location === "/" : location.startsWith(tab.href);
          const Icon = tab.icon;
          const href = tab.auth && !user ? "/login" : tab.href;

          if (tab.isSell) {
            return (
              <Link key={tab.href} href={href}>
                <motion.div whileTap={{ scale: 0.9 }} className="flex flex-col items-center gap-0.5">
                  <div className="w-13 h-13 -mt-5 rounded-full bg-primary flex items-center justify-center shadow-[0_0_24px_rgba(168,85,247,0.7)] border-2 border-primary/60">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-[9px] text-primary font-bold mt-1">{tab.label}</span>
                </motion.div>
              </Link>
            );
          }

          const showBadge = tab.isChat && !!user && totalUnread > 0 && !location.startsWith("/chat");

          return (
            <Link key={tab.href} href={href}>
              <motion.div
                whileTap={{ scale: 0.85 }}
                className="flex flex-col items-center gap-1 py-2 px-2 relative"
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-0 left-1/2 -translate-x-1/2 w-7 h-0.5 rounded-full bg-primary shadow-[0_0_8px_rgba(168,85,247,0.9)]"
                  />
                )}
                <div className="relative">
                  <Icon className={`w-5 h-5 transition-colors ${isActive ? "text-primary" : "text-white/40"}`} />
                  {showBadge && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 min-w-[15px] h-3.5 rounded-full bg-red-500 flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                    >
                      <span className="text-[8px] text-white font-bold px-0.5">
                        {totalUnread > 9 ? "9+" : totalUnread}
                      </span>
                    </motion.div>
                  )}
                </div>
                <span
                  className={`text-[9px] font-semibold transition-colors ${isActive ? "text-primary" : "text-white/40"}`}
                  style={{ maxWidth: 38, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {tab.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
