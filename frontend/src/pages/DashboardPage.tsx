import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Calendar, MapPin, ExternalLink, Activity } from "lucide-react";
import type { Poll } from "../types/index";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    async function fetchPolls() {
      if (!user || user.isAnonymous) {
        setFetching(false);
        return;
      }

      try {
        const pollsRef = collection(db, "polls");
        const q = query(
          pollsRef,
          where("organizerUid", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const fetchedPolls: Poll[] = [];
        querySnapshot.forEach((doc) => {
          fetchedPolls.push(doc.data() as Poll);
        });
        setPolls(fetchedPolls);
      } catch (error) {
        console.error("Error fetching polls:", error);
      } finally {
        setFetching(false);
      }
    }

    if (!loading) {
      fetchPolls();
    }
  }, [user, loading]);

  if (loading || fetching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-neutral-500 font-medium">Loading your dashboard...</p>
      </div>
    );
  }

  if (!user || user.isAnonymous) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-neutral-800 mb-4">Please sign in to view your dashboard</h2>
        <p className="text-neutral-600">You need an organizer account to access this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Your Polls</h1>
          <p className="text-neutral-500 mt-1">Manage and finalize your created polls</p>
        </div>
        <Link
          to="/create"
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          Create New Poll
        </Link>
      </div>

      {polls.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-neutral-200 text-center shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar size={32} />
          </div>
          <h3 className="text-xl font-bold text-neutral-800 mb-2">No polls yet</h3>
          <p className="text-neutral-500 max-w-md mx-auto mb-6">
            You haven't created any polls yet. Get started by creating your first poll to find the perfect meeting time.
          </p>
          <Link
            to="/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold hover:bg-indigo-100 transition-colors"
          >
            Create your first poll
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {polls.map((poll) => (
            <div
              key={poll.pollId}
              className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm hover:border-indigo-200 transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-neutral-900">{poll.title}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      poll.status === "OPEN" ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-700"
                    }`}>
                      {poll.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={16} />
                      <span>{new Date(poll.createdAt).toLocaleDateString()}</span>
                    </div>
                    {poll.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin size={16} />
                        <span>{poll.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Activity size={16} />
                      <span>{poll.schedulingMode}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    to={`/poll/${poll.pollId}`}
                    className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg font-medium hover:bg-neutral-200 transition-colors text-sm"
                  >
                    View Poll
                  </Link>
                  <Link
                    to={`/poll/${poll.pollId}/results`}
                    className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-medium hover:bg-indigo-100 transition-colors flex items-center gap-1.5 text-sm"
                  >
                    <ExternalLink size={16} />
                    Results & Finalize
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
