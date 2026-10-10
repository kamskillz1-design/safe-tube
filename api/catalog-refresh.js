const API_BASE = "https://www.googleapis.com/youtube/v3";
const BLOCKED = ["weapon", "gun", "knife", "prank", "scary", "horror", "blood", "fight", "kill"];
const AGES = ["toddler_2_4", "early_learner_5_7", "tween_8_12", "teen_13_16"];
const CATEGORIES = [
  ["cat_stem", "STEM", "science for kids"],
  ["cat_arts", "Arts", "art lessons for kids"],
  ["cat_emotional_intelligence", "Emotional_Intelligence", "feelings for kids"],
  ["cat_literacy_language", "Literacy_Language", "reading for kids"],
  ["cat_nature_animals", "Nature_Animals", "animals for kids"],
  ["cat_life_skills", "Life_Skills", "life skills for kids"],
  ["cat_health_movement", "Health_Movement", "exercise for kids"],
  ["cat_self_defense", "Self_Defense", "body safety for kids"],
  ["cat_history", "History", "history for kids"],
  ["cat_geography", "Geography", "geography for kids"],
  ["cat_coding_technology", "Coding_Technology", "coding for kids"],
  ["cat_ai", "AI", "artificial intelligence for kids"],
  ["cat_film_making", "Film_Making", "film making for kids"],
  ["cat_digital_skills", "Digital_Skills", "computer skills for kids"],
  ["cat_cooking_food", "Cooking_Food", "cooking for kids"],
  ["cat_sports_games", "Sports_Games", "sports for kids"],
  ["cat_environmental_awareness", "Environmental_Awareness", "environment for kids"],
  ["cat_world_cultures", "World_Cultures", "world cultures for kids"],
  ["cat_wholesome_entertainment", "Wholesome_Entertainment", "funny stories for kids"],
  ["cat_faith", "Faith_Values", "kindness and values for kids"],
  ["cat_iqra", "IQRA", "Quran for kids"],
];

function plain(value, max) {
  return String(value || "").replace(/<[^>]*>/g, "").trim().slice(0, max);
}

function allowed(title) {
  const text = title.toLowerCase();
  return !BLOCKED.some((word) => text.includes(word));
}

function jobs() {
  return AGES.flatMap((ageGroup) =>
    CATEGORIES.map(([categoryId, category, term]) => ({ ageGroup, categoryId, category, term, language: "en" }))
  );
}

async function yt(path, params, apiKey) {
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  url.searchParams.set("key", apiKey);
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`YouTube ${response.status}`);
  return response.json();
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false, error: "Unauthorized." });
  }
  const apiKey = process.env.YOUTUBE_API_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !supabaseUrl || !serviceKey) {
    return res.status(503).json({ ok: false, error: "Missing YouTube key or Supabase service role." });
  }

  const all = jobs();
  const batchSize = 12;
  const start = (new Date().getUTCDate() + new Date().getUTCHours()) % all.length;
  const batch = Array.from({ length: batchSize }, (_, index) => all[(start + index) % all.length]);
  const rows = [];
  for (const job of batch) {
    const search = await yt("/search", {
      part: "snippet",
      q: job.ageGroup === "toddler_2_4" ? `${job.term} toddlers` : job.term,
      type: "video",
      maxResults: 5,
      relevanceLanguage: job.language,
      safeSearch: "strict",
      videoEmbeddable: true,
    }, apiKey);
    for (const item of search.items || []) {
      const title = item.snippet?.title || "";
      const id = item.id?.videoId;
      if (!id || !allowed(title)) continue;
      rows.push({
        id,
        title: plain(title, 140),
        channel_title: plain(item.snippet?.channelTitle, 80),
        category_id: job.categoryId,
        category: job.category,
        age_group: job.ageGroup,
        language: job.language,
        thumbnail: item.snippet?.thumbnails?.medium?.url || "",
        approved: true,
      });
    }
  }
  if (!rows.length) return res.status(200).json({ ok: true, added: 0, checked: batch.length });
  const saved = await fetch(`${supabaseUrl}/rest/v1/catalog_videos`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });
  if (!saved.ok) {
    const error = await saved.text();
    return res.status(500).json({ ok: false, error: "Catalog save failed.", detail: error.slice(0, 300) });
  }
  return res.status(200).json({ ok: true, added: rows.length, checked: batch.length });
}
