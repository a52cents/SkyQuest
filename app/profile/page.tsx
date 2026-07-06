"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PushPermissionCard } from "@/components/PushPermissionCard";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { SupportSkyQuest } from "@/components/SupportSkyQuest";
import { LocalJournalStorageCard } from "@/components/LocalJournalStorageCard";
import { createEmptyProgressProfile } from "@/lib/progression";
import { getObservations, getProgressProfile } from "@/lib/storage";
import type { Observation, ProgressProfile } from "@/lib/types";

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProgressProfile>(() => createEmptyProgressProfile());
  const [observations, setObservations] = useState<Observation[]>([]);

  useEffect(() => {
    setProfile(getProgressProfile());
    let active = true;
    void getObservations().then((storedObservations) => {
      if (active) setObservations(storedObservations);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <PageShell eyebrow="Espace local" title="Mon profil" contentClassName="pb-4">
      <div className="grid gap-5">
        <ProgressDashboard profile={profile} observations={observations} />
        <LocalJournalStorageCard />
        <div id="notifications" className="scroll-mt-6">
          <PushPermissionCard />
        </div>
        <SupportSkyQuest />
      </div>
    </PageShell>
  );
}
