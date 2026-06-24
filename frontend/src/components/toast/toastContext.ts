import { createContext, useContext } from "react";

export type ToastVariant = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms. Defaults to 4000 for success/info; error toasts are sticky. */
  duration?: number;
  action?: ToastAction;
}

export interface ToastItem extends Required<Pick<ToastOptions, "message">> {
  id: string;
  variant: ToastVariant;
  duration: number | null;
  action?: ToastAction;
}

export interface ToastContextValue {
  toast: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Returns the toast API. Must be used within a <ToastProvider>.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
