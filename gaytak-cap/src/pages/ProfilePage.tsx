import React, { useState, useEffect } from "react";
import { api } from "../api";

const C = { bg: "#09090F", card: "#0D0D18", purple: "#AA33FF", border: "#1a1a2e", gray: "#888", red: "#FF3366" };

export default function ProfilePage({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    api("/products?mine=true").then(r => setProducts(r.products || r)).catch(() => {});
  }, []);

  return (
    <div style={{ background: C.bg, minHeight: "100%", padding: 20 }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: C.purple, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 800, margin: "0 auto 12px" }}>
          {user.name?.[0] || "؟"}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>{user.name}</h2>
        <p style={{ color: C.gray, fontSize: 14, marginTop: 4 }}>{user.phone}</p>
      </div>

      <div style={{ background: C.card, borderRadius: 16, padding: 16, marginBottom: 20, border: `1px solid ${C.border}` }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>إعلاناتي ({products.length})</h3>
        {products.length === 0 ? (
          <p style={{ color: C.gray, fontSize: 14 }}>لا توجد إعلانات بعد</p>
        ) : products.map(p => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
            {p.images?.[0] ? <img src={p.images[0]} alt="" style={{ width: 50, height: 50, borderRadius: 8, objectFit: "cover" }} /> :
              <div style={{ width: 50, height: 50, borderRadius: 8, background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center" }}>📦</div>}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600 }}>{p.title}</p>
              <p style={{ color: C.purple, fontSize: 13 }}>{p.price} دج</p>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => { if (confirm("هل تريد تسجيل الخروج؟")) onLogout(); }}
        style={{ width: "100%", padding: 14, background: "none", border: `1px solid ${C.red}`, borderRadius: 12, color: C.red, fontSize: 15, fontWeight: 600 }}>
        تسجيل الخروج
      </button>
    </div>
  );
}
