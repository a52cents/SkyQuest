import type { HTMLAttributes } from "react";

type AppCardVariant = "glass" | "solid" | "subtle";
type AppCardPadding = "sm" | "md" | "lg";
type AppCardElement = "div" | "article" | "section";

type AppCardProps = HTMLAttributes<HTMLElement> & {
  as?: AppCardElement;
  variant?: AppCardVariant;
  padding?: AppCardPadding;
};

const variantClasses: Record<AppCardVariant, string> = {
  glass: "glass-card",
  solid: "border border-white/[0.06] bg-surface-strong shadow-[0_16px_40px_rgba(0,0,0,0.16)]",
  subtle: "border border-white/[0.06] bg-surface",
};

const paddingClasses: Record<AppCardPadding, string> = {
  sm: "p-4",
  md: "p-5",
  lg: "p-6 sm:p-8",
};

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AppCard({
  as: Component = "div",
  variant = "glass",
  padding = "md",
  className,
  children,
  ...props
}: AppCardProps) {
  return (
    <Component
      className={joinClasses(
        "rounded-[20px]",
        variantClasses[variant],
        paddingClasses[padding],
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
