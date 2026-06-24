import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export type ModalSize = "md" | "lg" | "fullscreen";
export type ModalVariant = "card" | "bare";

export interface ModalProps {
  /** Whether the modal is mounted/visible. */
  open: boolean;
  /** Called when the modal requests to close (Escape / backdrop click). */
  onClose: () => void;
  /** id of the heading element that labels the dialog (aria-labelledby). */
  labelledBy?: string;
  /** Panel max-width / layout. Defaults to "md". */
  size?: ModalSize;
  /**
   * "card" applies the standard white rounded panel chrome; "bare" renders the
   * panel with no card styling (e.g. the ResultsPage maximize grid). Defaults
   * to "card".
   */
  variant?: ModalVariant;
  /**
   * Whether Escape and backdrop click close the modal. Forced overlays (e.g.
   * crypto recovery / device enrollment) pass `false`. Defaults to true.
   * `closeOnEscape` / `closeOnBackdrop` can override each independently.
   */
  dismissable?: boolean;
  /** Override Escape-to-close. Defaults to `dismissable`. */
  closeOnEscape?: boolean;
  /** Override backdrop-click-to-close. Defaults to `dismissable`. */
  closeOnBackdrop?: boolean;
  /** ARIA role for the panel. Defaults to "dialog". Pass null to omit. */
  role?: string | null;
  /** Whether the panel sets aria-modal="true". Defaults to true. */
  ariaModal?: boolean;
  /** data-testid forwarded to the panel element. */
  testId?: string;
  /** Extra classes appended to the panel element. */
  className?: string;
  /** Inline style applied to the panel element. */
  panelStyle?: CSSProperties;
  /** Override classes for the backdrop element. */
  backdropClassName?: string;
  children: ReactNode;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  md: "w-full max-w-md",
  lg: "w-full max-w-lg",
  fullscreen: "",
};

const CARD_CHROME =
  "bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-xl border border-neutral-100";

const DEFAULT_BACKDROP =
  "fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-md bg-neutral-900/40";

/**
 * Shared overlay shell. Renders (via a portal to document.body when `open`) a
 * backdrop plus a panel with `role="dialog" aria-modal="true"`, and centralizes
 * the a11y behavior previously re-implemented at each modal site:
 *
 * - focus trap within the panel (existing `useFocusTrap` hook),
 * - focus restore to the previously-focused element on close (also from the hook),
 * - Escape-to-close and backdrop-click-to-close for dismissable modals.
 *
 * Inner content (headings, buttons, data-testids) is passed as children and is
 * rendered unchanged.
 */
export default function Modal({
  open,
  onClose,
  labelledBy,
  size = "md",
  variant = "card",
  dismissable = true,
  closeOnEscape,
  closeOnBackdrop,
  role = "dialog",
  ariaModal = true,
  testId,
  className = "",
  panelStyle,
  backdropClassName,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const escapeEnabled = closeOnEscape ?? dismissable;
  const backdropEnabled = closeOnBackdrop ?? dismissable;

  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open || !escapeEnabled) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, escapeEnabled, onClose]);

  if (!open) return null;
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!portalTarget) return null;

  const panelClasses = [
    variant === "card" ? CARD_CHROME : "",
    SIZE_CLASSES[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div
      className={backdropClassName ?? DEFAULT_BACKDROP}
      onMouseDown={
        backdropEnabled
          ? (e) => {
              if (e.target === e.currentTarget) onClose();
            }
          : undefined
      }
    >
      <div
        ref={panelRef}
        role={role ?? undefined}
        aria-modal={ariaModal ? "true" : undefined}
        aria-labelledby={labelledBy}
        data-testid={testId}
        className={panelClasses}
        style={panelStyle}
      >
        {children}
      </div>
    </div>,
    portalTarget
  );
}
