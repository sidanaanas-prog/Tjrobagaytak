import { useState, useEffect } from "react";

/**
 * عداد حي يُحاكي المشاهدات الحقيقية:
 * ١) animation صعود تدريجي من قريب التارقت عند الظهور (~600ms)
 * ٢) يزيد +1 كل `intervalSec` ثانية تلقائياً
 */
export function useLiveCount(target: number, intervalSec = 15): number {
  const [count, setCount] = useState<number>(() => Math.max(0, target - getStartOffset(target)));

  useEffect(() => {
    if (target <= 0) { setCount(0); return; }

    const offset = getStartOffset(target);
    const start = Math.max(0, target - offset);
    setCount(start);

    let cur = start;
    const steps = target - start;

    if (steps > 0) {
      const stepMs = Math.max(20, 700 / steps);
      const animTimer = setInterval(() => {
        cur++;
        setCount(cur);
        if (cur >= target) clearInterval(animTimer);
      }, stepMs);

      // بعد انتهاء الـ animation → نبدأ الزيادة الحية
      const liveTimer = setInterval(() => {
        setCount((c) => c + 1);
      }, intervalSec * 1000);

      return () => {
        clearInterval(animTimer);
        clearInterval(liveTimer);
      };
    }

    // لا animation مطلوبة (صفر أو واحد) → مباشرة للزيادة الحية
    setCount(target);
    const liveTimer = setInterval(() => setCount((c) => c + 1), intervalSec * 1000);
    return () => clearInterval(liveTimer);
  }, [target, intervalSec]);

  return count;
}

/** كم خطوة نرجع للخلف قبل الصعود — يُقاس حسب حجم الرقم */
function getStartOffset(n: number): number {
  if (n <= 10)   return n;          // من الصفر
  if (n <= 100)  return 15;
  if (n <= 1000) return 25;
  return 40;                         // أرقام كبيرة: 40 خطوة آخر
}
