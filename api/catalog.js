export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed." });
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(200).json({ ok: true, videos: [] });
  const ageGroup = /^[a-z0-9_]+$/.test(req.query.ageGroup || "") ? req.query.ageGroup : "";
  const filter = ageGroup ? `&age_group=eq.${ageGroup}` : "";
  const response = await fetch(`${supabaseUrl}/rest/v1/catalog_videos?approved=eq.true${filter}&select=*&order=id.desc&limit=300`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!response.ok) return res.status(200).json({ ok: true, videos: [] });
  const rows = await response.json();
  const videos = (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row.id,
    title: row.title || "",
    description: "",
    channelId: row.channel_id || "",
    channelTitle: row.channel_title || "",
    category: row.category || "STEM",
    categoryId: row.category_id || null,
    ageGroup: row.age_group,
    language: row.language || "en",
    durationSeconds: Number(row.duration_seconds) || 480,
    viewCount: Number(row.view_count) || 0,
    thumbnail: row.thumbnail || "",
    approved: true,
  })).filter((video) => video.id);
  res.setHeader("Cache-Control", "s-maxage=300");
  return res.status(200).json({ ok: true, videos });
}
