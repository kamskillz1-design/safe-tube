import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { CATEGORIES } from "@/domain/constants";
import { applyWhitelistGates } from "@/domain/gates";
import { listCustomChannels, listProfiles, putLibraryChannel, putLibraryVideos } from "@/adapters/localDb";
import { YoutubeApiError } from "@/adapters/youtubeClient";
import { youtubeSource } from "@/content/sources/youtubeSource";
import { muslimKidsPack, suggestionsFor } from "@/content/packs/muslimKids";
import { parseVideoId, youtubeErrorKey } from "@/content/parseVideoId";
import { addParentChannel } from "@/app/channelPacks";
import { nextChannelChoice } from "@/app/nextChoice";

const ISLAM_CATEGORY = muslimKidsPack.categoryId;
const LEVEL_LABELS = { letters: "Letters", qaida: "Qaida", reading: "Reading", tajweed: "Tajweed" };

async function storeUploads(channel, channelId, ageGroup) {
  const uploads = await youtubeSource.listUploads(channelId, 5);
  const gated = applyWhitelistGates(uploads, ageGroup);
  const now = new Date().toISOString();
  if (gated.length) {
    await putLibraryVideos(gated.map((video) => ({
      id: video.id,
      title: video.title,
      description: video.description,
      channelId: video.channelId,
      channelTitle: video.channelTitle || channel.name,
      category: CATEGORIES.EMOTIONAL_INTELLIGENCE,
      ageGroup,
      language: (video.language || "en").slice(0, 2).toLowerCase(),
      durationSeconds: video.durationSeconds,
      viewCount: video.viewCount,
      thumbnail: video.thumbnail,
      approved: true,
      addedAt: now,
      sourceChannelId: channelId,
    })));
  }
  await putLibraryChannel({
    channelId,
    name: channel.name,
    ageGroup,
    categories: [CATEGORIES.EMOTIONAL_INTELLIGENCE],
    language: "en",
    isDefaultTrusted: false,
    active: true,
    reviewedAt: now,
    source: "parent",
  });
}

export default function MuslimKidsPanel({ t, onChanged }) {
  const [profiles, setProfiles] = useState([]);
  const [profileId, setProfileId] = useState(null);
  const [addedNames, setAddedNames] = useState([]);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [videoInput, setVideoInput] = useState("");
  const [extras, setExtras] = useState([]);
  const [alsoChannel, setAlsoChannel] = useState(true);

  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0] ?? null;
  const ageGroup = profile?.ageGroup;
  const suggestions = profile ? [...extras, ...suggestionsFor(profile, [...addedNames, ...extras.map((row) => row.name)], 5)] : extras;

  const refresh = async () => {
    const [nextProfiles, channels] = await Promise.all([listProfiles(), listCustomChannels()]);
    setProfiles(nextProfiles);
    setAddedNames(channels.filter((row) => row.status === "approved").map((row) => row.name));
  };

  useEffect(() => {
    refresh();
  }, []);

  const addPackChannel = async (channel) => {
    if (!ageGroup) return;
    setBusy(channel.name);
    setNotice(null);
    try {
      const resolved = await youtubeSource.resolveChannel(channel.query);
      const channelId = resolved?.channelId;
      if (!channelId) {
        setNotice({ type: "error", key: "curator.errorNotFound" });
        return;
      }
      await addParentChannel({ ageGroup, nativeLanguage: "en" }, {
        name: channel.name,
        channelId,
        ageGroup,
        language: "en",
        primaryCategoryId: ISLAM_CATEGORY,
        categoryIds: [ISLAM_CATEGORY],
        categories: [CATEGORIES.EMOTIONAL_INTELLIGENCE],
        status: "approved",
      });
      await storeUploads(channel, channelId, ageGroup);
      const next = await nextChannelChoice({
        ageGroup,
        language: "en",
        category: CATEGORIES.EMOTIONAL_INTELLIGENCE,
        exclude: [...addedNames, channel.name],
      });
      if (next) setExtras((current) => [{ name: next.title, query: next.title, channelId: next.channelId }, ...current.filter((row) => row.name !== channel.name)]);
      setNotice({ type: "ok", key: "curator.muslimAdded", params: { name: channel.name } });
      await refresh();
      onChanged?.();
    } catch (error) {
      setNotice({ type: "error", key: youtubeErrorKey(error instanceof YoutubeApiError ? error : null) });
    } finally {
      setBusy(null);
    }
  };

  const addVideo = async (event) => {
    event.preventDefault();
    if (!ageGroup) return;
    setNotice(null);
    const videoId = parseVideoId(videoInput);
    if (!videoId) {
      setNotice({ type: "error", key: "curator.videoBad" });
      return;
    }
    setBusy("video");
    try {
      const video = await youtubeSource.getVideo(videoId);
      const now = new Date().toISOString();
      await putLibraryVideos([{
        id: video.id,
        title: video.title,
        description: video.description,
        channelId: video.channelId,
        channelTitle: video.channelTitle,
        category: CATEGORIES.EMOTIONAL_INTELLIGENCE,
        ageGroup,
        language: (video.language || "en").slice(0, 2).toLowerCase(),
        durationSeconds: video.durationSeconds,
        viewCount: video.viewCount,
        thumbnail: video.thumbnail,
        approved: true,
        addedAt: now,
        sourceChannelId: video.channelId,
      }]);
      if (alsoChannel && video.channelId) {
        const existing = await listCustomChannels();
        if (!existing.some((row) => row.channelId === video.channelId && row.ageGroup === ageGroup)) {
          await addParentChannel({ ageGroup, nativeLanguage: "en" }, {
            name: video.channelTitle || "Parent channel",
            channelId: video.channelId,
            ageGroup,
            language: "en",
            primaryCategoryId: ISLAM_CATEGORY,
            categoryIds: [ISLAM_CATEGORY],
            categories: [CATEGORIES.EMOTIONAL_INTELLIGENCE],
            status: "approved",
          });
        }
      }
      setVideoInput("");
      setNotice({ type: "ok", key: "curator.videoAdded", params: { title: video.title } });
      await refresh();
      onChanged?.();
    } catch (error) {
      setNotice({ type: "error", key: youtubeErrorKey(error instanceof YoutubeApiError ? error : null) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-6 rounded-3xl border border-border bg-card p-6">
      <div>
        <h2 className="font-heading text-xl font-bold">{t("curator.muslimTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">Suggestions follow the child's Quran reading level, including beginner Qaida for an older child. Adding one replaces it. Paste your own channel below.</p>
      </div>
      {profiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {profiles.map((item) => (
            <button key={item.id} type="button" onClick={() => setProfileId(item.id)} className={`h-11 rounded-full border-2 px-4 text-sm font-semibold ${profile?.id === item.id ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
              {item.childName}
            </button>
          ))}
        </div>
      )}
      {suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No more suggestions for this level. Paste your own channel below.</p>
      ) : (
        <ul className="divide-y divide-border">
          {suggestions.map((channel) => (
            <li key={channel.name} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold">{channel.name}</p>
                {channel.level && <p className="text-xs text-muted-foreground">{LEVEL_LABELS[channel.level]}</p>}
              </div>
              <button type="button" disabled={busy === channel.name} onClick={() => addPackChannel(channel)} className="flex h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {busy === channel.name ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t("curator.add")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={addVideo} className="space-y-3 border-t border-border pt-4">
        <h3 className="font-heading text-lg font-bold">{t("curator.videoTitle")}</h3>
        <p className="text-sm text-muted-foreground">{t("curator.videoText")}</p>
        <input value={videoInput} onChange={(e) => setVideoInput(e.target.value)} placeholder={t("curator.videoPlaceholder")} className="h-12 w-full rounded-xl border border-input bg-background px-4" />
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={alsoChannel} onChange={(e) => setAlsoChannel(e.target.checked)} />
          {t("curator.videoAlsoChannel")}
        </label>
        <button type="submit" disabled={busy === "video" || !ageGroup} className="flex h-12 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50">
          {busy === "video" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
          {t("curator.add")}
        </button>
      </form>
      {notice && <p className={`text-sm font-medium ${notice.type === "error" ? "text-destructive" : "text-primary"}`}>{t(notice.key, notice.params)}</p>}
    </section>
  );
}
