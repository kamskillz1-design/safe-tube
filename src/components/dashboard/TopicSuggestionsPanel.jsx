import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { listProfiles, listCustomChannels, putLibraryVideos } from "@/adapters/localDb";
import { YoutubeApiError, fetchChannelUploads } from "@/adapters/youtubeClient";
import { youtubeSource } from "@/content/sources/youtubeSource";
import { topicSuggestions, exerciseSuggestions } from "@/content/packs/topicSuggestions";
import { addParentChannel } from "@/app/channelPacks";
import { nextChannelChoice } from "@/app/nextChoice";
import { applyWhitelistGates } from "@/domain/gates";
import { CATEGORIES, EDUCATIONAL_CATEGORIES, LANGUAGES } from "@/domain/constants";

async function storeUploads(channelId, name, ageGroup, language, category) {
  const uploads = await fetchChannelUploads(channelId, 5);
  const gated = applyWhitelistGates(uploads, ageGroup);
  if (!gated.length) return 0;
  const now = new Date().toISOString();
  await putLibraryVideos(gated.map((video) => ({
    id: video.id,
    title: video.title,
    description: video.description,
    channelId: video.channelId,
    channelTitle: video.channelTitle || name,
    category: category || CATEGORIES.STEM,
    ageGroup,
    language: (video.language || language || "en").slice(0, 2).toLowerCase() || "en",
    durationSeconds: video.durationSeconds,
    viewCount: video.viewCount,
    thumbnail: video.thumbnail,
    approved: true,
    addedAt: now,
    sourceChannelId: channelId,
  })));
  return gated.length;
}

export default function TopicSuggestionsPanel({ t, onChanged }) {
  const [profiles, setProfiles] = useState([]);
  const [profileId, setProfileId] = useState(null);
  const [added, setAdded] = useState([]);
  const [replacements, setReplacements] = useState({});
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);

  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0] ?? null;
  const languages = [...new Set(["en", ...(profile?.targetLanguages || [])].map((code) => String(code).slice(0, 2).toLowerCase()))];
  const taken = new Set(added.map((name) => name.toLowerCase()));
  const base = profile
    ? [...exerciseSuggestions(profile.ageGroup), ...topicSuggestions(languages, profile.ageGroup)]
    : [];
  const slots = EDUCATIONAL_CATEGORIES.flatMap((category) => languages.map((language) => {
    const key = `${category}:${language}`;
    const existing = base.find((row) => row.category === category && row.language === language && !taken.has(row.name.toLowerCase()));
    const replacement = replacements[key];
    const row = replacement || existing || {
      name: `${category.replaceAll("_", " ")} (${language.toUpperCase()})`,
      query: `${category.replaceAll("_", " ")} for kids`,
      language,
      category,
      kind: "topic",
    };
    return { ...row, key };
  })).filter((row) => !taken.has(row.name.toLowerCase()));

  const refresh = async () => {
    const [nextProfiles, channels] = await Promise.all([listProfiles(), listCustomChannels()]);
    setProfiles(nextProfiles);
    setAdded(channels.map((row) => row.name));
  };

  useEffect(() => {
    refresh();
  }, []);

  const add = async (row) => {
    setBusy(row.key);
    setNotice(null);
    try {
      const resolved = row.channelId
        ? { channelId: row.channelId, title: row.name }
        : await youtubeSource.resolveChannel(row.query || row.name);
      if (!resolved?.channelId) {
        setNotice("That suggestion could not be found. Paste the channel below.");
        return;
      }
      await addParentChannel({ ageGroup: profile.ageGroup, nativeLanguage: row.language }, {
        name: resolved.title || row.name,
        channelId: resolved.channelId,
        ageGroup: profile.ageGroup,
        language: row.language,
        primaryCategoryId: "cat_faith",
        categoryIds: ["cat_faith"],
        categories: [row.category || CATEGORIES.STEM],
        status: "approved",
      });
      const stored = await storeUploads(resolved.channelId, resolved.title || row.name, profile.ageGroup, row.language, row.category);
      const exclude = [...added, resolved.title || row.name];
      const next = await nextChannelChoice({
        ageGroup: profile.ageGroup,
        language: row.language,
        category: row.category,
        exclude,
      });
      setReplacements((current) => ({
        ...current,
        [row.key]: next
          ? { name: next.title, query: next.title, channelId: next.channelId, language: row.language, category: row.category, kind: row.kind }
          : null,
      }));
      setNotice(`${resolved.title || row.name} was added${stored ? ` with ${stored} videos` : ""}. A new choice is in its place.`);
      await refresh();
      onChanged?.();
    } catch (error) {
      setNotice(error instanceof YoutubeApiError ? error.message : "Could not add that channel.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-6">
      <h2 className="font-heading text-xl font-bold">Channel choices</h2>
      <p className="text-sm text-muted-foreground">One choice for every category and language for this child's age. Adding a channel replaces it with another channel that passes the same safety rules.</p>
      <div className="flex flex-wrap gap-2">
        {profiles.map((item) => (
          <button key={item.id} type="button" onClick={() => setProfileId(item.id)} className={`h-11 rounded-full border-2 px-4 text-sm font-semibold ${profile?.id === item.id ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
            {item.childName}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-border">
        {slots.map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="font-semibold">{row.name}</p>
              <p className="text-xs text-muted-foreground">{LANGUAGES.find((language) => language.code === row.language)?.nativeName || row.language.toUpperCase()} · {String(row.category).replaceAll("_", " ")}</p>
            </div>
            <button type="button" disabled={busy === row.key} onClick={() => add(row)} className="flex h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {busy === row.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("curator.add")}
            </button>
          </li>
        ))}
      </ul>
      {notice && <p className="text-sm font-medium text-primary">{notice}</p>}
    </section>
  );
}
