// YouTube client adapter — talks to the Vercel function that holds the API key.
export class YoutubeApiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

async function invoke(payload) {
  const response = await fetch("/api/youtube-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!data || typeof data !== "object") throw new YoutubeApiError("Unexpected response from the server.", "BAD_RESPONSE");
  if (!data.ok) throw new YoutubeApiError(data.error || "The YouTube service failed.", data.code || "UNKNOWN");
  return data;
}

export async function resolveChannels(queries) {
  const data = await invoke({ action: "resolveChannels", queries });
  return data.channels;
}

export async function fetchChannelUploads(channelId, maxResults = 12) {
  const data = await invoke({ action: "channelUploads", channelId, maxResults });
  return data.videos;
}

export async function suggestChannels(query, languageCode = "en") {
  const data = await invoke({ action: "suggestChannels", query, languageCode });
  return data.channels || [];
}

export async function searchVideos({ term, languageCode, maxResults = 12 }) {
  const data = await invoke({ action: "searchVideos", term, languageCode, maxResults });
  return data.videos;
}

export async function channelStats(channelId) {
  const data = await invoke({ action: "channelStats", channelId });
  return data.stats;
}

export async function fetchVideo(videoId) {
  const data = await invoke({ action: "videoById", videoId });
  return data.video;
}
