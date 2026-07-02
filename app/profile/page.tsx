"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { SupportSkyQuest } from "@/components/SupportSkyQuest";
import { createEmptyProgressProfile } from "@/lib/progression";
import { getProgressProfile } from "@/lib/storage";
import type { ProgressProfile } from "@/lib/types";

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProgressProfile>(() => createEmptyProgressProfile());

  useEffect(() => {
    setProfile(getProgressProfile());
  }, []);

  return (
    <PageShell eyebrow="Progression locale" title="Mon profil" contentClassName="pb-4">
      <div className="grid gap-5">
        <ProgressDashboard profile={profile} />
        <SupportSkyQuest />
      </div>
    </PageShell>
  );
}
