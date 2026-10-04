const API_BASE = "https://www.googleapis.com/youtube/v3";
const fail = (res, error, code, status = 400) => res.status(status).json({ ok: false, error, code });
const ok = (res, data) => res.status(200).json({ ok: true, ...data });
const DANGER = ["weapon", "knife", "gun", "firearm", "choke", "strangle", "bomb", "explosive"];

function plain(value, max) {
  return String(value || "").replace(/<[^>]*>/g, "").replace(/javascript:/gi, "").replace(/data:/gi, "").trim().slice(0, max);
}

function safeQuery(value) {
  const query = plain(value, 80);
  if (!query || DANGER.some((word) => query.toLowerCase().includes(word))) return null;
  return query;
}

async function ytFetch(path, params, apiKey) {
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  url.searchParams.set("key", apiKey);
  const response = await fetch(url.toString());
  if (!response.ok) {
    const error = new Error(`YouTube API returned ${response.status}`);
    error.code = response.status === 403 ? "YOUTUBE_QUOTA_OR_KEY" : "YOUTUBE_API_ERROR";
    throw error;
  }
  return response.json();
}

function parseIsoDuration(iso) {
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!match) return 0;
  return Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0);
}

function toVideo(item) {
  const thumb = item.snippet?.thumbnails?.medium?.url ?? "";
  return {
    id: item.id,
    title: plain(item.snippet?.title, 140),
    description: plain(item.snippet?.description, 280),
    channelId: item.snippet?.channelId ?? "",
    channelTitle: plain(item.snippet?.channelTitle, 80),
    language: plain(item.snippet?.defaultAudioLanguage, 8),
    publishedAt: item.snippet?.publishedAt ?? "",
    durationSeconds: parseIsoDuration(item.contentDetails?.duration),
    viewCount: Number(item.statistics?.viewCount ?? 0),
    thumbnail: thumb.startsWith("https://i.ytimg.com/") ? thumb : "",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return fail(res, "Method not allowed.", "INVALID_ACTION", 405);
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return fail(res, "Add YOUTUBE_API_KEY in Vercel env.", "MISSING_API_KEY", 503);
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    if (payload.action === "resolveChannels") {
      const queries = Array.isArray(payload.queries) ? payload.queries.map(safeQuery).filter(Boolean).slice(0, 5) : [];
      if (!queries.length) return fail(res, "queries must be a non-empty array.", "INVALID_INPUT");
      const channels = [];
      for (const query of queries) {
        const data = await ytFetch("/search", { part: "snippet", q: query, type: "channel", maxResults: 1, safeSearch: "strict" }, apiKey);
        const item = data.items?.[0];
        channels.push(item ? { query, channelId: item.snippet?.channelId ?? item.id?.channelId ?? null, title: plain(item.snippet?.title, 80) } : { query, channelId: null, title: "" });
      }
      return ok(res, { channels });
    }
    if (payload.action === "channelUploads") {
      const channelId = typeof payload.channelId === "string" ? payload.channelId.trim() : "";
      if (!/^UC[\w-]{22}$/.test(channelId)) return fail(res, "channelId must be a YouTube channel id.", "INVALID_INPUT");
      const maxResults = Math.min(Math.max(Number(payload.maxResults) || 5, 1), 8);
      const channel = await ytFetch("/channels", { part: "contentDetails", id: channelId }, apiKey);
      const uploadsPlaylist = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsPlaylist) return fail(res, "Channel not found.", "NOT_FOUND", 404);
      const playlist = await ytFetch("/playlistItems", { part: "contentDetails", playlistId: uploadsPlaylist, maxResults }, apiKey);
      const ids = (playlist.items || []).map((i) => i.contentDetails?.videoId).filter((id) => /^[\w-]{11}$/.test(id));
      if (!ids.length) return ok(res, { videos: [] });
      const details = await ytFetch("/videos", { part: "snippet,contentDetails,statistics", id: ids.join(",") }, apiKey);
      return ok(res, { videos: (details.items || []).map(toVideo) });
    }
    if (payload.action === "suggestChannels") {
      const query = safeQuery(payload.query);
      if (!query) return fail(res, "query is required.", "INVALID_INPUT");
      const languageCode = /^[a-z]{2}$/.test(payload.languageCode || "") ? payload.languageCode : "en";
      const region = { ur: "PK", ar: "SA", hi: "IN", bn: "BD", fr: "FR", es: "ES", tr: "TR", id: "ID" }[languageCode];
      const search = await ytFetch("/search", { part: "snippet", q: query, type: "channel", maxResults: 8, relevanceLanguage: languageCode, safeSearch: "strict", ...(region ? { regionCode: region } : {}) }, apiKey);
      const channels = (search.items || []).map((item) => ({
        query,
        channelId: item.snippet?.channelId ?? item.id?.channelId ?? null,
        title: plain(item.snippet?.title, 80),
        description: plain(item.snippet?.description, 180),
        language: languageCode,
      })).filter((channel) => channel.channelId && channel.title);
      return ok(res, { channels });
    }
    if (payload.action === "searchVideos") {
      const term = safeQuery(payload.term);
      if (!term) return fail(res, "term is required.", "INVALID_INPUT");
      const languageCode = /^[a-z]{2}$/.test(payload.languageCode || "") ? payload.languageCode : "en";
      const maxResults = Math.min(Math.max(Number(payload.maxResults) || 8, 1), 12);
      const region = { ur: "PK", ar: "SA", hi: "IN", bn: "BD", fr: "FR", es: "ES", tr: "TR", id: "ID" }[languageCode];
      const search = await ytFetch("/search", { part: "snippet", q: term, type: "video", maxResults, relevanceLanguage: languageCode, safeSearch: "strict", videoEmbeddable: true, ...(region ? { regionCode: region } : {}) }, apiKey);
      const ids = (search.items || []).map((i) => i.id?.videoId).filter((id) => /^[\w-]{11}$/.test(id));
      if (!ids.length) return ok(res, { videos: [] });
      const details = await ytFetch("/videos", { part: "snippet,contentDetails,statistics", id: ids.join(",") }, apiKey);
      const videos = (details.items || []).map(toVideo);
      if (languageCode === "en") return ok(res, { videos });
      const audio = (video) => String(video.language || "").slice(0, 2).toLowerCase();
      const matched = videos.filter((video) => audio(video) === languageCode);
      if (matched.length) return ok(res, { videos: matched });
      const fallback = videos.filter((video) => !audio(video) || audio(video) === "en").map((video) => ({ ...video, languageFallback: true }));
      return ok(res, { videos: fallback });
    }
    if (payload.action === "videoById") {
      const id = typeof payload.videoId === "string" ? payload.videoId.trim() : "";
      if (!/^[\w-]{11}$/.test(id)) return fail(res, "videoId is required.", "INVALID_INPUT");
      const details = await ytFetch("/videos", { part: "snippet,contentDetails,statistics", id }, apiKey);
      const item = details.items?.[0];
      if (!item) return fail(res, "Video not found.", "NOT_FOUND", 404);
      return ok(res, { video: toVideo(item) });
    }
    if (payload.action === "channelStats") {
      const channelId = typeof payload.channelId === "string" ? payload.channelId.trim() : "";
      if (!/^UC[\w-]{22}$/.test(channelId)) return fail(res, "channelId must be a YouTube channel id.", "INVALID_INPUT");
      const data = await ytFetch("/channels", { part: "statistics", id: channelId }, apiKey);
      const stats = data.items?.[0]?.statistics;
      if (!stats) return fail(res, "Channel not found.", "NOT_FOUND", 404);
      return ok(res, { stats: { subscriberCount: Number(stats.subscriberCount ?? 0), videoCount: Number(stats.videoCount ?? 0) } });
    }
    return fail(res, "Unknown action.", "INVALID_ACTION");
  } catch (error) {
    return res.status(500).json({ ok: false, error: "Unexpected server error.", code: error.code || "YOUTUBE_API_ERROR" });
  }
}
