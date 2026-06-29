import type { ButtonHTMLAttributes } from "react";

type AppButtonVariant = "primary" | "secondary" | "ghost" | "success" | "danger";
type AppButtonSize = "sm" | "md" | "lg";

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
};

const baseClasses = [
  "inline-flex items-center justify-center rounded-full font-extrabold",
  "transition duration-[var(--brand-motion-duration-mid)] ease-brand-out active:scale-[0.98]",
  "disabled:cursor-not-allowed disabled:opacity-70",
].join(" ");

const variantClasses: Record<AppButtonVariant, string> = {
  primary: "bg-accent px-5 text-white shadow-[0_16px_40px_color-mix(in_srgb,var(--accent)_35%,transparent)] hover:bg-brand-primary-hover",
  secondary: "border border-accent-cyan/25 bg-accent-cyan/12 text-[#d7f8ff]",
  ghost: "border border-brand-border bg-white/[0.06] text-white",
  success: "border border-success/25 bg-success/12 text-[#9df0c4]",
  danger: "border border-danger/25 bg-danger/10 text-[#ffd2dc]",
};

const sizeClasses: Record<AppButtonSize, string> = {
  sm: "min-h-12 px-4 text-sm",
  md: "min-h-14 px-5 text-base",
  lg: "min-h-16 px-7 text-lg",
};

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function getAppButtonClassName({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return joinClasses(baseClasses, variantClasses[variant], sizeClasses[size], fullWidth && "w-full", className);
}

export function AppButton({
  variant = "primary",
  size = "md",
  fullWidth = false,
  isLoading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: AppButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={getAppButtonClassName({ variant, size, fullWidth, className })}
      {...props}
    >
      {children}
    </button>
  );
}
