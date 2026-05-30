import { useState, useEffect } from "react";

/**
 * عداد حي يبدأ من 0 ويصعد للرقم الحقيقي خلال ~800ms
 * ثم يزيد +1 كل `intervalSec` ثانية تلقائياً
 */
export function useLiveCount(target: number, intervalSec = 15): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (target <= 0) { setCount(0); return; }

    setCount(0);

    // عدد الخطوات ثابت (40 خطوة) بغض النظر عن حجم الرقم
    const STEPS = Math.min(target, 40);
    const stepValue = target / STEPS;         // القفزة في كل خطوة
    const stepMs   = 800 / STEPS;            // الوقت بين كل خطوة (~800ms الكل)

    let step = 0;
    const animTimer = setInterval(() => {
      step++;
      if (step >= STEPS) {
        setCount(target);
        clearInterval(animTimer);
      } else {
        setCount(Math.round(stepValue * step));
      }
    }, stepMs);

    // بعد انتهاء الـ animation → +1 كل intervalSec ثانية
    const liveTimer = setInterval(() => {
      setCount((c) => c + 1);
    }, intervalSec * 1000);

    return () => {
      clearInterval(animTimer);
      clearInterval(liveTimer);
    };
  }, [target, intervalSec]);

  return count;
}
