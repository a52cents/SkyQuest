import Image from "next/image";
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
        "sticky top-0 z-30 border-b border-white/[0.06] bg-[#0a0a0b]/85 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-[24px]",
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
  );
}
