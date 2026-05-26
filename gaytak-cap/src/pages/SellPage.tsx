import React, { useState } from "react";
import { api, API, getToken } from "../api";

const C = { bg: "#09090F", card: "#0D0D18", purple: "#AA33FF", border: "#1a1a2e", gray: "#888" };

const WILAYAS = ["الجزائر","وهران","قسنطينة","عنابة","باتنة","سطيف","تلمسان","بجاية","بسكرة","تيزي وزو","المدية","البليدة","الشلف","الأغواط","أم البواقي","باتنة","بجاية","بسكرة","بشار","البليدة","البويرة","تمنراست","تبسة","تلمسان","تيارت","تيزي وزو","الجزائر","الجلفة","جيجل","سطيف","سعيدة","سكيكدة","سيدي بلعباس","عنابة","قالمة","قسنطينة","المدية","مستغانم","المسيلة","معسكر","ورقلة","وهران","البيض","إليزي","برج بوعريريج","بومرداس","الطارف","تندوف","تيسمسيلت","الوادي","خنشلة","سوق أهراس","تيبازة","ميلة","عين الدفلى","النعامة","عين تيموشنت","غرداية","الرليزان","تيميمون","برج باجي مختار","أولاد جلال","بني عباس","عين صالح","عين قزام","تقرت","جانت","المغير","المنيعة"];

export default function SellPage({ user, onDone }: { user: any; onDone: () => void }) {
  const [form, setForm] = useState({ title: "", description: "", price: "", wilaya: "الجزائر", category: "إلكترونيات" });
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function pickImage() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      const fd = new FormData(); fd.append("image", file);
      try {
        const res = await fetch(`${API}/upload`, { method: "POST", headers: { Authorization: "Bearer " + getToken() }, body: fd });
        const data = await res.json();
        setImages(prev => [...prev, data.url].slice(0, 4));
      } catch {}
    };
    input.click();
  }

  async function submit() {
    if (!form.title || !form.price) { setError("أدخل العنوان والسعر"); return; }
    setLoading(true); setError("");
    try {
      await api("/products", { method: "POST", body: JSON.stringify({ ...form, price: Number(form.price), images }) });
      alert("تم نشر الإعلان بنجاح!");
      onDone();
    } catch (e: any) { setError(e.message || "حدث خطأ"); }
    finally { setLoading(false); }
  }

  const inp = (label: string, key: string, placeholder = "", type = "text") => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 13, color: C.gray, marginBottom: 6, display: "block" }}>{label}</label>
      <input value={(form as any)[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} type={type}
        style={{ width: "100%", padding: "12px 14px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, color: "#fff", fontSize: 15 }} />
    </div>
  );

  return (
    <div style={{ background: C.bg, minHeight: "100%", padding: 16, paddingBottom: 30 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>أضف إعلاناً</h2>

      {inp("عنوان الإعلان", "title", "مثال: هاتف سامسونج")}
      {inp("السعر (دج)", "price", "0", "number")}

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: C.gray, marginBottom: 6, display: "block" }}>الولاية</label>
        <select value={form.wilaya} onChange={e => set("wilaya", e.target.value)}
          style={{ width: "100%", padding: "12px 14px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, color: "#fff", fontSize: 15 }}>
          {WILAYAS.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: C.gray, marginBottom: 6, display: "block" }}>الوصف</label>
        <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={4} placeholder="اوصف منتجك..."
          style={{ width: "100%", padding: "12px 14px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, color: "#fff", fontSize: 15, resize: "none" }} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, color: C.gray, marginBottom: 8, display: "block" }}>الصور</label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {images.map((img, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img src={img} alt="" style={{ width: 80, height: 80, borderRadius: 10, objectFit: "cover" }} />
              <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                style={{ position: "absolute", top: -8, right: -8, background: "#ff4444", border: "none", borderRadius: "50%", width: 22, height: 22, color: "#fff", fontSize: 14 }}>×</button>
            </div>
          ))}
          {images.length < 4 && (
            <button onClick={pickImage} style={{ width: 80, height: 80, background: C.card, border: `2px dashed ${C.border}`, borderRadius: 10, color: C.gray, fontSize: 28 }}>+</button>
          )}
        </div>
      </div>

      {error && <p style={{ color: "#ff4444", marginBottom: 12, fontSize: 14 }}>{error}</p>}
      <button onClick={submit} disabled={loading}
        style={{ width: "100%", padding: 16, background: C.purple, border: "none", borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700 }}>
        {loading ? "جاري النشر..." : "نشر الإعلان"}
      </button>
    </div>
  );
}
