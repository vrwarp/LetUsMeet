"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Calendar, MapPin, ExternalLink, Activity } from "lucide-react";
import type { Poll } from "@/types/index";

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
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Your Polls</h1>
          <p className="text-neutral-500 mt-1">Manage and finalize your created polls</p>
        </div>
        <Link
          href="/create"
          className="btn-primary-green !px-6 !py-2.5 !text-base"
        >
          Create New Poll
        </Link>
      </div>

      {polls.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-neutral-200 text-center shadow-sm">
          <div className="w-16 h-16 bg-brand-green-light/30 text-brand-green rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar size={32} />
          </div>
          <h3 className="text-xl font-bold text-neutral-800 mb-2">No polls yet</h3>
          <p className="text-neutral-500 max-w-md mx-auto mb-6">
            You haven't created any polls yet. Get started by creating your first poll to find the perfect meeting time.
          </p>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-green-light text-brand-green-dark rounded-xl font-bold hover:bg-brand-green-light/50 transition-colors"
          >
            Create your first poll
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          {polls.map((poll) => (
            <div
              key={poll.pollId}
              className={`event-card ${poll.status === "OPEN" ? "event-card-green" : "event-card-red"}`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className={`text-xl font-black ${poll.status === "OPEN" ? "text-brand-green-dark" : "text-brand-red-dark"}`}>{poll.title}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      poll.status === "OPEN" ? "bg-white text-brand-green-dark" : "bg-white text-brand-red"
                    }`}>
                      {poll.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-600 font-medium">
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
                    href={`/poll/${poll.pollId}`}
                    className="px-4 py-2 bg-white/50 text-neutral-700 rounded-lg font-bold hover:bg-white transition-colors text-sm border border-black/5"
                  >
                    View Poll
                  </Link>
                  <Link
                    href={`/poll/${poll.pollId}/results`}
                    className={`px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 text-sm shadow-sm ${
                      poll.status === "OPEN" ? "bg-brand-green text-white hover:bg-brand-green-dark" : "bg-brand-red text-white hover:bg-brand-red-dark"
                    }`}
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
