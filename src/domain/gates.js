// Content safety gates — pure functions, enforced client-side before anything reaches a feed.
import { MAX_DURATION_SECONDS, MIN_VIEWS_FOR_DISCOVERY } from "./constants";
import { BLOCKED_KEYWORDS } from "../data/keywordBlocker";

export const durationGate = (durationSeconds, ageGroup) =>
  Number.isFinite(durationSeconds) &&
  durationSeconds > 0 &&
  durationSeconds <= MAX_DURATION_SECONDS[ageGroup];

export const discoveryViewGate = (viewCount) => Number.isFinite(viewCount) && viewCount >= MIN_VIEWS_FOR_DISCOVERY;

export const passesKeywordBlocker = (video) => {
  const text = `${video.title || ""} ${video.description || ""}`.toLowerCase();
  return !BLOCKED_KEYWORDS.some((keyword) => text.includes(keyword));
};

// Whitelist-sourced videos: duration + keyword gates (they come from trusted channels).
const TOO_OLD = /teen|teenager|dating|romance|horror|scary|nightmare|prank|challenge|fight|weapon|gun|blood/;
const TOO_YOUNG = /toddler|nursery rhyme|baby shark|cocomelon|peekaboo/;
const COMPLEX = /calculus|quantum|coding an ai|machine learning/;

export const ageContentGate = (video, ageGroup) => {
  const text = `${video.title || ""} ${video.description || ""}`.toLowerCase();
  if (!passesKeywordBlocker(video)) return false;
  if (ageGroup === "toddler_2_4" || ageGroup === "early_learner_5_7") {
    if (TOO_OLD.test(text) || COMPLEX.test(text)) return false;
  }
  if (ageGroup === "tween_8_12" || ageGroup === "teen_13_16") {
    if (TOO_YOUNG.test(text)) return false;
  }
  return true;
};

export const applyWhitelistGates = (videos, ageGroup) =>
  videos.filter((v) => durationGate(v.durationSeconds, ageGroup) && ageContentGate(v, ageGroup));

// Discovery-sourced videos: all three gates, including the 1M view gate.
export const applyDiscoveryGates = (videos, ageGroup) =>
  videos.filter(
    (v) => durationGate(v.durationSeconds, ageGroup) && discoveryViewGate(v.viewCount) && ageContentGate(v, ageGroup)
  );