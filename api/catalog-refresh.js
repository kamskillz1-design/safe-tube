const API_BASE = "https://www.googleapis.com/youtube/v3";
const BLOCKED = ["weapon", "gun", "knife", "prank", "scary", "horror", "blood", "fight", "kill"];
const AGES = ["toddler_2_4", "early_learner_5_7", "tween_8_12", "teen_13_16"];
const LANGS = ["en", "es", "fr", "ar", "ur", "hi"];
const CATEGORIES = [
  ["cat_stem", "STEM", "science for kids", ["UCsooa4yRKGN_zEE8iknghZA", "UCXVCgDuD_QCkI7gTKU7-tpg"]],
  ["cat_arts", "Arts", "art lessons for kids", ["UC_sG8eOqJqJqJqJqJqJqJqJ"]],
  ["cat_nature_animals", "Nature_Animals", "animals for kids", ["UCDPk9xK6n_n2Xk2k2k2k2k2k"]],
  ["cat_life_skills", "Life_Skills", "life skills for kids", []],
  ["cat_literacy_language", "Literacy_Language", "reading for kids", []],
  ["cat_health_movement", "Health_Movement", "exercise for kids", []],
  ["cat_self_defense", "Self_Defense", "body safety for kids", []],
  ["cat_history", "History", "history for kids", []],
  ["cat_geography", "Geography", "geography for kids", []],
  ["cat_coding_technology", "Coding_Technology", "coding for kids", []],
  ["cat_cooking_food", "Cooking_Food", "cooking for kids", []],
  ["cat_sports_games", "Sports_Games", "sports for kids", []],
  ["cat_world_cultures", "World_Cultures", "world cultures for kids", []],
  ["cat_faith", "Faith_Values", "kindness and values for kids", []],
  ["cat_iqra", "IQRA", "Quran for kids", []],
  ["cat_emotional_intelligence", "Emotional_Intelligence", "feelings for kids", []],
  ["cat_environmental_awareness", "Environmental_Awareness", "environment for kids", []],
  ["cat_digital_skills", "Digital_Skills", "computer skills for kids", []],
  ["cat_ai", "AI", "artificial intelligence for kids", []],
  ["cat_film_making", "Film_Making", "film making for kids", []],
  ["cat_wholesome_entertainment", "Wholesome_Entertainment", "funny stories for kids", []],
];

function plain(value, max) {
  return String(value || "").replace(/<[^>]*>/g, "").trim().slice(0, max);
}
function allowed(title) {
  return !BLOCKED.some((word) => title.toLowerCase().includes(word));
}
async function yt(path, params, apiKey) {
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  url.searchParams.set("key", apiKey);
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`YouTube ${response.status}`);
  return response.json();
}
async function uploads(channelId, apiKey) {
  const channel = await yt("/channels", { part: "contentDetails", id: channelId }, apiKey);
  const playlist = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!playlist) return [];
  const items = await yt("/playlistItems", { part: "snippet", playlistId: playlist, maxResults: 15 }, apiKey);
  return items.items || [];
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ ok: false, error: "Unauthorized." });
  const apiKey = process.env.YOUTUBE_API_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !supabaseUrl || !serviceKey) return res.status(503).json({ ok: false, error: "Missing YouTube key or Supabase service role." });

  const day = new Date().getUTCDate();
  const age = AGES[day % AGES.length];
  const language = LANGS[day % LANGS.length];
  const slice = CATEGORIES.filter((_, index) => index % 3 === day % 3);
  const rows = [];
  let searches = 0;
  for (const [categoryId, category, term, seeds] of slice) {
    const channels = [...seeds.filter((id) => /^UC[\w-]{20,}$/.test(id))];
    if (searches < 8) {
      searches += 1;
      const hint = language === "en" ? "" : ` ${language}`;
      const found = await yt("/search", { part: "snippet", q: `${term}${hint}`, type: "channel", maxResults: 3, relevanceLanguage: language, safeSearch: "strict" }, apiKey);
      for (const item of found.items || []) if (item.id?.channelId) channels.push(item.id.channelId);
    }
    for (const channelId of [...new Set(channels)].slice(0, 4)) {
      const items = await uploads(channelId, apiKey).catch(() => []);
      for (const item of items) {
        const title = item.snippet?.title || "";
        const id = item.snippet?.resourceId?.videoId;
        if (!id || !allowed(title)) continue;
        rows.push({
          id, title: plain(title, 140), channel_id: channelId, channel_title: plain(item.snippet?.channelTitle, 80),
          category_id: categoryId, category, age_group: age, language, thumbnail: item.snippet?.thumbnails?.medium?.url || "", approved: true,
        });
      }
    }
  }
  if (!rows.length) return res.status(200).json({ ok: true, added: 0, age, language });
  const saved = await fetch(`${supabaseUrl}/rest/v1/catalog_videos`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(rows),
  });
  if (!saved.ok) return res.status(500).json({ ok: false, error: "Catalog save failed.", detail: (await saved.text()).slice(0, 300) });
  return res.status(200).json({ ok: true, added: rows.length, age, language, searches });
}
