import React, { useState } from "react";
import { api, setToken } from "../api";

const C = { bg: "#09090F", card: "#0D0D18", purple: "#AA33FF", border: "#1a1a2e", gray: "#888" };

export default function LoginPage({ onLogin }: { onLogin: (u: any) => void }) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendOtp() {
    if (!phone.trim()) return;
    setLoading(true); setError("");
    try {
      await api("/auth/otp/send", { method: "POST", body: JSON.stringify({ phone: phone.trim() }) });
      setStep("otp");
    } catch (e: any) { setError(e.message || "حدث خطأ"); }
    finally { setLoading(false); }
  }

  async function verifyOtp() {
    if (!otp.trim()) return;
    setLoading(true); setError("");
    try {
      const res = await api("/auth/otp/verify", { method: "POST", body: JSON.stringify({ phone: phone.trim(), code: otp.trim() }) });
      setToken(res.token);
      onLogin(res.user);
    } catch (e: any) { setError(e.message || "رمز غير صحيح"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>⬡</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: C.purple }}>Gaytak</h1>
          <p style={{ color: C.gray, marginTop: 8 }}>سوق الجزائر الإلكتروني</p>
        </div>

        {step === "phone" ? (
          <>
            <p style={{ marginBottom: 12, color: C.gray, fontSize: 14 }}>أدخل رقم هاتفك</p>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+213xxxxxxxxx"
              style={{ width: "100%", padding: "14px 16px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, color: "#fff", fontSize: 16, marginBottom: 16, direction: "ltr", textAlign: "left" }} />
            <button onClick={sendOtp} disabled={loading}
              style={{ width: "100%", padding: 16, background: C.purple, border: "none", borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700 }}>
              {loading ? "جاري الإرسال..." : "إرسال رمز التحقق عبر واتساب"}
            </button>
          </>
        ) : (
          <>
            <p style={{ marginBottom: 12, color: C.gray, fontSize: 14 }}>أدخل الرمز المرسل إلى {phone}</p>
            <input value={otp} onChange={e => setOtp(e.target.value)} placeholder="رمز التحقق"
              maxLength={6} style={{ width: "100%", padding: "14px 16px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, color: "#fff", fontSize: 20, marginBottom: 16, textAlign: "center", letterSpacing: 8 }} />
            <button onClick={verifyOtp} disabled={loading}
              style={{ width: "100%", padding: 16, background: C.purple, border: "none", borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              {loading ? "جاري التحقق..." : "تأكيد"}
            </button>
            <button onClick={() => setStep("phone")} style={{ width: "100%", padding: 12, background: "none", border: `1px solid ${C.border}`, borderRadius: 12, color: C.gray, fontSize: 14 }}>
              تغيير الرقم
            </button>
          </>
        )}
        {error && <p style={{ color: "#ff4444", marginTop: 12, textAlign: "center", fontSize: 14 }}>{error}</p>}
      </div>
    </div>
  );
}
