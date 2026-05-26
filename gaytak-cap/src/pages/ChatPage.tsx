import React, { useState, useEffect, useRef } from "react";
import { api } from "../api";

const C = { bg: "#09090F", card: "#0D0D18", purple: "#AA33FF", border: "#1a1a2e", gray: "#888" };

function ConvDetail({ conv, user, onBack }: { conv: any; user: any; onBack: () => void }) {
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => api(`/conversations/${conv.id}/messages`).then(r => setMsgs(r.messages || r)).catch(() => {});
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [conv.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send() {
    if (!text.trim()) return;
    const t = text; setText("");
    await api(`/conversations/${conv.id}/messages`, { method: "POST", body: JSON.stringify({ content: t }) });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg }}>
      <div style={{ padding: "14px 16px", background: C.card, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#fff", fontSize: 22 }}>←</button>
        <span style={{ fontWeight: 700 }}>{conv.otherUser?.name || "محادثة"}</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {msgs.map(m => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.senderId === user.id ? "flex-start" : "flex-end" }}>
            <div style={{ maxWidth: "75%", padding: "10px 14px", background: m.senderId === user.id ? C.purple : C.card, borderRadius: 16, fontSize: 14, lineHeight: 1.5 }}>
              {m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: 12, background: C.card, borderTop: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="اكتب رسالة..."
          style={{ flex: 1, padding: "10px 14px", background: "#1a1a2e", border: "none", borderRadius: 24, color: "#fff", fontSize: 14 }} />
        <button onClick={send} style={{ padding: "10px 18px", background: C.purple, border: "none", borderRadius: 24, color: "#fff", fontWeight: 700 }}>إرسال</button>
      </div>
    </div>
  );
}

export default function ChatPage({ user }: { user: any }) {
  const [convs, setConvs] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    api("/conversations").then(r => setConvs(r.conversations || r)).catch(() => {});
  }, []);

  if (selected) return <ConvDetail conv={selected} user={user} onBack={() => setSelected(null)} />;

  return (
    <div style={{ background: C.bg, minHeight: "100%", padding: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>المحادثات</h2>
      {convs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: C.gray }}>لا توجد محادثات بعد</div>
      ) : convs.map(c => (
        <div key={c.id} onClick={() => setSelected(c)}
          style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 10, cursor: "pointer", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.purple, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>
            {(c.otherUser?.name || "؟")[0]}
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>{c.otherUser?.name || "مستخدم"}</p>
            <p style={{ color: C.gray, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.lastMessage || "لا توجد رسائل"}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
