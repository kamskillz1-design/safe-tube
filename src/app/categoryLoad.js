import { applyWhitelistGates, passesKeywordBlocker } from "@/domain/gates";
import { fetchChannelUploads, searchVideos } from "@/adapters/youtubeClient";
import { defaultTrustedChannels } from "@/app/library";
import { libraryVideosForAge, putLibraryVideos } from "@/adapters/localDb";
import { safeQuery } from "@/domain/safety";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const HINT = { es: "en español", fr: "en français", de: "auf Deutsch", zh: "中文", ar: "بالعربية", hi: "हिंदी", pt: "em português", ja: "日本語", ru: "на русском", it: "in italiano", ko: "한국어", tr: "Türkçe", eu: "euskara", id: "bahasa Indonesia", pl: "po polsku", ur: "in Urdu اردو" };
const KEEP = 20;
const VIOLENT = /fight|weapon|gun|knife|blood|punch|kick|choke|strangle|mma|boxing|combat|attack|kill|wrestling/;

const QUERY_BY_ID = {
  cat_stem: "science experiments for kids",
  cat_arts: "art lessons for kids",
  cat_emotional_intelligence: "feelings and kindness for kids",
  cat_literacy_language: "reading lessons for kids",
  cat_nature_animals: "animals for kids",
  cat_life_skills: "life skills for kids",
  cat_health_movement: "exercise for kids",
  cat_history: "history for kids",
  cat_geography: "geography for kids",
  cat_coding_technology: "coding for kids",
  cat_ai: "artificial intelligence for kids",
  cat_film_making: "film making for kids",
  cat_digital_skills: "computer skills for kids",
  cat_cooking_food: "cooking for kids",
  cat_sports_games: "sports for kids",
  cat_environmental_awareness: "environment and nature care for kids",
  cat_world_cultures: "world cultures for kids",
  cat_wholesome_entertainment: "funny stories for kids",
  cat_faith: "kindness and values for kids",
  cat_islam: "Islamic stories for kids",
  cat_iqra: "Quran reading for kids",
  cat_iqra_letters: "Arabic alphabet for kids",
  cat_iqra_qaida: "Noorani Qaida for kids",
  cat_iqra_reading: "Quran reading for kids",
  cat_iqra_tajweed: "tajweed for kids",
};

const SELF_DEFENSE_QUERY = {
  toddler_2_4: "my body belongs to me for toddlers",
  early_learner_5_7: "body safety for kids safe and unsafe touch",
  tween_8_12: "personal safety for kids say no and tell a trusted adult",
  teen_13_16: "teen personal safety awareness and getting help",
};

function queryFor(categoryId, label, ageGroup) {
  if (/self.?defense/i.test(`${label} ${categoryId}`)) return SELF_DEFENSE_QUERY[ageGroup] || SELF_DEFENSE_QUERY.tween_8_12;
  if (QUERY_BY_ID[categoryId]) return QUERY_BY_ID[categoryId];
  if (/iqra|quran|qaida|tajweed/i.test(`${label} ${categoryId}`)) return "Quran for kids";
  if (/islam/i.test(`${label} ${categoryId}`)) return "Islamic stories for kids";
  if (/faith/i.test(`${label} ${categoryId}`)) return "kindness and values for kids";
  return `${String(label || "learning").replaceAll("_", " ")} for kids`;
}

function keepLessons(found, ageGroup, selfDefense) {
  const gated = applyWhitelistGates(found, ageGroup);
  let pool = gated.length ? gated : found.filter((video) => passesKeywordBlocker(video) && video.durationSeconds > 0 && video.durationSeconds <= 1800);
  if (selfDefense) pool = pool.filter((video) => !VIOLENT.test(`${video.title} ${video.description}`.toLowerCase()));
  return pool.slice(0, KEEP);
}


const QURAN = /quran|surah|surat|iqra|qaida|tajweed|fatiha|ikhlas|falaq|naas|an-nas/;
const CODING = /scratch|coding|programming|code a/;
const ART = /how to draw|drawing lesson|art lesson/;
const ANIMAL = /elephant|lion|whale|dolphin|gorilla|cheetah|animal/;

export function belongsIn(video, categoryId) {
  const text = `${video.title || ""} ${video.description || ""}`.toLowerCase();
  if (!categoryId) return true;
  if (categoryId.startsWith("cat_iqra")) return QURAN.test(text) || video.categoryId?.startsWith("cat_iqra");
  if (QURAN.test(text)) return false;
  if (categoryId === "cat_coding_technology" || categoryId === "cat_digital_skills" || categoryId === "cat_ai" || categoryId === "cat_film_making") return CODING.test(text) || video.categoryId === categoryId;
  if (CODING.test(text) && /cat_stem|cat_arts|cat_faith/.test(categoryId)) return false;
  if (categoryId === "cat_arts") return ART.test(text) || video.categoryId === "cat_arts";
  if (categoryId === "cat_nature_animals") return ANIMAL.test(text) || video.categoryId === "cat_nature_animals";
  return video.categoryId === categoryId || !video.categoryId;
}

function toRows(found, ageGroup, language, categoryId, label, selfDefense) {
  const now = new Date().toISOString();
  return keepLessons(found, ageGroup, selfDefense).filter((video) => belongsIn(video, categoryId)).map((video) => ({
    id: video.id,
    title: video.title,
    description: video.description,
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    category: label || "STEM",
    categoryId: belongsIn({ ...video, categoryId }, categoryId) ? categoryId : null,
    ageGroup,
    language: video.languageFallback ? "en" : language,
    languageFallback: !!video.languageFallback,
    durationSeconds: video.durationSeconds,
    viewCount: video.viewCount,
    thumbnail: video.thumbnail,
    approved: true,
    addedAt: now,
    sourceChannelId: video.channelId,
  }));
}

export async function loadCategoryVideos(ageGroup, label, categoryId, languages = ["en"], query) {
  const selfDefense = /self.?defense/i.test(`${label} ${categoryId}`);
  const base = query || queryFor(categoryId, label, ageGroup);
  const codes = [...new Set((languages.length ? languages : ["en"]).map((code) => String(code).slice(0, 2).toLowerCase()))].slice(0, 1);
  const saved = [];
  const seen = new Set((await libraryVideosForAge(ageGroup)).map((video) => video.id));
  for (const language of codes) {
    const hint = language === "en" ? "" : ` ${HINT[language] || language}`;
    const term = safeQuery(`${base}${hint}`);
    if (!term) continue;
    await sleep(250);
    const found = await searchVideos({ term, languageCode: language, maxResults: 12 });
    const rows = toRows(found, ageGroup, language, categoryId, label, selfDefense).filter((video) => !seen.has(video.id));
    rows.forEach((video) => seen.add(video.id));
    if (rows.length) await putLibraryVideos(rows);
    saved.push(...rows);
  }
  return saved.slice(0, KEEP);
}

export function startCategoryFill({ ageGroup, languages = ["en"], tree = [], getExisting, getPreferred, onBatch, shouldStop }) {
  const targets = tree.filter((node) => !node.hidden && !node.parentId);
  let cursor = 0;
  let running = false;
  const tick = async () => {
    if (shouldStop?.() || running || !targets.length) return;
    running = true;
    try {
      const preferred = targets.find((item) => item.id === getPreferred?.());
      const node = preferred && cursor % 2 === 0 ? preferred : targets[cursor % targets.length];
      cursor += 1;
      const existing = getExisting?.() || [];
      const have = existing.filter((video) => video.categoryId === node.id);
      if (have.length >= KEEP) return;
      const channels = (await defaultTrustedChannels()).filter((channel) => channel.ageGroup === ageGroup && channel.channelId && channel.primaryCategoryId === node.id);
      let batch = [];
      if ((languages[0] || "en") === "en") {
        for (const channel of channels.slice(0, 6)) {
          const uploads = await fetchChannelUploads(channel.channelId, 12);
          batch.push(...toRows(uploads, ageGroup, "en", node.id, node.slug || "Learning", /self.?defense/i.test(node.id)));
        }
      }
      if (batch.length < 4) batch.push(...await loadCategoryVideos(ageGroup, node.slug || "Learning", node.id, languages));
      const taken = new Set(existing.map((video) => video.id));
      const fresh = batch.filter((video) => video.categoryId === node.id && !taken.has(video.id));
      if (fresh.length) onBatch?.(fresh);
    } catch {
      // A quota miss skips this category. The next tick tries another one.
    } finally {
      running = false;
    }
  };
  tick();
  const timer = setInterval(tick, 2500);
  return () => clearInterval(timer);
}
