import { AGE_GROUPS, CATEGORIES } from "@/domain/constants";

const all = [AGE_GROUPS.TODDLER, AGE_GROUPS.EARLY_LEARNER, AGE_GROUPS.TWEEN, AGE_GROUPS.TEEN];
const older = [AGE_GROUPS.TWEEN, AGE_GROUPS.TEEN];
const fromEarly = [AGE_GROUPS.EARLY_LEARNER, ...older];

const TOPICS = [
  { category: CATEGORIES.IQRA, label: "IQRA", channel: "One4Kids", ages: all, q: "One4Kids Quran" },
  { category: CATEGORIES.STEM, label: "Science", channel: "SciShow Kids", ages: all, q: "SciShow Kids" },
  { category: CATEGORIES.ARTS, label: "Art", channel: "Art for Kids Hub", ages: all, q: "Art for Kids Hub" },
  { category: CATEGORIES.EMOTIONAL_INTELLIGENCE, label: "Feelings", channel: "Sesame Street", ages: all, q: "Sesame Street feelings" },
  { category: CATEGORIES.LITERACY_LANGUAGE, label: "Reading", channel: "Kids Academy", ages: all, q: "Kids Academy reading" },
  { category: CATEGORIES.NATURE_ANIMALS, label: "Animals", channel: "Nat Geo Kids", ages: all, q: "Nat Geo Kids" },
  { category: CATEGORIES.LIFE_SKILLS, label: "Life skills", channel: "PBS Kids", ages: all, q: "PBS Kids life skills" },
  { category: CATEGORIES.WORLD_CULTURES, label: "Cultures", channel: "National Geographic Kids", ages: all, q: "National Geographic Kids cultures" },
  { category: CATEGORIES.HISTORY, label: "History", channel: "Crash Course Kids", ages: older, q: "Crash Course Kids history" },
  { category: CATEGORIES.GEOGRAPHY, label: "Geography", channel: "National Geographic Kids", ages: older, q: "National Geographic Kids geography" },
  { category: CATEGORIES.CODING_TECHNOLOGY, label: "Coding", channel: "ScratchJr", ages: older, q: "ScratchJr" },
  { category: CATEGORIES.AI, label: "AI", channel: "SciShow Kids", ages: older, q: "SciShow Kids technology" },
  { category: CATEGORIES.FILM_MAKING, label: "Film making", channel: "Khan Academy Kids", ages: older, q: "Khan Academy Kids film" },
  { category: CATEGORIES.DIGITAL_SKILLS, label: "Digital skills", channel: "Khan Academy Kids", ages: fromEarly, q: "Khan Academy Kids computer" },
  { category: CATEGORIES.COOKING_FOOD, label: "Cooking", channel: "Nerdy Nummies", ages: fromEarly, q: "Nerdy Nummies kids" },
  { category: CATEGORIES.SPORTS_GAMES, label: "Sports", channel: "GoNoodle", ages: fromEarly, q: "GoNoodle" },
  { category: CATEGORIES.ENVIRONMENTAL_AWARENESS, label: "Nature care", channel: "SciShow Kids", ages: all, q: "SciShow Kids environment" },
  { category: CATEGORIES.HEALTH_MOVEMENT, label: "Exercise", channel: "GoNoodle", ages: all, kind: "exercise", q: "GoNoodle" },
  { category: CATEGORIES.SELF_DEFENSE, label: "Self-defense", channel: "Kids Academy", ages: older, kind: "defense", q: "body safety for kids" },
  { category: CATEGORIES.SELF_DEFENSE, label: "Body safety", channel: "Kids Academy", ages: [AGE_GROUPS.TODDLER, AGE_GROUPS.EARLY_LEARNER], kind: "defense", q: "body safety for kids" },
];

const LANG = {
  es: "en español", fr: "en français", de: "auf Deutsch", zh: "中文", ar: "بالعربية", hi: "हिंदी", pt: "em português", ja: "日本語", ru: "на русском", it: "in italiano", ko: "한국어", tr: "Türkçe", eu: "euskara", id: "bahasa Indonesia", pl: "po polsku", ur: "اردو",
};

export function topicSuggestions(languages, ageGroup) {
  const codes = [...new Set(["en", ...(languages || [])].map((code) => String(code).slice(0, 2).toLowerCase()))].filter(Boolean);
  return codes.flatMap((language) =>
    TOPICS.filter((topic) => topic.ages.includes(ageGroup)).map((topic) => ({
      name: language === "en" ? topic.channel || topic.label : `${topic.channel || topic.label}`,
      query: `${topic.q} ${language === "en" ? "" : LANG[language] || language}`.trim(),
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
