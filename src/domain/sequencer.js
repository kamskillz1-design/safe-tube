// Feed sequencing engine — pure functions.
// Rules: calm-first ranking, strict category alternation (never two entertainment videos
// back-to-back), and the token economy (entertainment unlocks cost tokens).
import { CATEGORIES, EDUCATIONAL_CATEGORIES, ENTERTAINMENT_CATEGORY, TOKEN_RULES } from "./constants";

const CALM_KEYWORDS = [
  "song", "story", "stories", "slow", "gentle", "calm", "relax", "learn", "learning",
  "sing", "singing", "bedtime", "lullaby", "quiet", "nursery", "rhyme", "abc", "count",
  "counting", "read", "reading", "colors", "shapes", "explore", "how ", "why ", "for kids",
];

const STIMULATING_KEYWORDS = ["prank", "challenge", "gone wrong", "scary", "shock", "fast", "insane", "crazy", "epic"];

export function calmScore(video, level = "standard") {
  const title = (video.title || "").toLowerCase();
  let score = 0;
  CALM_KEYWORDS.forEach((k) => {
    if (title.includes(k)) score += 2;
  });
  STIMULATING_KEYWORDS.forEach((k) => {
    if (title.includes(k)) score -= 3;
  });
  if (level === "simpler") score += (600 - Math.min(video.durationSeconds, 600)) / 400; // favor shorter
  if (level === "richer") score += Math.min(video.durationSeconds, 1500) / 800; // favor fuller content
  return score;
}

export const rankCalmFirst = (videos, level = "standard") =>
  [...videos].sort((a, b) => calmScore(b, level) - calmScore(a, level));

// Builds the watch queue. Educational categories round-robin so STEM/Arts/EI interleave;
// an entertainment video may only appear when the previous pick was educational AND
// there are enough tokens to spend. Returns the queue plus the tokens spent on unlocks.
export function buildQueue(videos, tokenBalance, level = "standard", entertainmentCost = TOKEN_RULES.ENTERTAINMENT_COST) {
  // Calm-first ranking with a small random nudge (under the keyword step of 2),
  // so calm content still leads but the order differs between sessions.
  const pools = {};
  [ENTERTAINMENT_CATEGORY, ...EDUCATIONAL_CATEGORIES].forEach((category) => {
    pools[category] = videos
      .filter((v) => v.category === category)
      .map((v) => ({ v, s: calmScore(v, level) + Math.random() }))
      .sort((a, b) => b.s - a.s)
      .map(({ v }) => v);
  });

  // Category picks from the folder bar, and library rows with a new label,
  // must still be playable. Dropping them left the watch page blank.
  const known = new Set([ENTERTAINMENT_CATEGORY, ...EDUCATIONAL_CATEGORIES]);
  const unmatched = videos.filter((video) => !known.has(video.category));
  if (unmatched.length) {
    pools[CATEGORIES.STEM] = [...(pools[CATEGORIES.STEM] || []), ...unmatched];
  }

  const queue = [];
  const cursor = {};
  let tokens = tokenBalance;
  let tokensSpent = 0;
  let lastWasEntertainment = true; // feed opens with education
  let eduTurn = 0;

  const pick = (category) => {
    const pool = pools[category];
    const i = cursor[category] ?? 0;
    if (!pool || i >= pool.length) return null;
    cursor[category] = i + 1;
    return pool[i];
  };

  for (;;) {
    let next = null;
    if (!lastWasEntertainment && tokens >= entertainmentCost) {
      const fun = pick(ENTERTAINMENT_CATEGORY);
      if (fun) {
        tokens -= entertainmentCost;
        tokensSpent += entertainmentCost;
        next = fun;
        lastWasEntertainment = true;
      }
    }
    if (!next) {
      // try each educational category in round-robin until one has a video left
      for (let t = 0; t < EDUCATIONAL_CATEGORIES.length && !next; t += 1) {
        next = pick(EDUCATIONAL_CATEGORIES[(eduTurn + t) % EDUCATIONAL_CATEGORIES.length]);
        if (next) eduTurn += t + 1;
      }
      if (!next) break;
      lastWasEntertainment = false;
    }
    queue.push(next);
  }

  return { queue, tokensSpent };
}
