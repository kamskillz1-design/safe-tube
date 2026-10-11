import { useMemo, useState } from "react";
import { startersFor } from "@/data/starterVideos";

const TABS = [
  { id: null, label: "Main" },
  { id: "cat_iqra", label: "Quran" },
  { id: "cat_faith", label: "Values" },
  { id: "cat_stem", label: "Learn" },
  { id: "cat_nature_animals", label: "Nature" },
  { id: "cat_history", label: "Stories" },
  { id: "cat_life_skills", label: "Skills" },
  { id: "cat_world_cultures", label: "World" },
  { id: "cat_sports_games", label: "Sports" },
  { id: "cat_cooking_food", label: "Food" },
];

const SORTS = ["Featured", "Popular", "New", "Random"];

function unique(videos) {
  return videos.filter((video, index, list) => video?.id && list.findIndex((item) => item.id === video.id) === index);
}

function Card({ video, onPlay, compact = false }) {
  return (
    <button type="button" onClick={() => onPlay(video)} className="flex w-full gap-3 rounded-xl p-2 text-left hover:bg-accent">
      <span className={`relative shrink-0 overflow-hidden rounded-lg bg-muted ${compact ? "h-16 w-28" : "h-24 w-40"}`}>
        <img src={video.thumbnail || ""} alt="" className="h-full w-full object-cover" />
        {video.durationSeconds ? <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[10px] text-white">{Math.floor(video.durationSeconds / 60)}:{String(video.durationSeconds % 60).padStart(2, "0")}</span> : null}
      </span>
      <span className="min-w-0">
        <span className="line-clamp-2 text-sm font-medium">{video.title}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{video.channelTitle || "SafeTube Kids"}</span>
      </span>
    </button>
  );
}

export default function HalalBrowse({ videos = [], ageGroup, onPlay }) {
  const [tab, setTab] = useState(null);
  const [sort, setSort] = useState("Featured");
  const [query, setQuery] = useState("");
  const library = useMemo(() => unique([...videos, ...startersFor(ageGroup)]), [videos, ageGroup]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    let rows = library.filter((video) => (!tab || video.categoryId === tab) && (!term || `${video.title} ${video.channelTitle}`.toLowerCase().includes(term)));
    if (sort === "Popular") rows = [...rows].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    if (sort === "New") rows = [...rows].reverse();
    if (sort === "Random") rows = [...rows].sort(() => Math.random() - 0.5);
    return rows;
  }, [library, tab, sort, query]);
  const featured = visible[0];
  const popular = visible.slice(1, 5);
  const rest = visible.slice(5);

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <p className="font-heading text-xl font-bold text-primary">HalalTube</p>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search safe videos..." className="h-10 min-w-48 flex-1 rounded-full border border-border bg-background px-4 text-sm" />
        <p className="text-sm text-muted-foreground">Safe for Muslim kids</p>
      </div>
      <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2">
        {TABS.map((item) => (
          <button key={item.label} type="button" onClick={() => setTab(item.id)} className={`h-9 shrink-0 rounded-full px-3 text-sm font-semibold ${tab === item.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{item.label}</button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 py-2">
        {SORTS.map((item) => (
          <button key={item} type="button" onClick={() => setSort(item)} className={`h-8 shrink-0 rounded-md border px-3 text-xs font-semibold ${sort === item ? "border-primary text-primary" : "border-border"}`}>{item}</button>
        ))}
      </div>
      {featured ? (
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <button type="button" onClick={() => onPlay(featured)} className="overflow-hidden rounded-2xl bg-black text-left text-white">
            <img src={featured.thumbnail || ""} alt="" className="aspect-video w-full object-cover" />
            <span className="block p-4 text-lg font-bold">{featured.title}</span>
          </button>
          <div>
            <p className="mb-2 text-sm font-bold text-primary">POPULAR VIDEOS</p>
            {popular.map((video) => <Card key={video.id} video={video} onPlay={onPlay} compact />)}
          </div>
        </div>
      ) : <p className="p-6 text-sm text-muted-foreground">Safe videos for this section will appear here.</p>}
      {rest.length > 0 && (
        <div className="border-t border-border p-4">
          <p className="mb-2 text-sm font-bold text-primary">MORE SAFE VIDEOS</p>
          <div className="grid gap-2 sm:grid-cols-2">{rest.slice(0, 8).map((video) => <Card key={video.id} video={video} onPlay={onPlay} />)}</div>
        </div>
      )}
    </section>
  );
}
