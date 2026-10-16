// Parent dashboard — behind parent email sign-in. Profiles, curation, backup.
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Users, ShieldCheck, Download, Loader2, LogOut, BookCheck } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { listProfiles, deleteProfile } from "@/adapters/localDb";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/AuthContext";
import { isParentSignedIn, clearParentSignedIn } from "@/lib/parentSession";
import ParentArea from "@/components/ParentArea";
import ProfileEditor from "@/components/profiles/ProfileEditor";
import CuratorPortal from "@/components/dashboard/CuratorPortal";
import LibraryPanel from "@/components/dashboard/LibraryPanel";
import BackupPanel from "@/components/dashboard/BackupPanel";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import BottomNav from "@/components/BottomNav";

const TABS = [
  { id: "profiles", labelKey: "dash.tabProfiles", icon: Users },
  { id: "curator", labelKey: "dash.tabCurator", icon: ShieldCheck },
  { id: "library", labelKey: "dash.tabLibrary", icon: BookCheck },
  { id: "backup", labelKey: "dash.tabBackup", icon: Download },
];

export default function Dashboard() {
  const { t } = useI18n();
  const { isAuthenticated, isLoadingAuth, authChecked, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [authState, setAuthState] = useState("checking");
  const [tab, setTab] = useState("profiles");
  const [profiles, setProfiles] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    listProfiles().then(setProfiles);
  }, []);

  const signOut = async () => {
    clearParentSignedIn();
    await logout(false);
    setAuthState("signedOut");
  };

  useEffect(() => {
    if (isParentSignedIn() || isAuthenticated) {
      setAuthState("signedIn");
      return;
    }
    if (isLoadingAuth || !authChecked) {
      setAuthState("checking");
      return;
    }
    setAuthState("signedOut");
  }, [isAuthenticated, isLoadingAuth, authChecked]);

  useEffect(() => {
    if (authState === "signedIn") load();
  }, [authState, load]);

  useEffect(() => {
    if (authState !== "signedIn") return;
    const id = searchParams.get("edit");
    if (!id || profiles.length === 0) return;
    const found = profiles.find((profile) => profile.id === id);
    if (!found) return;
    setTab("profiles");
    setEditing(found);
    setSearchParams({}, { replace: true });
  }, [authState, profiles, searchParams, setSearchParams]);

  if (authState !== "signedIn") {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl p-4 sm:p-6">
          {authState === "checking" ? (
            <div className="flex justify-center py-24" role="status" aria-label={t("common.loading")}>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ParentArea />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background pt-safe">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 p-4 sm:p-6">
          <Link to="/" className="flex h-12 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 font-medium hover:bg-accent">
            <ArrowLeft className="h-5 w-5" /> {t("dash.kids")}
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <button type="button" onClick={signOut} className="flex h-12 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
              <LogOut className="h-4 w-4" /> {t("common.signOut")}
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 pb-28 sm:px-6 lg:pb-16">
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map(({ id, labelKey, icon: Icon }) => (
            <button key={id} type="button" onClick={() => { setTab(id); setEditing(null); }} className={`flex h-12 items-center gap-2 rounded-full border-2 px-5 text-sm font-bold ${
              tab === id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"
            }`}>
              <Icon className="h-4 w-4" /> {t(labelKey)}
            </button>
          ))}
        </div>
        {tab === "profiles" && (
          <div className="space-y-6">
            {editing === null && (
              <button type="button" onClick={() => setEditing("new")} className="flex h-14 items-center gap-2 rounded-2xl bg-primary px-6 font-heading text-lg font-bold text-primary-foreground shadow-lg">
                <Plus className="h-5 w-5" /> {t("dash.addProfile")}
              </button>
            )}
            {editing !== null && (
              <div className="rounded-3xl border border-border bg-card p-6">
                <h2 className="mb-4 font-heading text-xl font-bold">
                  {editing === "new" ? t("dash.newProfile") : t("dash.editProfile", { name: editing.childName })}
                </h2>
                <ProfileEditor profile={editing === "new" ? null : editing} onSaved={() => { setEditing(null); load(); window.dispatchEvent(new CustomEvent("safetube:data-changed")); }} onCancel={() => setEditing(null)} />
              </div>
            )}
            {profiles.length > 0 && (
              <ul className="space-y-3">
                {profiles.map((profile) => (
                  <li key={profile.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                    <div className="min-w-0">
                      <p className="break-words font-heading text-lg font-bold">{profile.childName}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("dash.profileMeta", { age: t(`ageGroup.${profile.ageGroup}`), minutes: profile.dailyTimeLimitMinutes, tokens: profile.educationalTokens })} · {profile.targetLanguages.join(", ").toUpperCase()}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => setEditing(profile)} aria-label={t("dash.editProfile", { name: profile.childName })} className="grid h-12 w-12 place-items-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"><Pencil className="h-5 w-5" /></button>
                      <button type="button" onClick={() => { if (window.confirm(t("dash.removeConfirm", { name: profile.childName }))) { deleteProfile(profile.id).then(() => { load(); window.dispatchEvent(new CustomEvent("safetube:data-changed")); }); } }} aria-label={t("dash.deleteProfile", { name: profile.childName })} className="grid h-12 w-12 place-items-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-5 w-5" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {tab === "curator" && <CuratorPortal />}
        {tab === "library" && <LibraryPanel />}
        {tab === "backup" && <BackupPanel />}
      </div>
      <BottomNav />
    </div>
  );
}
