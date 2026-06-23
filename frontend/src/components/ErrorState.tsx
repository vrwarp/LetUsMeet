import { Link } from "react-router-dom";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Button from "./Button";
import { buttonClasses } from "./buttonStyles";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/**
 * A friendly full-page error state. Used as the default fallback for
 * <ErrorBoundary> and as the router `errorElement` so unexpected render/loader
 * errors degrade gracefully instead of showing a white screen.
 */
export default function ErrorState({
  title = "Something went wrong",
  message = "This page hit an unexpected error.",
  onRetry,
}: ErrorStateProps) {
  const handleRetry = onRetry ?? (() => window.location.reload());

  return (
    <div
      role="alert"
      className="max-w-2xl mx-auto px-4 py-20 text-center flex flex-col items-center"
    >
      <div
        className="w-16 h-16 bg-brand-red/10 rounded-2xl flex items-center justify-center text-brand-red mb-6"
        aria-hidden="true"
      >
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold text-neutral-800 mb-4">{title}</h1>
      <p className="text-neutral-600 text-lg mb-8 max-w-md">{message}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="primary" size="lg" onClick={handleRetry}>
          <RotateCcw className="w-5 h-5" aria-hidden="true" />
          Reload
        </Button>
        <Link to="/" className={buttonClasses("secondary", "lg")}>
          <Home className="w-5 h-5" aria-hidden="true" />
          Go home
        </Link>
      </div>
    </div>
  );
}
