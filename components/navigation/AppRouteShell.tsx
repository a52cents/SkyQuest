"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BottomNavigation } from "@/components/navigation/BottomNavigation";
import { useDisplayMode } from "@/lib/use-display-mode";

export function AppRouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const displayMode = useDisplayMode();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const isImmersiveGuide = pathname.startsWith("/quest/");
  const showNavigation = !isImmersiveGuide && (pathname !== "/" || displayMode === "standalone");

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          className={showNavigation ? "app-route-content with-bottom-nav" : "app-route-content"}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.24, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
      {showNavigation ? <BottomNavigation /> : null}
    </>
  );
}
