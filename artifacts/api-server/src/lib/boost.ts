/**
 * Smart Engagement Boost
 * Adds deterministic fake engagement numbers + user lists on top of real data.
 * Same post ID + same creation time = same results every time (no flickering).
 */

const ARABIC_NAMES = [
  "أحمد محمد","فاطمة علي","عبدالله سالم","نورة خالد","محمد إبراهيم",
  "سارة أحمد","خالد عبدالله","مريم يوسف","عمر حسن","هنوف ناصر",
  "يوسف عمر","لمياء سعد","سلطان فهد","ريم محمد","بدر العتيبي",
  "دانة الشمري","تركي الحربي","غدير الزهراني","وليد المطيري","شهد الغامدي",
  "فيصل القحطاني","أسماء العمري","جاسم السبيعي","منى الرشيدي","راشد الدوسري",
  "هيا البقمي","عبدالعزيز الحميد","رهف الأحمدي","ماجد المالكي","سلمى الحربي",
  "نايف العنزي","أميرة الشهري","صالح الرويلي","لينا الجهني","حمد الرشيد",
  "نوف القرني","طارق الزهراني","ميساء العتيبي","سعود الشمراني","جواهر الحميد",
  "عبدالرحمن الغامدي","رنا العسيري","بندر المالكي","هديل الشهري","ياسر الحربي",
  "بسمة العمري","خالد الدوسري","وفاء السبيعي","فهد الرشيدي","أريج المطيري",
];

const AVATAR_COLORS = [
  "#7c3aed","#2563eb","#db2777","#059669","#d97706",
  "#dc2626","#0891b2","#65a30d","#9333ea","#ea580c",
];

function hashId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = (((h << 5) + h) ^ id.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

function lcgRand(seed: number): { val: number; next: number } {
  const next = ((seed * 1664525 + 1013904223) >>> 0);
  return { val: next / 4294967296, next };
}

/**
 * Growth factor 0.5→1 based on post age.
 * Starts at 50% immediately, plateaus at 100% by ~48h.
 */
function growth(createdAt: Date): number {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  return 0.5 + 0.5 * (1 - Math.exp(-ageHours / 6));
}

/**
 * Story boost:
 *  - views: 100–300
 *  - likes: 5–50 hearts
 */
export function storyBoost(id: string, createdAt: Date) {
  const s0 = hashId(id);
  const r1 = lcgRand(s0);
  const r2 = lcgRand(r1.next);
  const g = growth(createdAt);
  return {
    viewBoost: Math.round((100 + r1.val * 200) * g),
    likeBoost: Math.round((5 + r2.val * 45) * g),
  };
}

/**
 * Content/Video boost:
 *  - views:    500–15 000
 *  - likes:    50–3 000
 *  - comments: 10–500
 */
export function contentBoost(id: string, createdAt: Date) {
  const s0 = hashId(id);
  const r1 = lcgRand(s0);
  const r2 = lcgRand(r1.next);
  const r3 = lcgRand(r2.next);
  const g = growth(createdAt);
  return {
    viewBoost: Math.round((500 + r1.val * 14_500) * g),
    likeBoost: Math.round((50 + r2.val * 2_950) * g),
    commentBoost: Math.round((10 + r3.val * 490) * g),
  };
}

/** Generate N deterministic fake users from a seeded PRNG state */
function buildFakeUsers(count: number, seed0: number, createdAt: Date) {
  const users: { id: string; name: string; avatar: string | null; color: string }[] = [];
  let s = seed0;
  const usedNames = new Set<number>();
  const now = Date.now();
  const postTime = new Date(createdAt).getTime();

  for (let i = 0; i < count; i++) {
    const r1 = lcgRand(s);
    const r2 = lcgRand(r1.next);
    const r3 = lcgRand(r2.next);
    s = r3.next;

    const nameIdx = Math.floor(r1.val * ARABIC_NAMES.length) % ARABIC_NAMES.length;
    // avoid duplicate names when possible
    const finalIdx = usedNames.has(nameIdx)
      ? (nameIdx + 1) % ARABIC_NAMES.length
      : nameIdx;
    usedNames.add(finalIdx);

    users.push({
      id: `fake-${seed0}-${i}`,
      name: ARABIC_NAMES[finalIdx]!,
      avatar: null,
      color: AVATAR_COLORS[Math.floor(r3.val * AVATAR_COLORS.length) % AVATAR_COLORS.length]!,
    });
  }
  return users;
}

/**
 * Returns fake viewer list for a story.
 * Count is capped at min(viewBoost, 50) so the panel doesn't overflow.
 * Timestamps are spread backwards from "now" across the story's life.
 */
export function fakeStoryViewers(
  id: string,
  createdAt: Date,
  realViewers: { id: string; name: string; avatar: string | null; viewedAt: Date | string }[],
) {
  const boost = storyBoost(id, createdAt);
  const fakeCount = Math.max(0, boost.viewBoost - realViewers.length);
  const displayCount = Math.min(fakeCount, 50);
  if (displayCount === 0) return realViewers;

  const s0 = (hashId(id) ^ 0xabcd1234) >>> 0;
  const fakeUsers = buildFakeUsers(displayCount, s0, createdAt);
  const postTime = new Date(createdAt).getTime();
  const span = Date.now() - postTime;

  const fakeEntries = fakeUsers.map((u, i) => ({
    id: u.id,
    name: u.name,
    avatar: u.avatar,
    color: u.color,
    viewedAt: new Date(Date.now() - Math.round((i / displayCount) * span * 0.9)),
  }));

  return [...realViewers, ...fakeEntries];
}

/**
 * Returns fake liker list for a story.
 * Count is capped at min(likeBoost, 30).
 */
export function fakeStoryLikers(
  id: string,
  createdAt: Date,
  realLikers: { id: string; name: string; avatar: string | null; likedAt: Date | string }[],
) {
  const boost = storyBoost(id, createdAt);
  const fakeCount = Math.max(0, boost.likeBoost - realLikers.length);
  const displayCount = Math.min(fakeCount, 30);
  if (displayCount === 0) return realLikers;

  const s0 = (hashId(id) ^ 0xface5678) >>> 0;
  const fakeUsers = buildFakeUsers(displayCount, s0, createdAt);
  const postTime = new Date(createdAt).getTime();
  const span = Date.now() - postTime;

  const fakeEntries = fakeUsers.map((u, i) => ({
    id: u.id,
    name: u.name,
    avatar: u.avatar,
    color: u.color,
    likedAt: new Date(Date.now() - Math.round((i / displayCount) * span * 0.9)),
  }));

  return [...realLikers, ...fakeEntries];
}
