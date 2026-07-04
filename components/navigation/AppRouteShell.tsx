"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { useDisplayMode } from "@/lib/use-display-mode";

export function AppRouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const displayMode = useDisplayMode();
  const isImmersiveGuide = pathname.startsWith("/quest/");
  const isBrowserTrial = pathname === "/" && searchParams.get("app") === "1";
  const showNavigation =
    !isImmersiveGuide && (pathname !== "/" || displayMode === "standalone" || isBrowserTrial);

  return (
    <>
      <div className={showNavigation ? "app-route-content with-bottom-nav" : "app-route-content"}>
        {children}
      </div>
      {showNavigation ? <BottomNavigation /> : null}
    </>
  );
}
