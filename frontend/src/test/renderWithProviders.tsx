import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import ToastProvider from "@/components/toast/ToastProvider";
import ConfirmProvider from "@/components/confirm/ConfirmProvider";

/**
 * Wraps the tree in the app-wide ToastProvider + ConfirmProvider so pages that
 * consume useToast()/useConfirm() can render in tests exactly as they do in the
 * real app (where main.tsx mounts both providers).
 */
function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
): RenderResult {
  return render(ui, { wrapper: Providers, ...options });
}

export * from "@testing-library/react";
