import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { subscribeToUserKeystore, loadFromKeystore, getGenesisEvent } from "@/lib/pollService";
import { importSymmetricKey } from "@/lib/crypto";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Calendar, MapPin, ExternalLink, Activity, Lock } from "lucide-react";
import type { PollMetadata } from "../types";

interface DecryptedDashboardEntry {
  pollId: string;
  symmetricKey: string;
  metadata: PollMetadata;
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [entries, setEntries] = useState<DecryptedDashboardEntry[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading || !user || user.isAnonymous) {
      setFetching(false);
      return;
    }

    setFetching(true);
    const unsubscribe = subscribeToUserKeystore(user.uid, async (keystoreEntries) => {
      const decryptedEntries: DecryptedDashboardEntry[] = [];

      for (const entry of keystoreEntries) {
        try {
          // 1. Load symmetric key from keystore
          const keystoreData = await loadFromKeystore(entry.pollId);
          if (!keystoreData) continue;

          const cryptoKey = await importSymmetricKey(keystoreData.symmetricPollKey);

          // 2. Fetch and decrypt metadata using service method
          const metadata = await getGenesisEvent(entry.pollId, cryptoKey);
          if (metadata) {
            decryptedEntries.push({
              pollId: entry.pollId,
              symmetricKey: keystoreData.symmetricPollKey,
              metadata
            });
          }
        } catch (e) {
          console.warn("Failed to decrypt dashboard entry", entry.pollId, e);
        }
      }

      setEntries(decryptedEntries);
      setFetching(false);
    });

    return () => unsubscribe();
  }, [user, loading]);

  if (loading || fetching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-brand-green animate-spin" />
        <p className="text-neutral-500 font-medium">Decrypting your dashboard...</p>
      </div>
    );
  }

  if (!user || user.isAnonymous) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="bg-neutral-50 rounded-[3rem] p-10 border border-neutral-100">
          <Lock className="w-12 h-12 text-neutral-300 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-neutral-800 mb-4">Organizer Access Only</h2>
          <p className="text-neutral-600 mb-8">Sign in with Google to sync your polls across devices and access your dashboard.</p>
          <Link to="/" className="btn-primary-green inline-block">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight">Your Ledger</h1>
          <p className="text-neutral-500">Securely synced across your devices.</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white p-12 rounded-[3rem] border border-neutral-100 text-center shadow-xl shadow-neutral-100/50">
          <div className="w-16 h-16 bg-brand-green-light/30 text-brand-green rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Calendar size={32} />
          </div>
          <h2 className="text-xl font-bold text-neutral-800 mb-2">No polls in your keystore</h2>
          <p className="text-neutral-500 max-w-md mx-auto mb-8">
            Created polls will appear here automatically when you're signed in.
          </p>
          <Link to="/create" className="btn-primary-green inline-block">
            Create New Poll
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          {entries.map((entry) => (
            <div key={entry.pollId} className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="flex-1">
                  <h2 className="text-2xl font-black text-brand-green-dark mb-4">{entry.metadata.title}</h2>
                  <div className="flex flex-wrap gap-4 text-sm font-bold text-neutral-500">
                    {entry.metadata.location && (
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-brand-green" />
                        <span>{entry.metadata.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Activity size={16} className="text-brand-green" />
                      <span>{entry.metadata.schedulingMode}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Link
                    to={`/poll/${entry.pollId}#key=${entry.symmetricKey}`}
                    className="px-6 py-3 bg-neutral-50 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100"
                  >
                    View
                  </Link>
                  <Link
                    to={`/poll/${entry.pollId}/results#key=${entry.symmetricKey}`}
                    className="px-6 py-3 bg-brand-green text-white rounded-2xl font-bold hover:bg-brand-green-dark flex items-center gap-2"
                  >
                    <ExternalLink size={16} /> Results
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
