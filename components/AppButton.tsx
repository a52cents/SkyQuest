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
};

const baseClasses = [
  "inline-flex items-center justify-center rounded-[16px] border font-bold tracking-[-0.01em]",
  "transition-[transform,background-color,border-color,box-shadow,color] duration-200 ease-brand-out active:scale-[0.985]",
  "disabled:cursor-not-allowed disabled:opacity-70",
].join(" ");

const variantClasses: Record<AppButtonVariant, string> = {
  primary: "border-white/10 bg-accent px-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_12px_30px_rgba(42,34,118,0.28)] hover:-translate-y-px hover:bg-brand-primary-hover hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_16px_34px_rgba(42,34,118,0.34)]",
  secondary: "border-accent-cyan/20 bg-accent-cyan/[0.08] text-[#a8e1f5] hover:border-accent-cyan/35 hover:bg-accent-cyan/[0.12]",
  ghost: "border-white/[0.10] bg-white/[0.045] text-[#e9ebf4] hover:border-white/[0.18] hover:bg-white/[0.075]",
  success: "border-success/20 bg-success/[0.09] text-[#a8dfc2] hover:bg-success/[0.14]",
  danger: "border-danger/20 bg-danger/[0.08] text-[#f0aaaa] hover:bg-danger/[0.13]",
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
  const handleClick = props.onClick
    ? (event: MouseEvent<HTMLButtonElement>) => {
        haptic("tap");
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
