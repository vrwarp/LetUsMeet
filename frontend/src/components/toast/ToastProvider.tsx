import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import {
  ToastContext,
  type ToastItem,
  type ToastOptions,
  type ToastVariant,
} from "./toastContext";

const DEFAULT_SUCCESS_DURATION = 4000;

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "bg-brand-green-light border-brand-green/30 text-brand-green-dark",
  error: "bg-red-50 border-red-200 text-red-800",
  info: "bg-neutral-50 border-neutral-200 text-neutral-700",
};

const VARIANT_ICON_STYLES: Record<ToastVariant, string> = {
  success: "text-brand-green",
  error: "text-red-500",
  info: "text-neutral-500",
};

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const className = `w-5 h-5 flex-shrink-0 ${VARIANT_ICON_STYLES[variant]}`;
  if (variant === "success") return <CheckCircle className={className} aria-hidden="true" />;
  if (variant === "error") return <AlertCircle className={className} aria-hidden="true" />;
  return <Info className={className} aria-hidden="true" />;
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      role={item.variant === "error" ? "alert" : "status"}
      className={`pointer-events-auto flex items-start gap-3 w-full max-w-sm p-4 rounded-2xl border shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300 ${VARIANT_STYLES[item.variant]}`}
    >
      <ToastIcon variant={item.variant} />
      <p className="flex-1 min-w-0 text-sm font-medium leading-snug break-words">
        {item.message}
      </p>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action?.onClick();
            onDismiss(item.id);
          }}
          className="focus-ring flex-shrink-0 text-sm font-bold underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          {item.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
        className="focus-ring flex-shrink-0 p-0.5 rounded-md opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Provides the `useToast` API and renders the toast region via a portal to
 * document.body so toasts layer above all page content. Success/info toasts go
 * in a polite live region; error toasts use role="alert" for assertiveness.
 */
export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (opts: ToastOptions): string => {
      const variant: ToastVariant = opts.variant ?? "info";
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Error toasts are sticky unless a duration is explicitly provided.
      const duration =
        opts.duration ?? (variant === "error" ? null : DEFAULT_SUCCESS_DURATION);

      const item: ToastItem = {
        id,
        message: opts.message,
        variant,
        duration,
        action: opts.action,
      };

      setToasts((prev) => [...prev, item]);

      if (duration !== null) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }

      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  const politeToasts = toasts.filter((t) => t.variant !== "error");
  const errorToasts = toasts.filter((t) => t.variant === "error");

  const portalTarget = typeof document !== "undefined" ? document.body : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {portalTarget &&
        createPortal(
          <div className="fixed bottom-0 right-0 z-[200] flex flex-col items-end gap-3 p-4 pointer-events-none max-h-screen overflow-hidden">
            <div aria-live="assertive" className="flex flex-col items-end gap-3 w-full">
              {errorToasts.map((item) => (
                <ToastCard key={item.id} item={item} onDismiss={dismiss} />
              ))}
            </div>
            <div aria-live="polite" className="flex flex-col items-end gap-3 w-full">
              {politeToasts.map((item) => (
                <ToastCard key={item.id} item={item} onDismiss={dismiss} />
              ))}
            </div>
          </div>,
          portalTarget
        )}
    </ToastContext.Provider>
  );
}
