import { Loader2 } from "lucide-react";

interface Props {
  /** Visible status text rendered in the `<p>`. */
  message?: string;
  /** Optional `data-testid` placed on the wrapper (preserves the `"loader"` hook some pages rely on). */
  testId?: string;
  /** Optional screen-reader-only `<h1>` heading (e.g. "Loading results"). */
  heading?: string;
  /**
   * When true, the status semantics live on the wrapper `<div role="status">`
   * (Dashboard variant). When false (default), the `<p>` carries
   * `role="status" aria-live="polite"` (Results/Vote/Edit variant).
   */
  statusOnWrapper?: boolean;
  /** Tailwind text-colour class for the message (`text-neutral-600` vs `text-neutral-500`). */
  messageClassName?: string;
}

/**
 * Shared full-screen loading spinner. Extracted from the four duplicated
 * spinner blocks (ResultsPage, VotePollPage, EditPollPage, DashboardPage) and
 * reused as the route-level <Suspense> fallback. Props keep each call site's
 * exact markup (test ids, aria roles, headings, colours) byte-for-byte.
 */
export default function PageLoader({
  message,
  testId,
  heading,
  statusOnWrapper = false,
  messageClassName = "text-neutral-600",
}: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] gap-4"
      data-testid={testId}
      role={statusOnWrapper ? "status" : undefined}
    >
      {heading && <h1 className="sr-only">{heading}</h1>}
      <Loader2 className="w-10 h-10 text-brand-green animate-spin" aria-hidden="true" />
      {message !== undefined && (
        <p
          role={statusOnWrapper ? undefined : "status"}
          aria-live={statusOnWrapper ? undefined : "polite"}
          className={`${messageClassName} font-medium`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
