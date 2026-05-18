import { createBrowserRouter } from "react-router-dom";
import HomePage from "@/pages/HomePage";
import CreatePollPage from "@/pages/CreatePollPage";
import VotePollPage from "@/pages/VotePollPage";
import ResultsPage from "@/pages/ResultsPage";
import Layout from "@/components/Layout";
import DashboardPage from "@/pages/DashboardPage";
import EditPollPage from "@/pages/EditPollPage";
import PrivacyPolicyPage from "@/pages/PrivacyPolicyPage";
import TermsOfServicePage from "@/pages/TermsOfServicePage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/create", element: <CreatePollPage /> },
      { path: "/poll/:pollId", element: <VotePollPage /> },
      { path: "/poll/:pollId/results", element: <ResultsPage /> },
      { path: "/poll/:pollId/edit", element: <EditPollPage /> },
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/privacy", element: <PrivacyPolicyPage /> },
      { path: "/terms", element: <TermsOfServicePage /> },
    ],
  },
]);
