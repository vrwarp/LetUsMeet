import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import Button from "../Button";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import {
  ConfirmContext,
  type ConfirmOptions,
  type ConfirmVariant,
} from "./confirmContext";

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

const ICON_STYLES: Record<ConfirmVariant, string> = {
  danger: "bg-brand-red/10 text-brand-red",
  warning: "bg-amber-100 text-amber-700",
};

/**
 * Provides the promise-based `useConfirm` API and renders a single styled
 * alertdialog via a portal to document.body. Focus is trapped within the
 * dialog, Escape and backdrop click cancel, and focus is restored on close.
 */
export default function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useFocusTrap(dialogRef, pending !== null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const close = useCallback(
    (result: boolean) => {
      setPending((current) => {
        current?.resolve(result);
        return null;
      });
    },
    []
  );

  useEffect(() => {
    if (!pending) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [pending, close]);

  const portalTarget = typeof document !== "undefined" ? document.body : null;
  const variant: ConfirmVariant = pending?.variant ?? "warning";
  const primaryVariant = variant === "danger" ? "danger" : "primary";
  const emphasizeCancel = pending?.emphasizeCancel ?? false;

  const cancelButton = (
    <Button
      key="cancel"
      variant={emphasizeCancel ? primaryVariant : "secondary"}
      data-testid="confirm-dialog-cancel"
      onClick={() => close(false)}
    >
      {pending?.cancelLabel ?? "Cancel"}
    </Button>
  );
  const confirmButton = (
    <Button
      key="confirm"
      variant={emphasizeCancel ? "secondary" : primaryVariant}
      data-testid="confirm-dialog-confirm"
      onClick={() => close(true)}
    >
      {pending?.confirmLabel ?? "Confirm"}
    </Button>
  );
  // Keep the emphasized (primary) button in the trailing / right-hand slot.
  const actionButtons = emphasizeCancel
    ? [confirmButton, cancelButton]
    : [cancelButton, confirmButton];

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending &&
        portalTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-[250] flex items-center justify-center bg-brand-charcoal/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close(false);
            }}
          >
            <div
              ref={dialogRef}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={pending.body ? bodyId : undefined}
              className="bg-white rounded-[2rem] w-full max-w-md p-8 border border-neutral-100 shadow-2xl animate-in zoom-in-95 duration-200"
            >
              <div className="flex flex-col gap-5">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${ICON_STYLES[variant]}`}
                    aria-hidden="true"
                  >
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2
                      id={titleId}
                      className="text-xl font-bold text-neutral-800 leading-tight"
                    >
                      {pending.title}
                    </h2>
                    {pending.body && (
                      <p
                        id={bodyId}
                        className="mt-2 text-neutral-600 text-sm font-medium leading-relaxed"
                      >
                        {pending.body}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-3">
                  {actionButtons}
                </div>
              </div>
            </div>
          </div>,
          portalTarget
        )}
    </ConfirmContext.Provider>
  );
}
