/**
 * Smart Engagement Boost
 * Adds deterministic fake engagement numbers + user lists on top of real data.
 * Same post ID + same creation time = same results every time (no flickering).
 *
 * Comments are context-aware: detected from video caption into one of three
 * categories (store / comedy / entertainment) and written in Hassaniya +
 * Algerian dialect.
 */

// ── أسماء موريتانية أصيلة — رجال ونساء ────────────────────────────────────
const ARABIC_NAMES = [
  // رجال موريتانيون
  "محمد ولد أحمد","محمدن ولد إبراهيم","سيدي ولد محمد","الطيب ولد سيدينا",
  "حمدي ولد سالم","بوبكر ولد الشيخ","لمرابط ولد ببكر","اعل ولد عبد الله",
  "المختار ولد يحيى","محمود ولد أحمد ييره","السالك ولد عمر","صالح ولد اميجن",
  "يحيى ولد داهي","شيخنا ولد محمد الأمين","عبد الرحمن ولد حمود","حبيب الله ولد الشيخ",
  "باب ولد المختار","اعمر ولد الطالب","الولي ولد ابراهيم","حمدو ولد اعمر",
  "إسماعيل ولد محمد","بكار ولد سيدي","ميلود ولد امبارك","لمين ولد المختار",
  "موسى ولد حامد","عثمان ولد يحيى","تفاضل ولد سيد أحمد","قيدي ولد أحمد",
  // نساء موريتانيات
  "فاطمة بنت محمد","آمنة بنت الشيخ","مريم بنت سيدي","زينب بنت أحمد",
  "خديجة بنت المختار","مبروكة بنت اعمر","الشيخة بنت سيدينا","ميمونة بنت الطالب",
  "سلمى بنت إبراهيم","تكبر بنت محمد","جميلة بنت ببكر","حبيبة بنت حمود",
  "المباركة بنت محمدن","نجاة بنت الولي","رقية بنت الشيخنا","كلثوم بنت سالم",
  "أسماء بنت موسى","فاطمة الزهراء بنت باب","مولاتي بنت لمرابط","عيشة بنت اعل",
  "زهرة بنت عبد الرحمن","سعيدة بنت المختار","مباركة بنت ابراهيم","بتول بنت يحيى",
];

const AVATAR_COLORS = [
  "#7c3aed","#2563eb","#db2777","#059669","#d97706",
  "#dc2626","#0891b2","#65a30d","#9333ea","#ea580c",
];

// ── Comment pools per video category ────────────────────────────────────────

/** تعليقات فيديوهات المتجر والبيع — لهجة حسانية وجزائرية */
const COMMENTS_STORE = [
  "يخي شين والله، كيفاش نتواصل؟ 🔥",
  "واه والله سلعة الزين، ربي يبارك في تجارتك",
  "بكاش هذا؟ عجبني بيظ يا صاحبي",
  "كيفاش نطلب؟ السلعة شين واه 🙏",
  "اگاع شين، من وين تجيب هذا؟",
  "الجودة واضحة، ما هو نظامي 💯",
  "والله سعر الزين، الله يعاونك",
  "ربي يبارك، هذاك هو اللي ندور عليه",
  "يخي يهبل! السعر والجودة معاً 🔥",
  "شين بيظ، ربي يسهّل عليك",
  "عجبني التصميم بيظ، تواصلت معك",
  "والله ما شفت حاجة أحسن من هذا",
  "اگاع كبير المشروع، الله يوفقك",
  "هذا اللي كنا ندورو عليه بالضبط",
  "ربي يزيدك وما يحوجك 🙏",
  "الجودة واضحة والسعر يناسب، بارك الله فيك",
  "واه صح، هذاك هو 👌",
  "حاجة كبيرة والله، مبروك عليك",
  "شين المنتج بيظ، ربي يبارك لك",
  "اگاع قوي هذا 💪 الله يعاونك",
  "ما شاء الله، المنتج شين بيظ",
  "والله يهبل، كيفاش تتواصل معه؟",
  "ربي يعطيك الخير يا صاحبي",
  "هذاك المنتج اللي ندور عليه 🔥",
  "الله يبارك، شين ومناسب بيظ",
  "يخي ما هو نظامي هذا السعر 👍",
  "والله من غير كلام، منتج ممتاز",
  "سلعة من الدرجة الأولى، مبروك",
];

/** تعليقات فيديوهات الضحك والكوميدي — لهجة حسانية */
const COMMENTS_COMEDY = [
  "والله ضحّكتني بيظ 😂😂",
  "هههههه اگاع مضحك يا صاحبي",
  "قلبي وجعني من الضحك 😂",
  "والله ما توقعت هذا آخر 😂",
  "يخي ما هو نظامي هذا الضحك 😂",
  "بكّاني من الضحك والله 😂",
  "واه اگاع كملي يا راجل 😂",
  "شي يقتل من الضحك هههه",
  "والله راجل كوميدي من الدرجة الأولى ✅",
  "الله يسعدك ضحّكتنا بيظ 😂",
  "هههه وين تلقى هؤلاء الناس؟ 😂",
  "والله ما قدرت نتوقف من الضحك",
  "يخي شي مضحك، الله يسعدك 😂",
  "اگاع مضحك، طلع روحه 😂",
  "هههههه الله يجازيك بالخير 😂",
  "ضحكت لما ما كنت ناوي 😂",
  "والله كوميدي من الطراز الأول",
  "يخي بنادم يموت من الضحك 😂",
  "واه فنان اگاع، الله يبارك فيك",
  "والله صح مضحك 😂😂😂",
  "هههه ما شفت مثل هذا من زمان",
  "الله يسعدك، ضحكتنا الله الله 😂",
  "واه كوميدي، شكراً على الضحكة 😂",
  "هههه يا ويل من يحاول يتوقف 😂",
  "والله صادق ما توقعت هذا آخر 😂",
];

/** تعليقات ترفيه عام — لهجة حسانية موريتانية */
const COMMENTS_ENTERTAINMENT = [
  "يخي شين، ربي يبارك فيك ✨",
  "ماشاء الله عليك، اگاع شين",
  "شين بيظ، الله يعطيك الصحة",
  "والله روعة، كمّل هكذا 💪",
  "شي يعجب والله، ربي يسعدك",
  "اگاع قوي هذا 🔥",
  "الله يوفقك، واه ممتاز",
  "والله ما شفت حاجة أحسن",
  "يخي ما هو نظامي هذا، مبروك عليك 🔥",
  "حاجة كبيرة والله، تسلم",
  "هذاك هو، والله يهبل",
  "اگاع ممتاز، ربي يزيدك",
  "الله يعطيك العافية، شي شين",
  "ربي يبارك فيك، اگاع شين",
  "والله صح، هذاك المحتوى اللي ندور عليه",
  "شي كبير والله 💯",
  "ماشاء الله، تبارك الله عليك",
  "اگاع قوي، كمّل ما تقف 💪",
  "والله من غير كلام، ممتاز",
  "واه شين هذا، ربي يسعدك ✨",
  "الله الله، شين بيظ",
  "تبارك الله، حاجة كبيرة",
  "والله يهبل هذا المحتوى 🔥",
  "ربي يعطيك ما تتمنى",
  "شين بيظ، الله يبارك لك",
  "روعة والله، هذاك هو 👏",
  "يخي نادر تلقاه هكذا، ممتاز",
  "الله يوفقك ويسعدك دايمن ✨",
  "واه شين، تسلم يدك",
  "والله ما قصّرت، اگاع قوي",
];

// ── Category detection from video caption ───────────────────────────────────

type VideoCategory = "store" | "comedy" | "entertainment";

const STORE_KEYWORDS = [
  "بيع","للبيع","متجر","منتج","سعر","ريال","دج","دينار","درهم",
  "تواصل","اطلب","خصم","عرض","توصيل","جملة","سلعة","بضاعة",
  "مستعمل","جديد","موديل","مقاس","لون","قطعة","حجز","شراء",
  "يبيع","نبيع","عندي","عندنا","متاح","متوفر","stock","كمية",
];

const COMEDY_KEYWORDS = [
  "ضحك","كوميدي","مضحك","نكتة","فكاهة","طريف","يضحك","مزح",
  "فنان","تمثيل","ههه","هههه","😂","🤣","خرافة","واجد فكيه",
  "كلاكيت","سكيت","sketch","comedy","تياترو",
];

function detectCategory(caption: string | null | undefined): VideoCategory {
  if (!caption) return "entertainment";
  const t = caption.toLowerCase();
  if (STORE_KEYWORDS.some(w => t.includes(w))) return "store";
  if (COMEDY_KEYWORDS.some(w => t.includes(w))) return "comedy";
  return "entertainment";
}

function getCommentPool(category: VideoCategory): string[] {
  if (category === "store") return COMMENTS_STORE;
  if (category === "comedy") return COMMENTS_COMEDY;
  return COMMENTS_ENTERTAINMENT;
}

// ── Core math helpers ────────────────────────────────────────────────────────

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
 * Growth factor 0→1 based on post age (للمشاهدات والإعجابات — بطيء).
 * بعد ساعة    ≈ 9%  | بعد 6 ساعات ≈ 45% | بعد 24 ساعة ≈ 91%
 */
function growth(createdAt: Date): number {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  return 1 - Math.exp(-ageHours / 10);
}

/**
 * Growth factor للتعليقات — سريع يبدأ بالدقائق (متزامن مع الإشعارات).
 * بعد 2  دقيقة  ≈ 22%  → 2-6   تعليقات
 * بعد 5  دقائق  ≈ 46%  → 4-13  تعليقات
 * بعد 10 دقائق  ≈ 71%  → 7-20  تعليقات
 * بعد 18 دقيقة  ≈ 89%  → 9-25  تعليقات
 * بعد 60 دقيقة  ≈ 99%  → كامل الـ boost
 */
function commentGrowth(createdAt: Date): number {
  const ageMinutes = (Date.now() - new Date(createdAt).getTime()) / 60_000;
  return 1 - Math.exp(-ageMinutes / 8);
}

// ── Engagement boosts ────────────────────────────────────────────────────────

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

// ── Fake user list builder ───────────────────────────────────────────────────

/**
 * Picks a realistic-looking avatar URL (or null for initials).
 * Distribution mirrors real Arabic social-media usage:
 *   ~30% no photo  → null (colored initials — very common)
 *   ~35% face photo → pravatar.cc  (real human photos 1-70)
 *   ~35% lifestyle  → picsum.photos (real Unsplash photos:
 *        architecture / children / products / nature —
 *        some IDs reliably contain mosques, markets, families)
 */
// ── صور بروفايل موريتانية حقيقية ─────────────────────────────────────────────

/** صور رجال موريتانيين حقيقيين — Wikimedia Commons (CC) */
const MAURITANIAN_MEN_AVATARS = [
  "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Chinguetti-Guide.JPG/250px-Chinguetti-Guide.JPG",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Nouakchott_Beach_Portrait_%2817638535788%29.jpg/250px-Nouakchott_Beach_Portrait_%2817638535788%29.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Nouakchott_Street_Portrait_%2817086858110%29.jpg/250px-Nouakchott_Street_Portrait_%2817086858110%29.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/2/2a/Mauritania-aziz-in-his-home-city-Akjoujt-15mar09_1.jpg",
];

/** صور نساء موريتانيات حقيقيات — Wikimedia Commons (CC) */
const MAURITANIAN_WOMEN_AVATARS = [
  "https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/A_big_smile_from_Mauretania.jpg/250px-A_big_smile_from_Mauretania.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Adrar-Mother%26daughter.JPG/250px-Adrar-Mother%26daughter.JPG",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Young_girl_in_Mauritania.jpg/250px-Young_girl_in_Mauritania.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Girl_from_Mauritania.jpg/250px-Girl_from_Mauritania.jpg",
];

/** ألوان خلفية ui-avatars (fallback) */
const UI_AVATAR_BG = [
  "1a73e8","e53935","00897b","f4511e","8e24aa",
  "039be5","43a047","fb8c00","6d4c41","546e7a",
];

/**
 * يختار صورة بروفايل:
 *  ~60% صورة موريتانية حقيقية (رجال/نساء حسب الاسم)
 *  ~25% ui-avatars حرف عربي ملوّن
 *  ~15% null → التطبيق يعرض الحرف الأول بلون
 */
function pickAvatar(seed: number, name: string): string | null {
  const bucket = seed % 100;
  if (bucket < 15) return null;
  const isFemale = name.includes("بنت");
  const pool = isFemale ? MAURITANIAN_WOMEN_AVATARS : MAURITANIAN_MEN_AVATARS;
  if (bucket < 75) {
    return pool[seed % pool.length]!;
  }
  const bg  = UI_AVATAR_BG[seed % UI_AVATAR_BG.length]!;
  const enc = encodeURIComponent(name.slice(0, 8));
  return `https://ui-avatars.com/api/?name=${enc}&background=${bg}&color=fff&size=100&bold=true&font-size=0.45`;
}

/** Generate N deterministic fake users from a seeded PRNG state */
function buildFakeUsers(count: number, seed0: number, createdAt: Date) {
  const users: { id: string; name: string; avatar: string | null; color: string }[] = [];
  let s = seed0;
  const usedNames = new Set<number>();

  for (let i = 0; i < count; i++) {
    const r1 = lcgRand(s);
    const r2 = lcgRand(r1.next);
    const r3 = lcgRand(r2.next);
    s = r3.next;

    const nameIdx = Math.floor(r1.val * ARABIC_NAMES.length) % ARABIC_NAMES.length;
    const finalIdx = usedNames.has(nameIdx)
      ? (nameIdx + 1) % ARABIC_NAMES.length
      : nameIdx;
    usedNames.add(finalIdx);

    // Deterministic avatar: Arabic initials via ui-avatars or null
    const avatarSeed = Math.floor(r2.val * 10000);
    const avatar = pickAvatar(avatarSeed, ARABIC_NAMES[finalIdx]!);

    users.push({
      id: `fake-${seed0}-${i}`,
      name: ARABIC_NAMES[finalIdx]!,
      avatar,
      color: AVATAR_COLORS[Math.floor(r3.val * AVATAR_COLORS.length) % AVATAR_COLORS.length]!,
    });
  }
  return users;
}

// ── Fake notification comments picker ───────────────────────────────────────

/**
 * يختار N تعليق وهمي من pool المناسبة للـ caption لإرسالها كإشعارات.
 * النتيجة عشوائية حقيقية (Math.random) لتبدو مختلفة في كل مرة.
 */
export function pickFakeNotificationComments(
  _videoId: string,
  caption: string | null | undefined,
  count: number,
): { text: string; userName: string }[] {
  const pool = getCommentPool(detectCategory(caption));
  const names = [...ARABIC_NAMES].sort(() => Math.random() - 0.5);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const results: { text: string; userName: string }[] = [];
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    results.push({
      text: shuffled[i % shuffled.length]!,
      userName: names[i % names.length]!,
    });
  }
  return results;
}

// ── Public fake list functions ───────────────────────────────────────────────

/**
 * Returns fake viewer list for a story.
 * Count is capped at min(viewBoost, 50) so the panel doesn't overflow.
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

/**
 * Returns smart fake comments for a video.
 * - Detects video type (store / comedy / entertainment) from caption keywords
 * - Uses the matching Hassaniya+Algerian comment pool
 * - Caps display at 30 comments
 * - Comments are deterministic: same video → same comments every time
 */
export function fakeVideoComments(
  id: string,
  createdAt: Date,
  caption: string | null | undefined,
  realComments: { id: string; text: string; createdAt: Date | string; userId: string; userName: string; userAvatar: string | null; userRole: string }[],
  aiComments: { text: string; userName: string }[] = [],
) {
  // عدد التعليقات يعتمد على commentGrowth (سريع، دقائق) لا growth (ساعات)
  const s0base = hashId(id);
  const rBase = lcgRand(lcgRand(lcgRand(s0base).next).next);
  const maxComments = Math.round((10 + rBase.val * 20) * commentGrowth(createdAt));
  const fakeCount = Math.max(0, maxComments - realComments.length);
  const displayCount = Math.min(fakeCount, 30);
  if (displayCount === 0) return realComments;

  // اختر المصدر: AI أولاً، وإلا القوائم الثابتة كـ fallback
  const useAi = aiComments.length >= 5;
  const pool = useAi
    ? aiComments.map((c) => c.text)
    : getCommentPool(detectCategory(caption));

  // استخدم أسماء AI إذا توفرت، وإلا أسماء عشوائية
  const aiNamePool = useAi ? aiComments.map((c) => c.userName) : null;

  const s0 = (hashId(id) ^ 0x1357cafe) >>> 0;
  const fakeUsers = buildFakeUsers(displayCount, s0, createdAt);
  const postTime = new Date(createdAt).getTime();
  const span = Date.now() - postTime;

  let commentSeed = s0;
  const fakeEntries = fakeUsers.map((u, i) => {
    const rc = lcgRand(commentSeed);
    commentSeed = rc.next;
    const commentIdx = Math.floor(rc.val * pool.length) % pool.length;

    let userName = u.name;
    if (aiNamePool && aiNamePool.length > 0) {
      const nameIdx = Math.floor(rc.val * aiNamePool.length) % aiNamePool.length;
      userName = aiNamePool[nameIdx] ?? u.name;
    }

    return {
      id: `fake-c-${s0}-${i}`,
      text: pool[commentIdx]!,
      createdAt: new Date(Date.now() - Math.round((i / displayCount) * span * 0.85)).toISOString(),
      userId: u.id,
      userName,
      userAvatar: u.avatar,
      userRole: "user",
    };
  });

  return [...fakeEntries, ...realComments];
}
