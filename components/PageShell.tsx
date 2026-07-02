import type { ReactNode } from "react";
import { HapticsToggle } from "@/components/HapticsToggle";
import { NightModeToggle } from "@/components/NightModeToggle";

type PageShellProps = {
  eyebrow?: string;
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function PageShell({
  eyebrow,
  title,
  action,
  children,
  className,
  contentClassName,
}: PageShellProps) {
  const hasHeading = Boolean(eyebrow || title);

  return (
    <main
      className={joinClasses(
        "mx-auto flex min-h-[100dvh] w-full max-w-[600px] flex-col px-5 pb-6",
        className,
      )}
    >
      <header className="sticky top-0 z-30 mb-5 -mx-5 border-b border-white/[0.06] bg-[#0a0a0b]/85 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-[24px]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true">
              <circle cx="12" cy="5" r="1.2" fill="currentColor" />
              <circle cx="7" cy="16" r="0.8" fill="currentColor" opacity=".7" />
              <circle cx="19" cy="14" r="1" fill="currentColor" opacity=".85" />
              <path
                d="M12 5 L7 16 L19 14 Z"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth=".5"
              />
            </svg>
            <div className="min-w-0">
              {hasHeading ? (
                <>
                  {eyebrow ? (
                    <p className="premium-kicker truncate">{eyebrow}</p>
                  ) : (
                    <p className="premium-kicker truncate">SkyQuest</p>
                  )}
                  {title ? (
                    <h1 className="mt-0.5 truncate font-[Georgia,'Times_New_Roman',serif] text-[1.55rem] font-normal tracking-[-0.03em] text-white">
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
            <HapticsToggle />
            <NightModeToggle />
          </div>
        </div>
      </header>
      <div className={joinClasses("flex-1", contentClassName)}>{children}</div>
    </main>
  );
}
