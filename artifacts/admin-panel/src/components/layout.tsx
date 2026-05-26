import { Link, useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { 
  Activity, 
  Box, 
  LayoutDashboard, 
  LogOut,
  Tags,
  Users,
  Headset,
  ShoppingBag,
  Image,
  Megaphone,
  Flag,
  Truck,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { useState, useEffect } from "react";

const ADMIN_ID = "e0757f35-e7d4-4c07-ae0b-339252aecfa6";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logout, user } = useAdminAuth();
  const [supportUnread, setSupportUnread] = useState(0);
  const [pendingReports, setPendingReports] = useState(0);
  const [pendingDeliveries, setPendingDeliveries] = useState(0);

  // Poll for unread support messages + pending reports
  useEffect(() => {
    const token = localStorage.getItem("glow_admin_token");
    if (!token) return;
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/conversations", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const convs = await res.json();
        const unread = convs
          .filter((c: any) => c.participants?.some((p: any) => p.id === ADMIN_ID))
          .reduce((sum: number, c: any) => sum + (c.unreadCount ?? 0), 0);
        setSupportUnread(unread);
      } catch {}
    };
    const fetchReports = async () => {
      try {
        const token2 = localStorage.getItem("glow_admin_token");
        if (!token2) return;
        const res = await fetch("/api/admin/reports", { headers: { Authorization: `Bearer ${token2}` } });
        if (!res.ok) return;
        const data = await res.json();
        setPendingReports(data.filter((r: any) => r.status === "pending").length);
      } catch {}
    };
    const fetchDeliveries = async () => {
      try {
        const token2 = localStorage.getItem("glow_admin_token");
        if (!token2) return;
        const res = await fetch("/api/admin/delivery-requests", { headers: { Authorization: `Bearer ${token2}` } });
        if (!res.ok) return;
        const data = await res.json();
        setPendingDeliveries(data.filter((r: any) => r.deliveryStatus === "pending").length);
      } catch {}
    };
    fetchUnread();
    fetchReports();
    fetchDeliveries();
    const iv = setInterval(() => { fetchUnread(); fetchReports(); fetchDeliveries(); }, 10000);
    return () => clearInterval(iv);
  }, []);

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/products", label: "Products", icon: Box },
    { href: "/users", label: "Users", icon: Users },
    { href: "/categories", label: "Categories", icon: Tags },
    { href: "/support", label: "Support", icon: Headset, badge: supportUnread },
    { href: "/seller-orders", label: "Seller Orders", icon: ShoppingBag },
    { href: "/banners", label: "البانرات", icon: Image },
    { href: "/broadcast", label: "Broadcast", icon: Megaphone },
    { href: "/reports", label: "التبليغات", icon: Flag, badge: pendingReports },
    { href: "/delivery-requests", label: "التوصيل", icon: Truck, badge: pendingDeliveries },
    { href: "/flash-sales", label: "Flash Sales", icon: Zap },
    { href: "/activity", label: "Activity", icon: Activity },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground dark">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border bg-card flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center border border-primary/50">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <span className="font-mono font-bold text-lg tracking-wider text-primary">GAYTAK<span className="text-foreground">ADMIN</span></span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className="block">
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 cursor-pointer relative font-mono text-sm",
                    isActive 
                      ? "text-primary bg-primary/10" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="flex-1">{item.label}</span>
                  {(item as any).badge > 0 && (
                    <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {(item as any).badge}
                    </span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="active-nav-indicator"
                      className="absolute left-0 w-1 h-full bg-primary rounded-r-full"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-mono font-bold text-xs uppercase overflow-hidden border border-primary/30">
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                user?.name.substring(0, 2)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-primary font-mono truncate uppercase">System Admin</p>
            </div>
          </div>
          <Button 
            variant="destructive" 
            className="w-full justify-start gap-2 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white border border-destructive/20 font-mono text-sm"
            onClick={logout}
          >
            <LogOut className="w-4 h-4" />
            TERMINATE SESSION
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />
        <div className="relative z-10 p-8 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
