import { useEffect, useRef, useState } from "react";
import { systemCategoryTree } from "@/data/categoryTree";
import { idToLegacyCategory } from "@/domain/categories";
import CategoryBrowse, { videosInCategory } from "@/components/CategoryBrowse";
import { loadCategoryVideos, fillMissingCategories } from "@/app/categoryLoad";
import { startSlowInflow } from "@/app/inflow";
import { IQRA_LEVELS, iqraQuery } from "@/content/packs/iqra";

const IQRA = "cat_iqra";
const memoryKey = (ageGroup) => `safe-tube-choice:${ageGroup || "all"}`;
const seenKey = (ageGroup) => `safe-tube-seen:${ageGroup || "all"}`;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}
function shuffleFresh(videos, seen) {
  const fresh = videos.filter((video) => !seen.includes(video.id));
  const repeated = videos.filter((video) => seen.includes(video.id));
  const mix = (list) => [...list].sort(() => Math.random() - 0.5);
  return [...mix(fresh), ...mix(repeated)];
}
function unique(videos) {
  return videos.filter((video, index, list) => list.findIndex((item) => item.id === video.id) === index);
}
function forLanguage(videos, language) {
  if (!language || language === "en") return videos;
  const matched = videos.filter((video) => (video.language || "en") === language && !video.languageFallback);
  if (matched.length) return matched;
  return videos.filter((video) => video.languageFallback || (video.language || "en") === "en");
}

export default function WatchFolderBar({ videos, ageGroup, languages = ["en"], readingLevel = "letters", onFilter, t, hideSuggestions = false, onSuggestionsChange }) {
  const [tree] = useState(() => systemCategoryTree().filter((node) => !node.hidden));
  const [selectedId, setSelectedId] = useState(() => readJson(memoryKey(ageGroup), {}).categoryId || null);
  const [extra, setExtra] = useState([]);
  const [notice, setNotice] = useState("Videos for this category will load over time.");
  const [instruction, setInstruction] = useState(() => readJson(memoryKey(ageGroup), {}).language || languages[0] || "en");
  const [suggestions, setSuggestions] = useState([]);
  const group = ageGroup || videos[0]?.ageGroup;
  const iqraOpen = selectedId === IQRA || selectedId?.startsWith("cat_iqra_");
  const choices = [...new Set((languages.length ? languages : ["en"]).map((code) => String(code).slice(0, 2).toLowerCase()))];

  const remember = (categoryId, language, list) => {
    localStorage.setItem(memoryKey(group), JSON.stringify({ categoryId, language }));
    const scoped = forLanguage(list, language);
    setSuggestions(scoped.slice(0, 8));
    if (scoped.length) onFilter(scoped);
  };

  useEffect(() => {
    if (!group) return undefined;
    let stopped = false;
    setNotice("Loading videos for every category. They stay on this device.");
    fillMissingCategories({
      ageGroup: group,
      languages: choices,
      tree,
      existing: [...videos, ...extra],
      onBatch: (rows) => {
        if (stopped) return;
        setExtra((current) => unique([...current, ...rows]));
        setNotice("Videos are loading for the other categories.");
      },
      shouldStop: () => stopped,
    }).then(() => {
      if (!stopped) setNotice("Every category has been checked.");
    });
    return () => { stopped = true; };
    // Fill once per age and language set. Category clicks still load immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, choices.join("|")]);

  useEffect(() => {
    if (!group) return undefined;
    return startSlowInflow({
      ageGroup: group,
      language: instruction,
      onVideos: (rows) => {
        const scoped = forLanguage(videosInCategory(rows, tree, selectedId), instruction);
        setExtra((current) => unique([...current, ...rows]));
        if (scoped.length) setSuggestions((current) => unique([...scoped, ...current]).slice(0, 8));
        setNotice("New videos are arriving slowly.");
      },
    });
  }, [group, instruction, selectedId, tree]);

  useEffect(() => {
    const filtered = forLanguage(videosInCategory([...videos, ...extra], tree, selectedId), instruction);
    if (!filtered.length) return;
    setSuggestions(shuffleFresh(filtered, readJson(seenKey(group), [])).slice(0, 8));
  }, [selectedId, videos, tree, extra, group, instruction]);

  const select = async (id, level = readingLevel, language = instruction) => {
    setSelectedId(id);
    if (!group) return;
    const node = tree.find((item) => item.id === id);
    const legacy = idToLegacyCategory(id);
    const iqra = id === IQRA || id?.startsWith("cat_iqra_");
    const step = id?.replace("cat_iqra_", "") || level;
    localStorage.setItem(memoryKey(group), JSON.stringify({ categoryId: id, language }));
    setNotice(`${language.toUpperCase()} videos will load over time.`);
    const existing = shuffleFresh(forLanguage(videosInCategory([...videos, ...extra], tree, id), language), readJson(seenKey(group), []));
    if (existing.length) remember(id, language, existing);
    try {
      const targets = id ? [node].filter(Boolean) : tree.filter((item) => !item.parentId && !item.hidden).slice(0, 4);
      let loaded = [];
      for (const target of targets) {
        const targetId = target.id;
        const targetIqra = targetId === IQRA || targetId.startsWith("cat_iqra_");
        const batch = await loadCategoryVideos(group, idToLegacyCategory(targetId) || target.slug || "Learning", targetId, [language], targetIqra ? iqraQuery(step, group, language) : undefined);
        loaded = unique([...loaded, ...batch]);
      }
      if (!targets.length && id) loaded = await loadCategoryVideos(group, legacy || "Learning", id, [language], iqra ? iqraQuery(step, group, language) : undefined);
      const merged = shuffleFresh(forLanguage(unique([...existing, ...loaded]), language), readJson(seenKey(group), []));
      if (loaded.length) setExtra((current) => unique([...current, ...loaded]));
      if (merged.length) {
        remember(id, language, merged);
        setNotice(`${merged.length} ${language.toUpperCase()} videos are ready for this category.`);
      }
    } catch {
      setNotice(`${language.toUpperCase()} videos will load over time.`);
    }
  };

  const chooseSuggestion = (video) => {
    const seen = readJson(seenKey(group), []).filter((id) => id !== video.id);
    localStorage.setItem(seenKey(group), JSON.stringify([video.id, ...seen].slice(0, 40)));
    remember(selectedId, instruction, [video, ...suggestions.filter((item) => item.id !== video.id)]);
  };
  const chooseRef = useRef(chooseSuggestion);
  chooseRef.current = chooseSuggestion;
  useEffect(() => {
    onSuggestionsChange?.(suggestions, (video) => chooseRef.current?.(video));
  }, [suggestions, onSuggestionsChange]);

  return (
    <div className="space-y-2">
      <CategoryBrowse tree={tree} selectedId={selectedId} onSelect={select} t={t} />
      {iqraOpen && (
        <label className="flex items-center text-sm text-muted-foreground">
          Instruction
          <select value={instruction} onChange={(event) => { const code = event.target.value; setInstruction(code); select(selectedId || IQRA, readingLevel, code); }} className="ml-2 h-10 rounded-full border border-border bg-card px-3">
            {choices.map((code) => <option key={code} value={code}>{code.toUpperCase()}</option>)}
          </select>
        </label>
      )}
      <p className="text-sm text-muted-foreground">{notice}</p>
      {!hideSuggestions && suggestions.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {suggestions.map((video) => (
            <button key={video.id} type="button" onClick={() => chooseSuggestion(video)} className="w-44 shrink-0 rounded-xl bg-accent p-2 text-left hover:bg-accent/80">
              <img src={video.thumbnail || ""} alt="" className="mb-1 h-24 w-full rounded-lg bg-muted object-cover" />
              <span className="line-clamp-2 text-xs font-medium">{video.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
