// Feed orchestration — library-first. Child feeds are built only from videos
// already stored in the SafeTube Video Library; the only YouTube calls happen
// inside the admin/parent-controlled refresh process (see library.js).
import { entertainmentCostFor } from "@/domain/constants";
import { buildQueue } from "@/domain/sequencer";
import { levelFromScore } from "@/domain/adaptive";
import { YoutubeApiError } from "@/adapters/youtubeClient";
import {
  ensureLibraryVideos,
  getLibraryVideosForProfile,
  importApprovedDiscovery,
  maybeAutoRefresh,
} from "@/app/library";
import { applyPreferences, loadPreferences } from "@/app/preferences";
import { searchVideos } from "@/adapters/youtubeClient";
import { putLibraryVideos } from "@/adapters/localDb";
import { applyWhitelistGates } from "@/domain/gates";
import { safeQuery } from "@/domain/safety";

const allowed = (videos) => videos.filter((video) => video.category !== "Music_Dance");

async function seedStarterVideos(profile) {
  const language = profile.targetLanguages?.[0] || "en";
  const queries = ["learning for kids", "stories for kids", "science for kids", "animals for kids"];
  const saved = [];
  for (const query of queries) {
    const term = safeQuery(query);
    if (!term) continue;
    const found = await searchVideos({ term, languageCode: language, maxResults: 6 });
    const gated = applyWhitelistGates(found, profile.ageGroup).filter((video) => allowed(video));
    const pool = gated.length ? gated : found.filter((video) => video.durationSeconds > 0 && video.durationSeconds <= 1800);
    if (!pool.length) continue;
    const now = new Date().toISOString();
    const folder = query.includes("science") ? ["STEM", "cat_stem"] : query.includes("animals") ? ["Nature_Animals", "cat_nature_animals"] : query.includes("stories") ? ["Literacy_Language", "cat_literacy_language"] : ["STEM", "cat_stem"];
    const rows = pool.slice(0, 4).map((video) => ({
      id: video.id,
      title: video.title,
      description: video.description,
      channelId: video.channelId,
      channelTitle: video.channelTitle,
      category: folder[0],
      categoryId: folder[1],
      ageGroup: profile.ageGroup,
      language: (video.language || language || "en").slice(0, 2).toLowerCase() || "en",
      durationSeconds: video.durationSeconds,
      viewCount: video.viewCount,
      thumbnail: video.thumbnail,
      approved: true,
      addedAt: now,
      sourceChannelId: video.channelId,
    }));
    await putLibraryVideos(rows);
    saved.push(...rows);
    if (saved.length >= 8) break;
  }
  return saved.length;
}

export async function loadFeed(profile) {
  await importApprovedDiscovery(profile.ageGroup);
  let videos = allowed(await getLibraryVideosForProfile(profile));
  if (!videos.length) {
    const firstRun = await ensureLibraryVideos(profile);
    videos = allowed(await getLibraryVideosForProfile(profile));
    if (!videos.length) {
      try {
        await seedStarterVideos(profile);
      } catch (error) {
        if (!firstRun.ok) throw error;
      }
      videos = allowed(await getLibraryVideosForProfile(profile));
    }
  } else {
    maybeAutoRefresh();
  }
  const prefs = await loadPreferences(profile.id);
  return { videos: applyPreferences(videos, prefs), fromCache: false };
}

export function makeQueue(videos, tokenBalance, comprehensionScore, ageGroup) {
  return buildQueue(videos, tokenBalance, levelFromScore(comprehensionScore), entertainmentCostFor(ageGroup));
}

export { YoutubeApiError };
