"use client";

import { Dashboard } from "@/components/dashboard/Dashboard";
import { LandingPage } from "@/components/marketing/LandingPage";
import { useDisplayMode } from "@/lib/use-display-mode";

export default function HomePage() {
  const displayMode = useDisplayMode();

  return displayMode === "standalone" ? <Dashboard /> : <LandingPage />;
}
