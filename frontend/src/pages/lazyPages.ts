import { lazy } from "react";

// Lazily-loaded route pages, each emitted as its own JS chunk and fetched on
// demand. Kept in a dedicated module (only component exports) so router.tsx can
// have its single non-component `router` export without tripping
// react-refresh/only-export-components.
export const CreatePollPage = lazy(() => import("@/pages/CreatePollPage"));
export const VotePollPage = lazy(() => import("@/pages/VotePollPage"));
export const ResultsPage = lazy(() => import("@/pages/ResultsPage"));
export const EditPollPage = lazy(() => import("@/pages/EditPollPage"));
export const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
export const PrivacyPolicyPage = lazy(() => import("@/pages/PrivacyPolicyPage"));
export const TermsOfServicePage = lazy(() => import("@/pages/TermsOfServicePage"));
export const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
