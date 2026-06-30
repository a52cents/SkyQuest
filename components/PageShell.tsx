import type { ReactNode } from "react";

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
  return (
    <main className={joinClasses("mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6", className)}>
      {eyebrow || title || action ? (
        <header className="mb-4 flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4 pt-1">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.10] bg-white/[0.045] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" aria-hidden="true">
              <span className="h-4 w-4 rounded-full border border-accent-cyan/75 shadow-[0_0_16px_rgba(115,201,235,0.28)]" />
              <span className="absolute h-px w-6 -rotate-[24deg] bg-accent/80" />
            </div>
            <div className="min-w-0">
            {eyebrow ? (
              <p className="premium-kicker truncate">{eyebrow}</p>
            ) : null}
            {title ? (
              <h1 className="mt-0.5 truncate text-[1.65rem] font-bold tracking-[-0.045em] text-white">{title}</h1>
            ) : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className={joinClasses("flex-1", contentClassName)}>{children}</div>
    </main>
  );
}
