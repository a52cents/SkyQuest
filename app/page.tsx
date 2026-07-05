"use client";

import { Dashboard } from "@/components/dashboard/Dashboard";
import { LandingPage } from "@/components/marketing/LandingPage";
import { useDisplayMode } from "@/lib/use-display-mode";
import { useSearchParams } from "next/navigation";

export default function HomePage() {
  const displayMode = useDisplayMode();
  const searchParams = useSearchParams();
  const isBrowserTrial = searchParams.get("app") === "1";
  const notificationIntent = searchParams.get("intent") ?? undefined;
  const preferredTarget = searchParams.get("target") ?? undefined;

  return displayMode === "standalone" || isBrowserTrial ? (
    <Dashboard notificationIntent={notificationIntent} preferredTarget={preferredTarget} />
  ) : (
    <LandingPage />
  );
}
