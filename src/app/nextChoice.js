import { CATEGORIES, LANGUAGES } from "@/domain/constants";
import { passesKeywordBlocker } from "@/domain/gates";
import { safeQuery } from "@/domain/safety";
import { suggestChannels } from "@/adapters/youtubeClient";

const AGE_HINT = {
  toddler_2_4: "toddlers",
  early_learner_5_7: "kids age 5",
  tween_8_12: "kids age 9",
  teen_13_16: "teens",
};

const LANG_HINT = Object.fromEntries(LANGUAGES.map((language) => [language.code, language.nativeName]));

export function choiceQuery(category, ageGroup, language) {
  const label = String(category || "learning").replaceAll("_", " ");
  const age = AGE_HINT[ageGroup] || "kids";
  const hint = !language || language === "en" ? "" : ` ${LANG_HINT[language] || language}`;
  return safeQuery(`${label} for ${age}${hint}`) || safeQuery(`${label} for kids`);
}

export async function nextChannelChoice({ ageGroup, language = "en", category = CATEGORIES.STEM, exclude = [] }) {
  const taken = new Set(exclude.map((name) => String(name || "").toLowerCase()));
  const query = choiceQuery(category, ageGroup, language);
  if (!query) return null;
  const found = await suggestChannels(query, language);
  return (
    found.find((channel) => {
      const name = channel.title || channel.name;
      if (!channel.channelId || !name || taken.has(name.toLowerCase())) return false;
      return passesKeywordBlocker({ title: name, description: channel.description || query });
    }) || null
  );
}
