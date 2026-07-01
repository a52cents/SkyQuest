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
    <main className={joinClasses("mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6", className)}>
      <header className="sticky top-0 z-30 mb-4 -mx-4 border-b border-white/[0.08] bg-background/85 px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl sm:-mx-8 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.10] bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" aria-hidden="true">
              <span className="h-4 w-4 rounded-full border border-accent-cyan/75 shadow-[0_0_16px_rgba(115,201,235,0.28)]" />
              <span className="absolute h-px w-6 -rotate-[24deg] bg-accent/80" />
            </div>
            <div className="min-w-0">
              {hasHeading ? (
                <>
                  {eyebrow ? <p className="premium-kicker truncate">{eyebrow}</p> : <p className="premium-kicker truncate">SkyQuest</p>}
                  {title ? <h1 className="mt-0.5 truncate text-[1.65rem] font-bold tracking-[-0.045em] text-white">{title}</h1> : null}
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
