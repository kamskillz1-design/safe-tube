const row = (id, title, channelTitle, category, categoryId, durationSeconds) => ({
  id,
  title,
  description: "",
  channelId: "",
  channelTitle,
  category,
  categoryId,
  language: "en",
  durationSeconds,
  viewCount: 0,
  thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
  approved: true,
});

export const STARTER_VIDEOS = [
  row("bcVr13Fw7w8", "Why Is the Sky Blue? | Physics for Kids", "SciShow Kids", "STEM", "cat_stem", 170),
  row("ehUIlhKhzDA", "Why Is the Sky Blue?", "NASA Space Place", "STEM", "cat_stem", 169),
  row("5Za4VXhsdUE", "How To Draw A Red Panda Drinking Boba", "Art for Kids Hub", "Arts", "cat_arts", 397),
  row("fGqtZbdjhNU", "How To Draw A Cartoon Turtle", "Art for Kids Hub", "Arts", "cat_arts", 561),
  row("UW6H5dAPuhY", "How To Draw A Cute Ice Cream Cone", "Art for Kids Hub", "Arts", "cat_arts", 213),
  row("ZxfJicfyCdg", "Sesame Street: Name That Emotion with Murray!", "Sesame Street", "Emotional_Intelligence", "cat_emotional_intelligence", 322),
  row("Gdw19ZFGy-A", "Feelings in My Body", "Sesame Workshop", "Emotional_Intelligence", "cat_emotional_intelligence", 100),
  row("wP_IbZSxhEs", "What is a Community? | Social Studies for Kindergarten", "Kids Academy", "Literacy_Language", "cat_literacy_language", 138),
  row("QKteCYr5uuI", "Elephants and How to Save Them", "Nat Geo Kids", "Nature_Animals", "cat_nature_animals", 221),
  row("Fk3VdpuFx0Q", "African Elephant | Amazing Animals", "Nat Geo Kids", "Nature_Animals", "cat_nature_animals", 76),
  row("jt2q1cHsH6E", "Community Helpers for Kids", "Kids Academy", "Life_Skills", "cat_life_skills", 258),
  row("YRxNQPmj1-8", "Urban, Suburban and Rural Areas for Kids", "Homeschool Pop", "Geography", "cat_geography", 562),
  row("Wg9aToJKjho", "Body Safety for Kids | Safe and Unsafe Touch", "Rainbow Kiddies", "Self_Defense", "cat_self_defense", 325),
  row("PJKoGkmtNyI", "My Body Belongs to Me | Body Safety Song", "Miss Annette's Preschool", "Self_Defense", "cat_self_defense", 654),
  row("a-5mdt9YN6I", "My Body Belongs To Me", "CultureOfSilenceFilm", "Self_Defense", "cat_self_defense", 257),
  row("lGC0cbB0NAM", "My Body Is My Body Song", "MBIMB", "Self_Defense", "cat_self_defense", 192),
];

export function startersFor(ageGroup, categoryId) {
  return STARTER_VIDEOS.filter((video) => !categoryId || video.categoryId === categoryId).map((video) => ({
    ...video,
    ageGroup,
  }));
}
