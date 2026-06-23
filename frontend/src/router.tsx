import { createBrowserRouter } from "react-router-dom";
import HomePage from "@/pages/HomePage";
import Layout from "@/components/Layout";
import ErrorState from "@/components/ErrorState";
import {
  CreatePollPage,
  VotePollPage,
  ResultsPage,
  EditPollPage,
  DashboardPage,
  PrivacyPolicyPage,
  TermsOfServicePage,
  NotFoundPage,
} from "@/pages/lazyPages";

// Route-level code-splitting: each non-landing page is a separate, on-demand JS
// chunk (see src/pages/lazyPages.ts). HomePage + Layout stay eager (above-the-
// fold shell). The <Suspense> fallback covering these lazy routes lives in
// Layout, around the routed <Outlet />, so the header/nav persist during loads.
export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <ErrorState title="This page failed to load" />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/create", element: <CreatePollPage /> },
      { path: "/poll/:pollId", element: <VotePollPage /> },
      { path: "/poll/:pollId/results", element: <ResultsPage /> },
      { path: "/poll/:pollId/edit", element: <EditPollPage /> },
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/privacy", element: <PrivacyPolicyPage /> },
      { path: "/terms", element: <TermsOfServicePage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
