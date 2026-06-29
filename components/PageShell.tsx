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
    <main className={joinClasses("mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-5 pb-8 pt-6 sm:px-8", className)}>
      {eyebrow || title || action ? (
        <header className="flex items-center justify-between gap-4 py-2">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent-cyan">{eyebrow}</p>
            ) : null}
            {title ? (
              <h1 className="mt-1 truncate text-3xl font-bold tracking-[-0.04em] text-white">{title}</h1>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className={joinClasses("flex-1", contentClassName)}>{children}</div>
    </main>
  );
}
