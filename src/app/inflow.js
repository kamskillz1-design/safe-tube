import { applyWhitelistGates } from "@/domain/gates";
import { defaultTrustedChannels } from "@/app/library";
import { fetchChannelUploads, resolveChannels } from "@/adapters/youtubeClient";
import { libraryVideosForAge, putLibraryVideos } from "@/adapters/localDb";
import { legacyCategoryToId } from "@/domain/categories";

const PAUSE_MS = 12000;

function allowed(video) {
  return video.category !== "Music_Dance" && !/music|dance|song/i.test(`${video.title} ${video.channelTitle}`);
}

export function startSlowInflow({ ageGroup, language = "en", onVideos }) {
  let stopped = false;
  let cursor = 0;
  const tick = async () => {
    if (stopped || !ageGroup) return;
    try {
      const sources = (await defaultTrustedChannels()).filter((channel) => channel.ageGroup === ageGroup);
      if (!sources.length) return;
      const channel = sources[cursor % sources.length];
      cursor += 1;
      const resolved = channel.channelId || (await resolveChannels([channel.name]))[0]?.channelId;
      if (!resolved) return;
      const uploads = await fetchChannelUploads(resolved, 5);
      const stored = new Set((await libraryVideosForAge(ageGroup)).map((video) => video.id));
      const fresh = applyWhitelistGates(uploads, ageGroup).filter((video) => allowed(video) && !stored.has(video.id)).slice(0, 2);
      if (!fresh.length) return;
      const now = new Date().toISOString();
      const rows = fresh.map((video) => ({
        id: video.id,
        title: video.title,
        description: video.description,
        channelId: video.channelId,
        channelTitle: video.channelTitle || channel.name,
        category: channel.categories?.[0] || "Emotional_Intelligence",
        categoryId: channel.primaryCategoryId || legacyCategoryToId(channel.categories?.[0]) || null,
        ageGroup,
        language: (video.language || channel.nativeLanguage || language || "en").slice(0, 2).toLowerCase(),
        durationSeconds: video.durationSeconds,
        viewCount: video.viewCount,
        thumbnail: video.thumbnail,
        approved: true,
        addedAt: now,
        sourceChannelId: resolved,
      }));
      await putLibraryVideos(rows);
      onVideos?.(rows);
    } catch {
      // The next tick tries another trusted channel. A quota miss must not break playback.
    }
  };
  tick();
  const timer = setInterval(tick, PAUSE_MS);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
