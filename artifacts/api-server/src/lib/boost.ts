/**
 * Smart Engagement Boost
 * Adds deterministic fake engagement numbers on top of real counts.
 * Same post ID + same creation time = same boost every time (no flickering).
 */

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
 * This ensures even brand-new posts show decent engagement.
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
