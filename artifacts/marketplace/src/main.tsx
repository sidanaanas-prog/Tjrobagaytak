import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ✅ تعريف window.onNativeToken فوراً عند تحميل الصفحة
// freewebsitetoapp.com يستدعي هذه الدالة قبل تسجيل الدخول
// نحفظ التوكن في localStorage حتى يتم استخدامه لاحقاً عند تسجيل الدخول
(window as any).onNativeToken = (token: string) => {
  if (!token) return;
  console.log("[FCM] 📱 onNativeToken استُدعي مبكراً — حفظ مؤقت في localStorage");
  localStorage.setItem("pending_fcm_token", token);
};

createRoot(document.getElementById("root")!).render(<App />);
