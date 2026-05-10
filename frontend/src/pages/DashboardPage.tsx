import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { subscribeToUserPolls } from "@/lib/pollService";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Calendar, MapPin, ExternalLink, Activity } from "lucide-react";
import type { Poll } from "../types/index";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading || !user || user.isAnonymous) {
      setFetching(false);
      return;
    }

    setFetching(true);
    const unsubscribe = subscribeToUserPolls(user.uid, (fetchedPolls) => {
      setPolls(fetchedPolls);
      setFetching(false);
    });

    return () => unsubscribe();
  }, [user, loading]);

  if (loading || fetching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-brand-green animate-spin" />
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
    <div className="max-w-4xl mx-auto py-4 sm:py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">Your Polls</h1>
        <p className="text-neutral-500 mt-1">Manage and finalize your created polls</p>
      </div>

      {polls.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-neutral-200 text-center shadow-sm">
          <div className="w-16 h-16 bg-brand-green-light/30 text-brand-green rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar size={32} />
          </div>
          <h2 className="text-xl font-bold text-neutral-800 mb-2">No polls yet</h2>
          <p className="text-neutral-500 max-w-md mx-auto mb-6">
            You haven't created any polls yet. Get started by creating your first poll to find the perfect meeting time.
          </p>
          <Link
            to="/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-green-light text-brand-green-dark rounded-xl font-bold hover:bg-brand-green-light/50 transition-colors"
          >
            Create your first poll
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6">
          {polls.map((poll) => (
            <div
              key={poll.pollId}
              className="bg-white p-5 sm:p-7 rounded-[2.5rem] border border-neutral-100 shadow-sm hover:shadow-xl hover:shadow-brand-green/5 transition-all duration-300 group"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-xl sm:text-2xl font-black text-neutral-800 tracking-tight group-hover:text-brand-green transition-colors">{poll.title}</h2>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      poll.status === "OPEN" 
                        ? "bg-brand-green-light text-brand-green-dark" 
                        : "bg-red-50 text-red-600"
                    }`}>
                      {poll.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-y-2 gap-x-5 text-sm text-neutral-500 font-medium">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-brand-green" />
                      <span>{new Date(poll.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    {poll.location && (
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-brand-green" />
                        <span>{poll.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Activity size={16} className="text-brand-green" />
                      <span>{poll.schedulingMode === "EXACT" ? "Exact Time" : "General Blocks"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <Link
                    to={`/poll/${poll.pollId}`}
                    className="flex-1 md:flex-none px-6 py-3 bg-neutral-50 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition-all text-sm border border-neutral-100 text-center"
                  >
                    View Poll
                  </Link>
                  <Link
                    to={`/poll/${poll.pollId}/results`}
                    className={`flex-1 md:flex-none px-6 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 text-sm shadow-md shadow-brand-green/10 ${
                      poll.status === "OPEN" 
                        ? "bg-brand-green text-white hover:bg-brand-green-dark" 
                        : "bg-brand-red text-white hover:bg-brand-red-dark"
                    }`}
                  >
                    <ExternalLink size={16} />
                    Results
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
