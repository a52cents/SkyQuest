"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

const items = [
  {
    href: "/",
    label: "Maintenant",
    isActive: (pathname: string) => pathname === "/",
    icon: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2" /></>,
  },
  {
    href: "/explore",
    label: "Explorer",
    isActive: (pathname: string) => pathname.startsWith("/explore"),
    icon: <><circle cx="12" cy="12" r="10" /><path d="M16.2 7.8l-2.6 5.8-5.8 2.6 2.6-5.8 5.8-2.6z" /></>,
  },
  {
    href: "/journal",
    label: "Journal",
    isActive: (pathname: string) => pathname.startsWith("/journal"),
    icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></>,
  },
  {
    href: "/profile",
    label: "Profil",
    isActive: (pathname: string) => pathname.startsWith("/profile"),
    icon: <><circle cx="12" cy="8" r="4" /><path d="M4 22a8 8 0 0 1 16 0" /></>,
  },
] as const;

export function BottomNavigation() {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion() ?? false;

  return (
    <nav className="app-bottom-nav" aria-label="Navigation principale">
      <div className="app-bottom-nav-inner">
        {items.map((item) => {
          const active = item.isActive(pathname);
          return (
            <motion.div key={item.href} className="app-bottom-nav-slot" whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}>
              <Link href={item.href} className={`app-bottom-nav-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
                <span className="app-bottom-nav-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true">{item.icon}</svg>
                  {active ? <motion.span className="app-bottom-nav-indicator" initial={{ opacity: 0, scaleX: 0.65 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ duration: 0.18, ease: "easeOut" }} /> : null}
                </span>
                <span>{item.label}</span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </nav>
  );
}
