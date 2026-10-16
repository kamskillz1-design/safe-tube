// Home: the child profile picker. Kids tap their card to start watching;
// parents tap Edit or the shield button to reach the parent area.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, Plus, Tv, Loader2 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { listProfiles } from "@/adapters/localDb";
import { useI18n } from "@/lib/i18n";
import ProfileCard from "@/components/profiles/ProfileCard";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import BottomNav from "@/components/BottomNav";
import BrandLink from "@/components/BrandLink";

export default function Home() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState(null);

  const load = () => listProfiles().then(setProfiles);

  useEffect(() => {
    load();
    const onChanged = () => load();
    window.addEventListener("safetube:data-changed", onChanged);
    return () => window.removeEventListener("safetube:data-changed", onChanged);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background pt-safe">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 p-4 sm:p-6">
          <BrandLink />
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Link
              to="/dashboard"
              aria-label={t("nav.parents")}
              className="flex h-12 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm hover:bg-accent"
            >
              <ShieldCheck className="h-5 w-5" />
              <span>Parent area</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 sm:px-6 lg:pb-16">
        <p className="mb-4 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">Parents: open <span className="font-semibold text-foreground">Parent area</span> to add a child, choose channels, and manage settings.</p>
        {profiles === null ? (
          <div className="flex justify-center py-24" role="status" aria-label={t("common.loading")}>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="flex flex-col items-center gap-6 py-20 text-center">
            <div className="grid h-24 w-24 place-items-center rounded-full bg-accent text-primary">
              <Tv className="h-12 w-12" />
            </div>
            <div className="space-y-2">
              <h2 className="font-heading text-3xl font-bold">{t("home.welcomeTitle")}</h2>
              <p className="max-w-md text-lg text-muted-foreground">{t("home.welcomeText")}</p>
            </div>
            <Link
              to="/dashboard"
              className="flex h-16 items-center gap-2 rounded-2xl bg-primary px-8 font-heading text-lg font-bold text-primary-foreground shadow-lg"
            >
              <Plus className="h-6 w-6" /> {t("home.setupProfile")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 md:grid-cols-3">
            {profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                onOpen={(p) => navigate(`/watch/${p.id}`)}
                onEdit={(p) => navigate(`/dashboard?edit=${encodeURIComponent(p.id)}`)}
              />
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
