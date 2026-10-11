// Custom Curator Portal: parents paste YouTube channel URLs/IDs to expand the
// age-group feed, pick a category folder (including faith branches), and set language.
import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { ALL_AGE_GROUPS, LANGUAGES, CATEGORIES } from "@/domain/constants";
import { useI18n } from "@/lib/i18n";
import { listCustomChannels, deleteCustomChannel } from "@/adapters/localDb";
import { resolveChannels, YoutubeApiError } from "@/adapters/youtubeClient";
import { loadCategoryTree } from "@/app/categories";
import { addParentChannel } from "@/app/channelPacks";
import { legacyCategoryToId, idToLegacyCategory } from "@/domain/categories";
import VerifiedChannelsPanel from "@/components/dashboard/VerifiedChannelsPanel";
import CategoryTreeManager from "@/components/dashboard/CategoryTreeManager";
import ChannelPackPanel from "@/components/dashboard/ChannelPackPanel";
import MuslimKidsPanel from "@/components/dashboard/MuslimKidsPanel";
import TopicSuggestionsPanel from "@/components/dashboard/TopicSuggestionsPanel";
import CategoryPicker, { categoryPathLabel } from "@/components/dashboard/CategoryPicker";

const parseChannelInput = (input) => {
  const value = input.trim();
  const idMatch = value.match(/(UC[\w-]{20,})/);
  if (idMatch) return { channelId: idMatch[1] };
  const handleMatch = value.match(/@([\w.-]+)/);
  if (handleMatch) return { handle: handleMatch[1] };
  return null;
};

export default function CuratorPortal() {
  const { t } = useI18n();
  const [ageGroup, setAgeGroup] = useState(ALL_AGE_GROUPS[0]);
  const [channelInput, setChannelInput] = useState("");
  const [tree, setTree] = useState([]);
  const [categoryId, setCategoryId] = useState(legacyCategoryToId(CATEGORIES.STEM));
  const [language, setLanguage] = useState("en");
  const [channelNotice, setChannelNotice] = useState(null);
  const [adding, setAdding] = useState(false);
  const [channels, setChannels] = useState([]);

  const refresh = async () => {
    setChannels(await listCustomChannels());
    setTree(await loadCategoryTree());
  };

  useEffect(() => {
    refresh();
  }, []);

  const addChannel = async (event) => {
    event.preventDefault();
    setChannelNotice(null);
    const parsed = parseChannelInput(channelInput);
    if (!parsed) {
      setChannelNotice({ type: "error", key: "curator.errorParse" });
      return;
    }
    setAdding(true);
    try {
      let channelId = parsed.channelId ?? null;
      let name = parsed.handle ?? "Parent channel";
      if (!channelId) {
        const [resolved] = await resolveChannels([parsed.handle]);
        channelId = resolved?.channelId ?? null;
        name = resolved?.title || name;
      }
      if (!channelId) {
        setChannelNotice({ type: "error", key: "curator.errorNotFound" });
        return;
      }
      const legacy = idToLegacyCategory(categoryId);
      await addParentChannel(
        { ageGroup, nativeLanguage: language },
        {
          name,
          channelId,
          ageGroup,
          language,
          primaryCategoryId: categoryId,
          categoryIds: [categoryId],
          categories: legacy ? [legacy] : [],
          status: "approved",
        }
      );
      setChannelInput("");
      setChannelNotice({ type: "ok", key: "curator.added", params: { name } });
      await refresh();
    } catch (error) {
      setChannelNotice({
        type: "error",
        key:
          error instanceof YoutubeApiError && error.code === "MISSING_API_KEY"
            ? "curator.noKey"
            : "curator.errorGeneric",
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-10">
      <section className="space-y-4 rounded-3xl border border-border bg-card p-6">
        <h2 className="font-heading text-xl font-bold">{t("curator.addTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("curator.addText")}</p>
        <div className="flex flex-wrap gap-3">
          {ALL_AGE_GROUPS.map((group) => (
            <button
              key={group}
              type="button"
              onClick={() => setAgeGroup(group)}
              className={`h-12 rounded-full border-2 px-4 text-sm font-semibold ${
                ageGroup === group ? "border-primary bg-primary/10 text-primary" : "border-border"
              }`}
            >
              {t(`ageGroup.${group}`)}
            </button>
          ))}
        </div>
        <form onSubmit={addChannel} className="flex flex-col gap-3">
          <input
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            placeholder={t("curator.placeholder")}
            className="h-12 w-full rounded-xl border border-input bg-background px-4"
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <CategoryPicker tree={tree} value={categoryId} onChange={setCategoryId} t={t} />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-12 rounded-xl border border-input bg-background px-3 text-sm"
            >
              {LANGUAGES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.nativeName}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={adding}
              className="flex h-12 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-50"
            >
              {adding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />} {t("curator.add")}
            </button>
          </div>
        </form>
        {channelNotice && (
          <p className={`text-sm font-medium ${channelNotice.type === "error" ? "text-destructive" : "text-primary"}`}>
            {t(channelNotice.key, channelNotice.params)}
          </p>
        )}
      </section>
      <TopicSuggestionsPanel t={t} onChanged={refresh} />
      <MuslimKidsPanel t={t} ageGroup={ageGroup} onChanged={refresh} />
      {channels.length > 0 && (
        <section className="space-y-4 rounded-3xl border border-border bg-card p-6">
          <h2 className="font-heading text-xl font-bold">Channels you added</h2>
          <ul className="divide-y divide-border">
            {channels.map((channel) => (
              <li key={channel.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="break-words font-semibold">{channel.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`ageGroup.${channel.ageGroup}`)}
                    {" · "}
                    {(channel.nativeLanguage || "en").toUpperCase()}
                    {channel.primaryCategoryId
                      ? ` · ${categoryPathLabel(tree, channel.primaryCategoryId, t)}`
                      : channel.categories?.[0]
                        ? ` · ${t(`category.${channel.categories[0]}`)}`
                        : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteCustomChannel(channel.id).then(refresh)}
                  aria-label={t("curator.removeChannel", { name: channel.name })}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <CategoryTreeManager t={t} />
      <ChannelPackPanel t={t} />
      <VerifiedChannelsPanel ageGroup={ageGroup} />
    </div>
  );
}
