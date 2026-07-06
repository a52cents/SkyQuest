"use client";

import { useEffect, useState } from "react";
import { DiscoveryAtlas } from "@/components/DiscoveryAtlas";
import { LoadingState } from "@/components/LoadingState";
import { PageShell } from "@/components/PageShell";
import { createEmptyProgressProfile } from "@/lib/progression";
import { getObservations, getProgressProfile } from "@/lib/storage";
import type { Observation, ProgressProfile } from "@/lib/types";

export default function AtlasPage() {
  const [profile, setProfile] = useState<ProgressProfile>(() => createEmptyProgressProfile());
  const [observations, setObservations] = useState<Observation[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    void getObservations()
      .then((storedObservations) => {
        if (!active) return;
        setProfile(getProgressProfile());
        setObservations(storedObservations);
      })
      .finally(() => {
        if (active) setIsReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <PageShell eyebrow="Mes découvertes" title="Mon atlas" contentClassName="pb-4">
      {isReady ? (
        <DiscoveryAtlas profile={profile} observations={observations} />
      ) : (
        <LoadingState />
      )}
    </PageShell>
  );
}
