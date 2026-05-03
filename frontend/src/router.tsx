import { createBrowserRouter } from "react-router-dom";
import HomePage from "@/pages/HomePage";
import CreatePollPage from "@/pages/CreatePollPage";
import VotePollPage from "@/pages/VotePollPage";
import ResultsPage from "@/pages/ResultsPage";
import Layout from "@/components/Layout";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/create", element: <CreatePollPage /> },
      { path: "/poll/:pollId", element: <VotePollPage /> },
      { path: "/poll/:pollId/results", element: <ResultsPage /> },
    ],
  },
]);
