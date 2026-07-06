import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { HapticsToggle } from "@/components/HapticsToggle";
import { NightModeToggle } from "@/components/NightModeToggle";

type AppHeaderProps = {
  eyebrow?: string;
  title?: string;
  action?: ReactNode;
  className?: string;
};

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AppHeader({ eyebrow, title, action, className }: AppHeaderProps) {
  const hasHeading = Boolean(eyebrow || title);

  return (
    <header
      className={joinClasses(
        "sticky top-0 z-30 border-b border-white/[0.06] bg-background/85 pb-4 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-[24px]",
        className,
      )}
    >
      <div className="mx-auto flex max-w-[600px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src="/newicon.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-full object-cover"
            priority
          />
          <div className="min-w-0">
            {hasHeading ? (
              <>
                <p className="premium-kicker truncate">{eyebrow ?? "SkyQuest"}</p>
                {title ? (
                  <h1 className="mt-0.5 truncate font-[Georgia,'Times_New_Roman',serif] text-[1.55rem] font-normal tracking-[-0.03em] text-text">
                    {title}
                  </h1>
                ) : null}
              </>
            ) : (
              <p className="premium-kicker truncate">SkyQuest</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action ? <div className="shrink-0">{action}</div> : null}
          <details className="group relative">
            <summary
              aria-label="Ouvrir le profil et les réglages"
              className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-brand border border-white/10 bg-white/[0.045] text-muted transition-colors marker:hidden hover:border-accent/40 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 [&::-webkit-details-marker]:hidden"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-5 w-5 fill-none stroke-current stroke-[1.8]"
              >
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20a7 7 0 0 1 14 0" />
              </svg>
            </summary>
            <div className="absolute top-13 right-0 z-50 w-64 rounded-brand-lg border border-white/10 bg-surface-strong/95 p-3 shadow-2xl backdrop-blur-xl">
              <p className="px-2 pb-2 text-[0.68rem] font-semibold tracking-[0.1em] text-faint uppercase">
                Profil et réglages
              </p>
              <Link
                href="/profile"
                className="flex min-h-11 items-center rounded-[12px] px-3 text-sm font-semibold text-text transition-colors hover:bg-white/[0.06]"
              >
                Profil et progression
              </Link>
              <Link
                href="/atlas"
                className="flex min-h-11 items-center rounded-[12px] px-3 text-sm font-semibold text-text transition-colors hover:bg-white/[0.06]"
              >
                Mon atlas du ciel
              </Link>
              <Link
                href="/glossary"
                className="flex min-h-11 items-center rounded-[12px] px-3 text-sm font-semibold text-text transition-colors hover:bg-white/[0.06]"
              >
                Glossaire
              </Link>
              <div className="mt-2 border-t border-white/[0.07] pt-3">
                <div className="flex items-center justify-between gap-3 px-2 py-1">
                  <span className="text-xs text-muted">Mode nuit</span>
                  <NightModeToggle />
                </div>
                <div className="flex items-center justify-between gap-3 px-2 py-1">
                  <span className="text-xs text-muted">Vibrations</span>
                  <HapticsToggle />
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
