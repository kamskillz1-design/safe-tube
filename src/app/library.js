import { ALL_AGE_GROUPS, ENTERTAINMENT_CATEGORY } from "@/domain/constants";
import { applyWhitelistGates } from "@/domain/gates";
import { whitelistForAge } from "@/data/whitelist";
import { activeRegistryForAge, confirmedChannelsForAge } from "@/app/vetting";
import { ensureCategoryMigration } from "@/app/categories";
import { idToLegacyCategory } from "@/domain/categories";
import {
  getCached,
  putCached,
  listCustomChannels,
  listLibraryChannels,
  putLibraryChannel,
  listLibraryVideos,
  libraryVideosForAge,
  putLibraryVideos,
} from "@/adapters/localDb";
import { resolveChannels, fetchChannelUploads, YoutubeApiError } from "@/adapters/youtubeClient";

const META_KEY = "library:meta";
const SCANNED_KEY = "library:scanned";
const IDS_KEY = "channelIds";
const FIRST_PAINT_CHANNELS = 2;
const BACKGROUND_BATCH = 1;
const REFRESH_NEW_CHANNELS = 2;
const UPLOADS_PER_CHANNEL = 5;
const PAUSE_MS = 2000;
const AUTO_REFRESH_MS = 24 * 60 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const scanKey = (channel) => `${channel.name}:${channel.ageGroup || ""}`;

export async function defaultTrustedChannels() {
  const seen = new Set();
  const out = [];
  for (const group of ALL_AGE_GROUPS) {
    for (const channel of await activeRegistryForAge(group)) {
      if (seen.has(channel.name)) continue;
      seen.add(channel.name);
      out.push({ ...channel, ageGroup: group, isDefaultTrusted: true, source: "registry", nativeLanguage: channel.nativeLanguage || "en" });
    }
    for (const channel of whitelistForAge(group)) {
      if (seen.has(channel.name)) continue;
      seen.add(channel.name);
      out.push({ ...channel, isDefaultTrusted: true, source: "whitelist", nativeLanguage: channel.nativeLanguage || "en" });
    }
  }
  return out;
}

async function parentChannels() {
  const out = [];
  const custom = (await listCustomChannels()).filter((c) => c.status === "approved");
  custom.forEach((c) => {
    const legacy = c.categories?.length
      ? c.categories
      : [idToLegacyCategory(c.primaryCategoryId) || ENTERTAINMENT_CATEGORY];
    out.push({
      name: c.name,
      channelId: c.channelId || null,
      ageGroup: c.ageGroup,
      categories: legacy,
      primaryCategoryId: c.primaryCategoryId || null,
      nativeLanguage: c.nativeLanguage || "en",
      isDefaultTrusted: false,
      source: "parent",
    });
  });
  for (const group of ALL_AGE_GROUPS) {
    for (const c of await confirmedChannelsForAge(group)) {
      if (out.some((x) => x.channelId === c.channelId)) continue;
      out.push({ ...c, ageGroup: group, isDefaultTrusted: false, source: "vetted" });
    }
  }
  return out;
}

async function allSources(profileAgeGroup) {
  const trusted = await defaultTrustedChannels();
  const extras = await parentChannels();
  const rank = (s) => (s.ageGroup === profileAgeGroup ? 0 : 1);
  return [...trusted, ...extras].sort((a, b) => rank(a) - rank(b));
}

async function resolveMissing(names) {
  const map = (await getCached(IDS_KEY)) ?? {};
  const missing = names.filter((n) => !map[n]);
  if (!missing.length) return map;
  for (const name of missing) {
    const resolved = await resolveChannels([name]);
    resolved.forEach((r) => {
      if (r.channelId) map[r.query] = r.channelId;
    });
    await putCached(IDS_KEY, map);
    await sleep(PAUSE_MS);
  }
  return map;
}

async function alreadyHasVideos(channel) {
  const rows = await libraryVideosForAge(channel.ageGroup);
  return rows.some(
    (v) =>
      v.sourceChannelId === channel.channelId ||
      (channel.name && (v.channelTitle || "").toLowerCase() === channel.name.toLowerCase())
  );
}

async function scanChannel(channel, channelId) {
  if (await alreadyHasVideos({ ...channel, channelId })) {
    await putLibraryChannel({
      channelId,
      name: channel.name,
      ageGroup: channel.ageGroup,
      categories: channel.categories?.length ? channel.categories : [ENTERTAINMENT_CATEGORY],
      language: channel.nativeLanguage || "en",
      isDefaultTrusted: !!channel.isDefaultTrusted,
      active: true,
      reviewedAt: new Date().toISOString(),
      source: channel.source || "registry",
    });
    return 0;
  }
  const uploads = await fetchChannelUploads(channelId, UPLOADS_PER_CHANNEL);
  const gated = applyWhitelistGates(uploads, channel.ageGroup);
  const now = new Date().toISOString();
  const categories = channel.categories?.length ? channel.categories : [ENTERTAINMENT_CATEGORY];
  if (gated.length) {
    await putLibraryVideos(
      gated.map((v) => ({
        id: v.id,
        title: v.title,
        description: v.description,
        channelId: v.channelId,
        channelTitle: v.channelTitle || channel.name,
        category: categories[0],
        categoryId: channel.primaryCategoryId || null,
        ageGroup: channel.ageGroup,
        language: (v.language || channel.nativeLanguage || "en").slice(0, 2).toLowerCase(),
        durationSeconds: v.durationSeconds,
        viewCount: v.viewCount,
        thumbnail: v.thumbnail,
        approved: true,
        addedAt: now,
        sourceChannelId: channelId,
      }))
    );
  }
  await putLibraryChannel({
    channelId,
    name: channel.name,
    ageGroup: channel.ageGroup,
    categories,
    language: channel.nativeLanguage || "en",
    isDefaultTrusted: !!channel.isDefaultTrusted,
    active: true,
    reviewedAt: now,
    source: channel.source || "registry",
  });
  return gated.length;
}

async function importBatch(batch) {
  let failureCode = null;
  let added = 0;
  const scanned = new Set((await getCached(SCANNED_KEY)) ?? []);
  for (const channel of batch) {
    try {
      const idMap = await resolveMissing([channel.name]);
      const channelId = channel.channelId || idMap[channel.name];
      if (!channelId) continue;
      const n = await scanChannel(channel, channelId);
      added += n;
      scanned.add(scanKey(channel));
      await putCached(SCANNED_KEY, [...scanned]);
    } catch (error) {
      if (error instanceof YoutubeApiError && !failureCode) failureCode = error.code;
      if (error instanceof YoutubeApiError && (error.code === "YOUTUBE_QUOTA_OR_KEY" || error.code === "MISSING_API_KEY")) {
        break;
      }
    }
    await sleep(PAUSE_MS);
  }
  return { added, failureCode };
}

let backgroundImport = null;

function continueImportInBackground(sources) {
  if (backgroundImport) return;
  backgroundImport = (async () => {
    for (;;) {
      const scanned = new Set((await getCached(SCANNED_KEY)) ?? []);
      const remaining = sources.filter((s) => !scanned.has(scanKey(s)));
      if (!remaining.length) break;
      const { failureCode } = await importBatch(remaining.slice(0, BACKGROUND_BATCH));
      if (failureCode) break;
    }
  })()
    .catch(() => {})
    .finally(() => {
      backgroundImport = null;
    });
}

export async function ensureLibraryVideos(profile) {
  await ensureCategoryMigration();
  const existing = await libraryVideosForAge(profile.ageGroup);
  const sources = await allSources(profile.ageGroup);
  const sameAge = sources.filter((s) => s.ageGroup === profile.ageGroup);
  const pool = sameAge.length ? sameAge : sources;
  if (existing.length > 0) {
    continueImportInBackground(pool);
    return { ok: true, added: 0 };
  }
  const scanned = new Set((await getCached(SCANNED_KEY)) ?? []);
  const unscanned = pool.filter((s) => !scanned.has(scanKey(s)));
  const targets = (unscanned.length ? unscanned : pool).slice(0, FIRST_PAINT_CHANNELS);
  if (!targets.length) return { ok: true, added: 0 };
  const { added, failureCode } = await importBatch(targets);
  continueImportInBackground(pool);
  if (added === 0 && failureCode) return { ok: false, code: failureCode };
  return { ok: true, added };
}

export async function importApprovedDiscovery(ageGroup) {
  const approved = (await getCached(`approved:${ageGroup}`)) ?? [];
  if (!approved.length) return 0;
  const now = new Date().toISOString();
  await putLibraryVideos(
    approved.map((v) => ({
      ...v,
      ageGroup,
      language: (v.language || "en").slice(0, 2).toLowerCase(),
      approved: true,
      addedAt: v.addedAt ?? now,
      sourceChannelId: v.channelId ?? "",
    }))
  );
  return approved.length;
}

export async function getLibraryVideosForProfile(profile) {
  const allowed = new Set(
    ["en", profile.nativeLanguage, ...(profile.targetLanguages || [])]
      .filter(Boolean)
      .map((code) => String(code).slice(0, 2).toLowerCase())
  );
  const stored = (await libraryVideosForAge(profile.ageGroup)).filter((v) => v.approved !== false);
  return stored
    .filter((video) => allowed.has((video.language || "en").slice(0, 2).toLowerCase() || "en"))
    .map(({ approved, addedAt, sourceChannelId, ageGroup, ...video }) => video);
}

export async function refreshLibrary({ manual = false } = {}) {
  const meta = (await getCached(META_KEY)) ?? {};
  const now = Date.now();
  if (!manual && meta.lastRefreshAt && now - meta.lastRefreshAt < AUTO_REFRESH_MS) {
    return { skipped: true, added: 0, quotaIssue: false };
  }

  const trusted = await defaultTrustedChannels();
  const extras = await parentChannels();
  const targets = [];
  for (const group of ALL_AGE_GROUPS) {
    const have = await libraryVideosForAge(group);
    if (have.length > 0) continue;
    targets.push(...trusted.filter((s) => s.ageGroup === group).slice(0, REFRESH_NEW_CHANNELS));
    targets.push(...extras.filter((s) => s.ageGroup === group).slice(0, REFRESH_NEW_CHANNELS));
  }

  let added = 0;
  let quotaIssue = false;
  const { added: batchAdded, failureCode } = await importBatch(targets);
  added += batchAdded;
  if (failureCode === "YOUTUBE_QUOTA_OR_KEY" || failureCode === "MISSING_API_KEY") quotaIssue = true;

  for (const group of ALL_AGE_GROUPS) await importApprovedDiscovery(group);

  await putCached(META_KEY, {
    ...meta,
    lastRefreshAt: now,
    lastRefreshStatus: quotaIssue ? "limited" : "ok",
    quotaOk: !quotaIssue,
    lastRefreshAdded: added,
  });
  return { added, quotaIssue };
}

export function maybeAutoRefresh() {
  refreshLibrary({ manual: false }).catch(() => {});
}

export async function libraryStats() {
  const [channels, videos, trusted, meta] = await Promise.all([
    listLibraryChannels(),
    listLibraryVideos(),
    defaultTrustedChannels(),
    getCached(META_KEY),
  ]);
  const tally = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
  const byCategory = new Map();
  const byAge = new Map();
  const byLanguage = new Map();
  videos.forEach((v) => {
    tally(byCategory, v.category);
    tally(byAge, v.ageGroup);
    tally(byLanguage, (v.language || "en").slice(0, 2));
  });
  return {
    trustedTotal: trusted.length,
    trustedResolved: channels.filter((c) => c.isDefaultTrusted).length,
    totalVideos: videos.length,
    byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
    byAge: [...byAge.entries()],
    byLanguage: [...byLanguage.entries()].sort((a, b) => b[1] - a[1]),
    lastRefreshAt: meta?.lastRefreshAt ?? null,
    lastRefreshStatus: meta?.lastRefreshStatus ?? null,
    quotaOk: meta?.quotaOk !== false,
  };
}
