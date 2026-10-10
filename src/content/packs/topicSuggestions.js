import { AGE_GROUPS, CATEGORIES } from "@/domain/constants";

const all = [AGE_GROUPS.TODDLER, AGE_GROUPS.EARLY_LEARNER, AGE_GROUPS.TWEEN, AGE_GROUPS.TEEN];
const older = [AGE_GROUPS.TWEEN, AGE_GROUPS.TEEN];
const fromEarly = [AGE_GROUPS.EARLY_LEARNER, ...older];

const TOPICS = [
  { category: CATEGORIES.STEM, label: "Science", ages: all, q: "science for kids" },
  { category: CATEGORIES.ARTS, label: "Art", ages: all, q: "art for kids" },
  { category: CATEGORIES.EMOTIONAL_INTELLIGENCE, label: "Feelings", ages: all, q: "feelings for kids" },
  { category: CATEGORIES.LITERACY_LANGUAGE, label: "Reading", ages: all, q: "reading for kids" },
  { category: CATEGORIES.NATURE_ANIMALS, label: "Animals", ages: all, q: "animals for kids" },
  { category: CATEGORIES.LIFE_SKILLS, label: "Life skills", ages: all, q: "life skills for kids" },
  { category: CATEGORIES.WORLD_CULTURES, label: "Cultures", ages: all, q: "world cultures for kids" },
  { category: CATEGORIES.HISTORY, label: "History", ages: older, q: "history for kids" },
  { category: CATEGORIES.GEOGRAPHY, label: "Geography", ages: older, q: "geography for kids" },
  { category: CATEGORIES.CODING_TECHNOLOGY, label: "Coding", ages: older, q: "coding for kids" },
  { category: CATEGORIES.AI, label: "AI", ages: older, q: "artificial intelligence for kids" },
  { category: CATEGORIES.FILM_MAKING, label: "Film making", ages: older, q: "film making for kids" },
  { category: CATEGORIES.DIGITAL_SKILLS, label: "Digital skills", ages: fromEarly, q: "digital skills for kids" },
  { category: CATEGORIES.COOKING_FOOD, label: "Cooking", ages: fromEarly, q: "cooking for kids" },
  { category: CATEGORIES.SPORTS_GAMES, label: "Sports", ages: fromEarly, q: "sports for kids" },
  { category: CATEGORIES.ENVIRONMENTAL_AWARENESS, label: "Nature care", ages: all, q: "environment for kids" },
  { category: CATEGORIES.HEALTH_MOVEMENT, label: "Exercise", ages: all, kind: "exercise", q: "exercise for kids" },
  { category: CATEGORIES.SELF_DEFENSE, label: "Self-defense", ages: older, kind: "defense", q: "self defense basics for teenagers awareness" },
  { category: CATEGORIES.SELF_DEFENSE, label: "Body safety", ages: [AGE_GROUPS.TODDLER, AGE_GROUPS.EARLY_LEARNER], kind: "defense", q: "body safety for kids" },
];

const LANG = {
  es: "en español", fr: "en français", de: "auf Deutsch", zh: "中文", ar: "بالعربية", hi: "हिंदी", pt: "em português", ja: "日本語", ru: "на русском", it: "in italiano", ko: "한국어", tr: "Türkçe", eu: "euskara", id: "bahasa Indonesia", pl: "po polsku", ur: "اردو",
};

export function topicSuggestions(languages, ageGroup) {
  const codes = [...new Set((languages || []).map((code) => String(code).slice(0, 2).toLowerCase()))].filter((code) => code && code !== "en");
  return codes.flatMap((language) =>
    TOPICS.filter((topic) => topic.ages.includes(ageGroup)).map((topic) => ({
      name: `${topic.label} (${language.toUpperCase()})`,
      query: `${topic.q} ${LANG[language] || language}`,
      language,
      category: topic.category,
      kind: topic.kind || "topic",
      ageGroup,
    }))
  );
}

export function exerciseSuggestions(ageGroup) {
  const rows = [
    { name: "Move and play", query: "kids exercise play", ages: [AGE_GROUPS.TODDLER, AGE_GROUPS.EARLY_LEARNER], kind: "exercise" },
    { name: "Kids workout", query: "kids workout at home", ages: [AGE_GROUPS.EARLY_LEARNER, AGE_GROUPS.TWEEN], kind: "exercise" },
    { name: "Teen fitness", query: "teen home workout no equipment", ages: [AGE_GROUPS.TWEEN, AGE_GROUPS.TEEN], kind: "exercise" },
    { name: "Body safety", query: "body safety for kids", ages: [AGE_GROUPS.TODDLER, AGE_GROUPS.EARLY_LEARNER], kind: "defense" },
    { name: "Self-defense basics", query: "self defense basics for teenagers awareness", ages: [AGE_GROUPS.TWEEN, AGE_GROUPS.TEEN], kind: "defense" },
  ];
  return rows.filter((row) => row.ages.includes(ageGroup)).map((row) => ({ ...row, language: "en", category: CATEGORIES.HEALTH_MOVEMENT, ageGroup }));
}
