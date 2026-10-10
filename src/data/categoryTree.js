import { CATEGORIES } from "@/domain/constants";

export const FAITH_ROOT_ID = "cat_faith";
export const CATEGORY_SCHEMA_VERSION = 1;

const node = (id, parentId, slug, nameKey, extra = {}) => ({
  id,
  parentId,
  slug,
  nameKey,
  customName: null,
  kind: "system",
  facet: extra.facet ?? (parentId === FAITH_ROOT_ID || extra.faith ? "faith" : "subject"),
  tokenBucket: extra.tokenBucket ?? null,
  sortOrder: extra.sortOrder ?? 0,
  icon: extra.icon ?? null,
  ownerProfileId: null,
  hidden: false,
});

const subject = (legacy, nameKey, sortOrder, tokenBucket = "educational") =>
  node(`cat_${legacy.toLowerCase()}`, null, legacy, nameKey, { sortOrder, tokenBucket, facet: "subject" });

export const LEGACY_CATEGORY_TO_ID = {
  [CATEGORIES.STEM]: "cat_stem",
  [CATEGORIES.ARTS]: "cat_arts",
  [CATEGORIES.EMOTIONAL_INTELLIGENCE]: "cat_emotional_intelligence",
  [CATEGORIES.LITERACY_LANGUAGE]: "cat_literacy_language",
  [CATEGORIES.NATURE_ANIMALS]: "cat_nature_animals",
  [CATEGORIES.LIFE_SKILLS]: "cat_life_skills",
  [CATEGORIES.HEALTH_MOVEMENT]: "cat_health_movement",
  [CATEGORIES.WORLD_CULTURES]: "cat_world_cultures",
  [CATEGORIES.HISTORY]: "cat_history",
  [CATEGORIES.GEOGRAPHY]: "cat_geography",
  [CATEGORIES.CODING_TECHNOLOGY]: "cat_coding_technology",
  [CATEGORIES.AI]: "cat_ai",
  [CATEGORIES.FILM_MAKING]: "cat_film_making",
  [CATEGORIES.DIGITAL_SKILLS]: "cat_digital_skills",
  [CATEGORIES.IQRA]: "cat_iqra",
  [CATEGORIES.COOKING_FOOD]: "cat_cooking_food",
  [CATEGORIES.SPORTS_GAMES]: "cat_sports_games",
  [CATEGORIES.ENVIRONMENTAL_AWARENESS]: "cat_environmental_awareness",
  [CATEGORIES.SELF_DEFENSE]: "cat_self_defense",
  [CATEGORIES.WHOLESOME_ENTERTAINMENT]: "cat_wholesome_entertainment",
};

export const ID_TO_LEGACY_CATEGORY = Object.fromEntries(
  Object.entries(LEGACY_CATEGORY_TO_ID).map(([legacy, id]) => [id, legacy])
);

export function systemCategoryTree() {
  const subjects = [
    subject(CATEGORIES.IQRA, "category.IQRA", 4),
    node("cat_iqra_letters", "cat_iqra", "Letters", "category.iqra.letters", { sortOrder: 10 }),
    node("cat_iqra_qaida", "cat_iqra", "Qaida", "category.iqra.qaida", { sortOrder: 20 }),
    node("cat_iqra_reading", "cat_iqra", "Reading", "category.iqra.reading", { sortOrder: 30 }),
    node("cat_iqra_tajweed", "cat_iqra", "Tajweed", "category.iqra.tajweed", { sortOrder: 40 }),
    subject(CATEGORIES.STEM, "category.STEM", 10),
    subject(CATEGORIES.ARTS, "category.Arts", 20),
    subject(CATEGORIES.EMOTIONAL_INTELLIGENCE, "category.Emotional_Intelligence", 30),
    subject(CATEGORIES.LITERACY_LANGUAGE, "category.Literacy_Language", 40),
    subject(CATEGORIES.NATURE_ANIMALS, "category.Nature_Animals", 50),
    subject(CATEGORIES.LIFE_SKILLS, "category.Life_Skills", 60),
    subject(CATEGORIES.HEALTH_MOVEMENT, "category.Health_Movement", 70),
    subject(CATEGORIES.SELF_DEFENSE, "category.Self_Defense", 75),
    subject(CATEGORIES.HISTORY, "category.History", 90),
    subject(CATEGORIES.GEOGRAPHY, "category.Geography", 100),
    subject(CATEGORIES.CODING_TECHNOLOGY, "category.Coding_Technology", 110),
    subject(CATEGORIES.AI, "category.AI", 112),
    subject(CATEGORIES.FILM_MAKING, "category.Film_Making", 114),
    subject(CATEGORIES.DIGITAL_SKILLS, "category.Digital_Skills", 116),
    subject(CATEGORIES.COOKING_FOOD, "category.Cooking_Food", 120),
    subject(CATEGORIES.SPORTS_GAMES, "category.Sports_Games", 130),
    subject(CATEGORIES.ENVIRONMENTAL_AWARENESS, "category.Environmental_Awareness", 140),
    subject(CATEGORIES.WORLD_CULTURES, "category.World_Cultures", 150),
    subject(CATEGORIES.WHOLESOME_ENTERTAINMENT, "category.Wholesome_Entertainment", 160, "entertainment"),
  ];

  const faith = [
    node(FAITH_ROOT_ID, null, "Faith_Values", "category.faith", { facet: "faith", tokenBucket: "educational", sortOrder: 5 }),
    node("cat_islam", FAITH_ROOT_ID, "Islam", "category.faith.islam", { faith: true, sortOrder: 10 }),
    node("cat_islam_sunni", "cat_islam", "Sunni", "category.faith.islam.sunni", { faith: true, sortOrder: 10 }),
    node("cat_islam_sunni_hanafi", "cat_islam_sunni", "Hanafi", "category.faith.islam.sunni.hanafi", { faith: true, sortOrder: 10 }),
    node("cat_islam_sunni_maliki", "cat_islam_sunni", "Maliki", "category.faith.islam.sunni.maliki", { faith: true, sortOrder: 20 }),
    node("cat_islam_sunni_shafii", "cat_islam_sunni", "Shafii", "category.faith.islam.sunni.shafii", { faith: true, sortOrder: 30 }),
    node("cat_islam_sunni_hanbali", "cat_islam_sunni", "Hanbali", "category.faith.islam.sunni.hanbali", { faith: true, sortOrder: 40 }),
    node("cat_islam_sunni_salafi", "cat_islam_sunni", "Salafi", "category.faith.islam.sunni.salafi", { faith: true, sortOrder: 45 }),
    node("cat_islam_sunni_wahabi", "cat_islam_sunni", "Wahabi", "category.faith.islam.sunni.wahabi", { faith: true, sortOrder: 46 }),
    node("cat_islam_sunni_other", "cat_islam_sunni", "Other_Sunni", "category.faith.islam.sunni.other", { faith: true, sortOrder: 50 }),
    node("cat_islam_shia", "cat_islam", "Shia", "category.faith.islam.shia", { faith: true, sortOrder: 20 }),
    node("cat_islam_shia_twelver", "cat_islam_shia", "Twelver", "category.faith.islam.shia.twelver", { faith: true, sortOrder: 10 }),
    node("cat_islam_shia_ismaili", "cat_islam_shia", "Ismaili", "category.faith.islam.shia.ismaili", { faith: true, sortOrder: 20 }),
    node("cat_islam_shia_zaydi", "cat_islam_shia", "Zaydi", "category.faith.islam.shia.zaydi", { faith: true, sortOrder: 30 }),
    node("cat_islam_shia_other", "cat_islam_shia", "Other_Shia", "category.faith.islam.shia.other", { faith: true, sortOrder: 40 }),
    node("cat_islam_other", "cat_islam", "Other_Islam", "category.faith.islam.other", { faith: true, sortOrder: 30 }),
  ];

  return [...subjects, ...faith];
}
