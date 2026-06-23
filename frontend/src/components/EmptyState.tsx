import type { ReactNode } from "react";

export interface EmptyStateProps {
  /** Icon / icon-chip rendered above the heading. */
  icon?: ReactNode;
  /** Primary heading. Optional for minimal states that only show body copy. */
  title?: string;
  /** Supporting body copy. */
  body?: string;
  /** Optional call-to-action (e.g. a Link/Button) rendered below the body. */
  action?: ReactNode;
  /** Extra classes appended to the outer card (overrides the default card). */
  className?: string;
  /** Override classes for the heading element. */
  titleClassName?: string;
  /** Override classes for the body paragraph. */
  bodyClassName?: string;
  /** data-testid forwarded to the outer card. */
  testId?: string;
}

const DEFAULT_CARD =
  "bg-white p-12 rounded-[3rem] border border-neutral-100 text-center shadow-xl shadow-neutral-100/50";
const DEFAULT_TITLE = "text-xl font-bold text-neutral-800 mb-2";
const DEFAULT_BODY = "text-neutral-500 max-w-md mx-auto mb-8 font-medium";

/**
 * Shared "icon chip + heading + body + optional CTA in a soft rounded card"
 * empty-state pattern. Copy and any test-ids are passed in by the caller so the
 * rendered text stays identical to the hand-rolled blocks it replaces.
 */
export default function EmptyState({
  icon,
  title,
  body,
  action,
  className,
  titleClassName,
  bodyClassName,
  testId,
}: EmptyStateProps) {
  return (
    <div data-testid={testId} className={className ?? DEFAULT_CARD}>
      {icon}
      {title && <h2 className={titleClassName ?? DEFAULT_TITLE}>{title}</h2>}
      {body && <p className={bodyClassName ?? DEFAULT_BODY}>{body}</p>}
      {action}
    </div>
  );
}
