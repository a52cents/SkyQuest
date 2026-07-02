import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";

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
    <main
      className={joinClasses(
        "mx-auto flex min-h-[100dvh] w-full max-w-[600px] flex-col px-5 pb-6",
        className,
      )}
    >
      <AppHeader eyebrow={eyebrow} title={title} action={action} className="-mx-5 mb-5" />
      <div className={joinClasses("flex-1", contentClassName)}>{children}</div>
    </main>
  );
}
