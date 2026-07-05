import { createContext, useContext } from "react";

export type ConfirmVariant = "danger" | "warning";

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  /**
   * Give the cancel button primary emphasis and de-emphasize the confirm button
   * to secondary. Use when dismissing is the recommended choice (e.g. a "try
   * anyway" escape hatch). Resolution semantics are unchanged — confirm still
   * resolves true and cancel/escape/backdrop still resolve false — so the safe
   * path stays tied to dismissal.
   */
  emphasizeCancel?: boolean;
}

export type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Returns a promise-based confirm function. Resolves true on confirm, false on
 * cancel/escape/backdrop. Must be used within a <ConfirmProvider>.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return ctx;
}
