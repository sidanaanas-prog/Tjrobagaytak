import { createHash } from "crypto";

// ── Story Boost (fake engagement numbers) ───────────────────────────────────
export function storyBoost(storyId: string, createdAt: Date) {
  const ageMs = Date.now() - createdAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  const hash = createHash("sha256").update(storyId).digest("hex");
  const base = parseInt(hash.slice(0, 8), 16);
  // More views for older stories (up to 24h)
  const viewBoost = Math.min(50, Math.floor(ageHours * 2 + (base % 30)));
  const likeBoost = Math.min(15, Math.floor(ageHours * 0.5 + (base % 10)));
  return { viewBoost, likeBoost };
}

export function fakeStoryViewers(
  storyId: string,
  createdAt: Date,
  realViewers: any[],
): any[] {
  const hash = createHash("sha256").update(storyId + "viewers").digest("hex");
  const count = (parseInt(hash.slice(0, 4), 16) % 12) + 3;
  const fake = Array.from({ length: count }, (_, i) => {
    const names = [
      "أحمد",
      "محمد",
      "فاطمة",
      "سعاد",
      "نور",
      "كارم",
      "يوسف",
      "ريم",
      "ليلى",
      "سارة",
      "هودا",
      "ليان",
      "تقاء",
      "نواف",
      "أمجاد",
      "جمال",
      "فيصل",
      "أنوار",
      "راشد",
      "مجد",
      "ود",
      "بدوي",
      "نايف",
      "يازن",
    ];
    const name = names[(parseInt(hash.slice(4, 8), 16) + i) % names.length];
    return {
      id: `fake_${i}_${storyId.slice(0, 8)}`,
      name,
      avatar: null,
      viewedAt: new Date(createdAt.getTime() + 1000 * 60 * (i + 1)).toISOString(),
    };
  });
  return [...realViewers, ...fake];
}

export function fakeStoryLikers(
  storyId: string,
  createdAt: Date,
  realLikers: any[],
): any[] {
  const hash = createHash("sha256").update(storyId + "likers").digest("hex");
  const count = (parseInt(hash.slice(0, 4), 16) % 6) + 2;
  const fake = Array.from({ length: count }, (_, i) => {
    const names = [
      "محبوب",
      "غياث",
      "سعيد",
      "رانيا",
      "فيصل",
      "ليلى",
      "سارة",
      "تواء",
      "نايف",
      "الآساور",
      "راشد",
      "ماجد",
      "ود",
      "بدوي",
      "مهند",
    ];
    const name = names[(parseInt(hash.slice(4, 8), 16) + i) % names.length];
    return {
      id: `fake_${i}_${storyId.slice(0, 8)}`,
      name,
      avatar: null,
      likedAt: new Date(createdAt.getTime() + 1000 * 60 * (i + 2)).toISOString(),
    };
  });
  return [...realLikers, ...fake];
}
