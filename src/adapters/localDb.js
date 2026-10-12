// Local-first storage adapter — Dexie (IndexedDB) + localStorage for the language preference.
// All child state stays on the device; nothing here talks to any cloud database.
import Dexie from "dexie";
import { ALL_AGE_GROUPS } from "@/domain/constants";
import { getStoredLanguage } from "@/lib/language";

const db = new Dexie("safetube_kids");
db.version(1).stores({
  profiles: "id",
  customChannels: "id, ageGroup",
  contentCache: "key",
  sessionState: "id",
});
db.version(2).stores({
  watchHistory: "id, profileId",
});
db.version(3).stores({
  libraryChannels: "channelId, name",
  libraryVideos: "id, ageGroup",
});

export const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `p_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const todayKey = () => new Date().toISOString().slice(0, 10);

// --- Profiles ---
export const listProfiles = () => db.profiles.toArray();
export const getProfile = (id) => db.profiles.get(id);
export const saveProfile = (profile) => db.profiles.put(profile);
export const deleteProfile = async (id) => {
  await db.profiles.delete(id);
  await db.watchHistory.where("profileId").equals(id).delete();
  const sessions = await db.sessionState.toArray();
  await db.sessionState.bulkDelete(sessions.filter((s) => s.id.startsWith(`${id}:`)).map((s) => s.id));
};

// Resets the daily screen-time counter when a new day has started. Returns the fresh profile.
export async function loadProfileForToday(id) {
  const profile = await db.profiles.get(id);
  if (!profile) return null;
  const today = todayKey();
  if (profile.lastActiveDate !== today) {
    profile.lastActiveDate = today;
    profile.currentTimeSpent = 0;
    await db.profiles.put(profile);
  }
  return profile;
}

// --- Custom channels (parent-curated) ---
export const listCustomChannels = (ageGroup) =>
  ageGroup ? db.customChannels.where("ageGroup").equals(ageGroup).toArray() : db.customChannels.toArray();

export const saveCustomChannel = (channel) => db.customChannels.put(channel);
export const deleteCustomChannel = (id) => db.customChannels.delete(id);

// Keys for the verified-registry removals and runtime-vetting decisions, scoped per age group.
export const vettingKeys = {
  removed: (ageGroup) => `verifiedRemoved:${ageGroup}`,
  pending: (ageGroup) => `vettedPending:${ageGroup}`,
  confirmed: (ageGroup) => `vettedConfirmed:${ageGroup}`,
  dismissed: (ageGroup) => `vettedDismissed:${ageGroup}`,
};

// --- Content cache (feed + discovery review queues, keyed by domain names) ---
export const getCached = async (key, maxAgeMs) => {
  const record = await db.contentCache.get(key);
  if (!record) return null;
  if (maxAgeMs && Date.now() - record.cachedAt > maxAgeMs) return null;
  return record.data;
};

export const putCached = (key, data) => db.contentCache.put({ key, data, cachedAt: Date.now() });
export const deleteCacheKey = (key) => db.contentCache.delete(key);

// --- Session state (per profile, per day) ---
export const getTodaySession = async (profileId) => {
  const id = `${profileId}:${todayKey()}`;
  return (await db.sessionState.get(id)) ?? { id, secondsToday: 0, quizResults: [] };
};
export const saveSession = (session) => db.sessionState.put(session);

// --- Watch history (per profile, persists across sign-ins) ---
export const getWatchedVideoIds = async (profileId) =>
  (await db.watchHistory.where("profileId").equals(profileId).toArray()).map((r) => r.videoId);

export const recordWatchedVideo = (profileId, videoId) =>
  db.watchHistory.put({ id: `${profileId}:${videoId}`, profileId, videoId, watchedAt: Date.now() });

export const clearWatchedHistory = (profileId) =>
  db.watchHistory.where("profileId").equals(profileId).delete();

// --- SafeTube Video Library (the only source for child feeds) ---
export const listLibraryChannels = () => db.libraryChannels.toArray();
export const putLibraryChannel = (channel) => db.libraryChannels.put(channel);
export const listLibraryVideos = () => db.libraryVideos.toArray();
export const libraryVideosForAge = async (ageGroup) => {
  const { durationGate, ageContentGate } = await import("@/domain/gates");
  const videos = await db.libraryVideos.toArray();
  return videos.filter((video) => durationGate(video.durationSeconds, ageGroup) && ageContentGate(video, ageGroup));
};
export const putLibraryVideos = (videos) => db.libraryVideos.bulkPut(videos);
export const deleteLibraryVideo = (id) => db.libraryVideos.delete(id);

export async function blockedVideoIds(profileId) {
  const row = await db.contentCache.get(`blocked:${profileId}`);
  return new Set(row?.data || []);
}
export async function blockVideo(profileId, videoId) {
  const ids = [...(await blockedVideoIds(profileId))];
  if (!ids.includes(videoId)) ids.push(videoId);
  await db.contentCache.put({ key: `blocked:${profileId}`, data: ids.slice(-200), cachedAt: Date.now() });
  if (videoId) await db.libraryVideos.delete(videoId);
}

// --- Cross-device backup ---
export async function exportBackup() {
  return {
    version: 1,
    app: "safetube_kids",
    exportedAt: new Date().toISOString(),
    languagePreference: getStoredLanguage(),
    profiles: (await db.profiles.toArray()).map(({ parentPin, ...profile }) => profile),
    customChannels: await db.customChannels.toArray(),
    curation: await exportCuration(),
  };
}

// Verified-registry removals and vetted-channel decisions, per age group.
async function exportCuration() {
  const curation = {};
  for (const group of ALL_AGE_GROUPS) {
    curation[group] = {
      removedVerified: (await getCached(vettingKeys.removed(group))) ?? [],
      pendingVetted: (await getCached(vettingKeys.pending(group))) ?? [],
      confirmedVetted: (await getCached(vettingKeys.confirmed(group))) ?? [],
      dismissedVetted: (await getCached(vettingKeys.dismissed(group))) ?? [],
    };
  }
  return curation;
}

export async function importBackup(json) {
  if (!json || typeof json !== "object" || json.app !== "safetube_kids" || !Array.isArray(json.profiles)) {
    throw new Error("This file is not a valid SafeTube Kids backup.");
  }
  const validAge = ["toddler_2_4", "early_learner_5_7", "tween_8_12"];
  json.profiles.forEach((p) => {
    if (!p || typeof p.id !== "string" || typeof p.childName !== "string" || !validAge.includes(p.ageGroup)) {
      throw new Error("The backup contains an invalid profile record.");
    }
  });
  const profiles = json.profiles.map(({ parentPin, ...profile }) => profile);
  const channels = Array.isArray(json.customChannels) ? json.customChannels : [];
  await db.transaction("rw", db.profiles, db.customChannels, async () => {
    await db.profiles.clear();
    await db.customChannels.clear();
    await db.profiles.bulkPut(profiles);
    await db.customChannels.bulkPut(channels.filter((c) => c && typeof c.id === "string"));
  });
  if (json.curation && typeof json.curation === "object") {
    for (const group of ALL_AGE_GROUPS) {
      const groupData = json.curation[group];
      if (!groupData || typeof groupData !== "object") continue;
      await putCached(vettingKeys.removed(group), Array.isArray(groupData.removedVerified) ? groupData.removedVerified : []);
      await putCached(vettingKeys.pending(group), Array.isArray(groupData.pendingVetted) ? groupData.pendingVetted : []);
      await putCached(vettingKeys.confirmed(group), Array.isArray(groupData.confirmedVetted) ? groupData.confirmedVetted : []);
      await putCached(vettingKeys.dismissed(group), Array.isArray(groupData.dismissedVetted) ? groupData.dismissedVetted : []);
    }
  }
}