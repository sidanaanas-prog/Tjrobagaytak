import React, { useState, useEffect } from "react";
import { getToken, removeToken, api } from "./api";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import SellPage from "./pages/SellPage";
import ChatPage from "./pages/ChatPage";
import ProfilePage from "./pages/ProfilePage";

const TABS = [
  { id: "home", label: "الرئيسية", icon: "🏠" },
  { id: "sell", label: "أضف", icon: "➕" },
  { id: "chat", label: "المحادثات", icon: "💬" },
  { id: "profile", label: "حسابي", icon: "👤" },
];

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("home");

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    api("/auth/me").then(r => setUser(r.user || r)).catch(() => removeToken()).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#09090F" }}>
      <div style={{ color: "#AA33FF", fontSize: 40 }}>⬡</div>
    </div>
  );

  if (!user) return <LoginPage onLogin={setUser} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ flex: 1, overflow: "auto" }}>
        {tab === "home" && <HomePage user={user} />}
        {tab === "sell" && <SellPage user={user} onDone={() => setTab("home")} />}
        {tab === "chat" && <ChatPage user={user} />}
        {tab === "profile" && <ProfilePage user={user} onLogout={() => { removeToken(); setUser(null); }} />}
      </div>
      <nav style={{ display: "flex", background: "#0D0D18", borderTop: "1px solid #1a1a2e", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "10px 4px", background: "none", border: "none",
            color: tab === t.id ? "#AA33FF" : "#666", fontSize: 10, display: "flex",
            flexDirection: "column", alignItems: "center", gap: 4,
          }}>
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
