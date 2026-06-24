export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const SHARED_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-xl transition-all disabled:opacity-50 disabled:pointer-events-none focus-ring";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-green text-white font-bold hover:bg-brand-green-dark active:scale-95",
  secondary:
    "bg-white text-brand-charcoal border border-neutral-200 hover:bg-neutral-50",
  ghost: "bg-transparent text-brand-charcoal hover:bg-neutral-100",
  danger:
    "bg-brand-red text-white font-bold hover:bg-brand-red-dark active:scale-95",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-base",
  lg: "px-8 py-4 text-lg",
};

/**
 * Returns the canonical Button class string for a given variant and size.
 * Useful for styling non-<button> elements (e.g. react-router <Link>) so they
 * share the exact same visual treatment as <Button>.
 */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className = ""
): string {
  return [SHARED_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className]
    .filter(Boolean)
    .join(" ");
}
