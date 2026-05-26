import React, { useState, useEffect } from "react";
import { api } from "../api";

const C = { bg: "#09090F", card: "#0D0D18", purple: "#AA33FF", border: "#1a1a2e", gray: "#888" };

function ProductCard({ p, onClick }: { p: any; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ background: C.card, borderRadius: 16, overflow: "hidden", cursor: "pointer", border: `1px solid ${C.border}` }}>
      {p.images?.[0] ? (
        <img src={p.images[0]} alt={p.title} style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />
      ) : (
        <div style={{ width: "100%", aspectRatio: "1", background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>📦</div>
      )}
      <div style={{ padding: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</p>
        <p style={{ color: C.purple, fontWeight: 800, fontSize: 14 }}>{p.price} دج</p>
        <p style={{ color: C.gray, fontSize: 11, marginTop: 2 }}>{p.wilaya}</p>
      </div>
    </div>
  );
}

function ProductDetail({ product, onBack }: { product: any; onBack: () => void }) {
  return (
    <div style={{ background: C.bg, minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "16px 16px 8px", gap: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#fff", fontSize: 24 }}>←</button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>{product.title}</h2>
      </div>
      {product.images?.[0] && <img src={product.images[0]} alt={product.title} style={{ width: "100%", maxHeight: 300, objectFit: "cover" }} />}
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ color: C.purple, fontSize: 24, fontWeight: 800 }}>{product.price} دج</span>
          <span style={{ color: C.gray, fontSize: 13 }}>{product.wilaya}</span>
        </div>
        <p style={{ color: "#ccc", lineHeight: 1.8, marginBottom: 20 }}>{product.description}</p>
        <a href={`https://wa.me/${product.seller?.phone?.replace(/\D/g, "")}`}
          style={{ display: "block", padding: 16, background: "#25D366", borderRadius: 14, textAlign: "center", fontWeight: 700, color: "#fff", fontSize: 16 }}>
          تواصل عبر واتساب
        </a>
      </div>
    </div>
  );
}

export default function HomePage({ user }: { user: any }) {
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/products").then(r => setProducts(r.products || r)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (selected) return <ProductDetail product={selected} onBack={() => setSelected(null)} />;

  const filtered = products.filter(p =>
    !search || p.title?.includes(search) || p.description?.includes(search)
  );

  return (
    <div style={{ background: C.bg, minHeight: "100%", paddingBottom: 20 }}>
      <div style={{ padding: "16px 16px 8px", background: C.bg, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.purple }}>⬡ جاتك</h1>
          <span style={{ color: C.gray, fontSize: 13 }}>مرحباً {user.name}</span>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  ابحث عن منتج..."
          style={{ width: "100%", padding: "12px 16px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, color: "#fff", fontSize: 14 }} />
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.gray }}>جاري التحميل...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "8px 16px" }}>
          {filtered.map(p => <ProductCard key={p.id} p={p} onClick={() => setSelected(p)} />)}
        </div>
      )}
    </div>
  );
}
