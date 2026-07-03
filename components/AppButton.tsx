import type { MouseEvent } from "react";
import type { HTMLMotionProps } from "framer-motion";
import { motion, useReducedMotion } from "framer-motion";
import { haptic } from "@/lib/haptics";

type AppButtonVariant = "primary" | "secondary" | "ghost" | "success" | "danger";
type AppButtonSize = "sm" | "md" | "lg";

type AppButtonProps = Omit<HTMLMotionProps<"button">, "ref"> & {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  hapticFeedback?: boolean;
};

const baseClasses = [
  "inline-flex items-center justify-center rounded-full border font-semibold tracking-[-0.01em]",
  "transition-[transform,background-color,border-color,box-shadow,color] duration-200 ease-brand-out active:scale-[0.985]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "disabled:cursor-not-allowed disabled:opacity-70",
].join(" ");

const variantClasses: Record<AppButtonVariant, string> = {
  primary:
    "border-white/10 bg-accent text-white shadow-[0_4px_20px_color-mix(in_srgb,var(--accent)_30%,transparent)] hover:-translate-y-px hover:bg-brand-primary-hover",
  secondary: "border-white/[0.14] bg-transparent text-text hover:bg-surface",
  ghost:
    "border-white/[0.10] bg-white/[0.035] text-text hover:border-white/[0.18] hover:bg-white/[0.06]",
  success: "border-success/20 bg-success/[0.08] text-success hover:bg-success/[0.13]",
  danger: "border-danger/20 bg-danger/[0.08] text-danger hover:bg-danger/[0.13]",
};

const sizeClasses: Record<AppButtonSize, string> = {
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-13 px-5 text-[0.95rem]",
  lg: "min-h-15 px-6 text-base",
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
  return joinClasses(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && "w-full",
    className,
  );
}

export function AppButton({
  variant = "primary",
  size = "md",
  fullWidth = false,
  isLoading = false,
  hapticFeedback = true,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: AppButtonProps) {
  const handleClick = props.onClick
    ? (event: MouseEvent<HTMLButtonElement>) => {
        if (hapticFeedback) haptic("tap");
        props.onClick?.(event);
      }
    : undefined;
  const prefersReducedMotion = useReducedMotion() ?? false;
  const canAnimate = !disabled && !isLoading && !prefersReducedMotion;

  return (
    <motion.button
      {...props}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={getAppButtonClassName({ variant, size, fullWidth, className })}
      onClick={handleClick}
      whileHover={canAnimate ? { scale: 1.02 } : undefined}
      whileTap={canAnimate ? { scale: 0.96 } : undefined}
    >
      {children}
    </motion.button>
  );
}
