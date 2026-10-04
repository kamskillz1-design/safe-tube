import { useEffect, useState } from "react";
import { Eye, EyeOff, Plus, Loader2 } from "lucide-react";
import { listProfiles } from "@/adapters/localDb";
import { defaultTrustedChannels } from "@/app/library";
import {
  hideDefaultChannel,
  restoreDefaultChannel,
  loadOverlays,
  isChannelHidden,
  listSuggestionsFor,
  acceptSuggestion,
} from "@/app/channelPacks";
import { loadCategoryTree } from "@/app/categories";
import { categoryPathLabel } from "@/components/dashboard/CategoryPicker";
import { LANGUAGES } from "@/domain/constants";
import { nextChannelChoice } from "@/app/nextChoice";

export default function ChannelPackPanel({ t }) {
  const [profiles, setProfiles] = useState([]);
  const [profileId, setProfileId] = useState(null);
  const [defaults, setDefaults] = useState([]);
  const [overlays, setOverlays] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [tree, setTree] = useState([]);
  const [busy, setBusy] = useState(null);

  const profile = profiles.find((p) => p.id === profileId) ?? profiles[0] ?? null;

  const refresh = async (nextProfiles = profiles) => {
    const list = nextProfiles.length ? nextProfiles : await listProfiles();
    setProfiles(list);
    const current = list.find((p) => p.id === profileId) ?? list[0] ?? null;
    if (current && current.id !== profileId) setProfileId(current.id);
    setDefaults(await defaultTrustedChannels());
    setOverlays(await loadOverlays());
    setTree(await loadCategoryTree());
    if (current) setSuggestions(await listSuggestionsFor(current, null));
  };

  useEffect(() => {
    refresh([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile) listSuggestionsFor(profile, null).then(setSuggestions);
  }, [profileId]);

  if (!profiles.length) {
    return (
      <section className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-heading text-xl font-bold">{t("packs.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("packs.needProfile")}</p>
      </section>
    );
  }

  const english = defaults.filter((c) => (c.nativeLanguage || "en") === "en");

  return (
    <section className="space-y-6 rounded-3xl border border-border bg-card p-6">
      <div>
        <h2 className="font-heading text-xl font-bold">{t("packs.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("packs.text")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {profiles.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setProfileId(item.id)}
            className={`h-11 rounded-full border-2 px-4 text-sm font-semibold ${
              profile?.id === item.id ? "border-primary bg-primary/10 text-primary" : "border-border"
            }`}
          >
            {item.childName}
          </button>
        ))}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{t("packs.englishDefaults")}</h3>
        <ul className="divide-y divide-border">
          {english.slice(0, 40).map((channel) => {
            const key = channel.channelId || channel.name;
            const hidden = profile ? isChannelHidden(overlays, profile.id, key, "en") : false;
            return (
              <li key={`${key}:${channel.ageGroup}`} className="flex items-center justify-between gap-3 py-2">
                <p className={`text-sm font-medium ${hidden ? "text-muted-foreground line-through" : ""}`}>
                  {channel.name}
                </p>
                {profile && (
                  <button
                    type="button"
                    disabled={busy === key}
                    onClick={async () => {
                      setBusy(key);
                      if (hidden) await restoreDefaultChannel(profile.id, key, "en");
                      else await hideDefaultChannel(profile.id, key, "en");
                      setOverlays(await loadOverlays());
                      setBusy(null);
                    }}
                    className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold"
                  >
                    {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {hidden ? t("curator.restore") : t("packs.hide")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{t("packs.suggestions")}</h3>
        {suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("packs.noSuggestions")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {suggestions.map((row) => {
              const key = row.channelId || row.name;
              const langName = LANGUAGES.find((l) => l.code === row.language)?.nativeName || row.language;
              return (
                <li key={`${row.language}:${key}`} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {langName}
                      {row.primaryCategoryId ? ` · ${categoryPathLabel(tree, row.primaryCategoryId, t)}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === key}
                    onClick={async () => {
                      setBusy(key);
                      await acceptSuggestion(profile, row);
                      const next = await nextChannelChoice({
                        ageGroup: profile.ageGroup,
                        language: row.language,
                        category: row.primaryCategoryId || "STEM",
                        exclude: suggestions.map((item) => item.name),
                      });
                      const remaining = (await listSuggestionsFor(profile, null)).filter((item) => item.name !== row.name);
                      setSuggestions(next ? [{ ...row, name: next.title, channelId: next.channelId }, ...remaining] : remaining);
                      setBusy(null);
                    }}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground"
                  >
                    {busy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    {t("packs.add")}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
