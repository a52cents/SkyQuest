"use client";

import { Dashboard } from "@/components/dashboard/Dashboard";
import { LandingPage } from "@/components/marketing/LandingPage";
import { useDisplayMode } from "@/lib/use-display-mode";
import { useSearchParams } from "next/navigation";

export default function HomePage() {
  const displayMode = useDisplayMode();
  const searchParams = useSearchParams();
  const isBrowserTrial = searchParams.get("app") === "1";

  return displayMode === "standalone" || isBrowserTrial ? <Dashboard /> : <LandingPage />;
}
