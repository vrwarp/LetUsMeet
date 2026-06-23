import { useState, useEffect } from "react";
import { useOutletContext, useLocation } from "react-router-dom";
import { Sparkles, Share2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  extractKeyFromFragment,
  getLedgerSession,
  getShareableUrl
} from "@/lib/pollService";
import { loadFromKeystore } from "charproof";

interface LayoutContext {
  activeAdminToken: string | null;
  isClaimed: boolean;
  setIsClaimed: (val: boolean) => void;
}

export default function ClaimBanner() {
  const context = useOutletContext<LayoutContext>() || { activeAdminToken: null, isClaimed: false, setIsClaimed: () => {} };
  const { activeAdminToken, isClaimed, setIsClaimed } = context;
  const { user, signInWithGoogle } = useAuth();
  const location = useLocation();
  
  const [copiedAdminLink, setCopiedAdminLink] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [hasKeystoreEntry, setHasKeystoreEntry] = useState<boolean | null>(null);

  const pollIdMatch = location.pathname.match(/\/poll\/([^/]+)/);
  const pollId = pollIdMatch ? pollIdMatch[1] : null;

  useEffect(() => {
    if (!pollId || !user || user.isAnonymous) {
      setHasKeystoreEntry(false);
      return;
    }

    let mounted = true;
    loadFromKeystore(pollId).then(data => {
      if (mounted) {
        setHasKeystoreEntry(!!data);
      }
    }).catch(err => {
      console.error("Failed to load from keystore in ClaimBanner:", err);
      if (mounted) setHasKeystoreEntry(false);
    });

    return () => { mounted = false; };
  }, [pollId, user?.uid]);

  if (!activeAdminToken || !pollId || isClaimed || hasKeystoreEntry === null || hasKeystoreEntry === true) {
    return null;
  }

  const isUserAnonymousOrSignedOut = !user || user.isAnonymous;

  const handleShareLink = async () => {
    const shareUrl = getShareableUrl();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url: shareUrl });
        return;
      } catch {
        // User dismissed the share sheet or it failed — fall through to clipboard copy.
      }
    }
    navigator.clipboard.writeText(shareUrl);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 3000);
  };

  const handleClaim = async () => {
    try {
      setIsClaiming(true);
      if (!user || user.isAnonymous) {
        await signInWithGoogle();
        return;
      }
      
      const symKeyString = extractKeyFromFragment();
      if (!symKeyString) return;
      
      await getLedgerSession(pollId, { shareableKey: symKeyString, ownershipToken: activeAdminToken });
      setIsClaimed(true);
    } catch (error) {
      console.error("Error during claim process:", error);
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div 
      className="border-t border-[#F5E1E1]/40 bg-[#FFF8F8] px-6 py-6 sm:px-8 flex flex-col md:flex-row md:items-start justify-between gap-6" 
      data-testid="claim-banner"
    >
      {/* Left Side: Icon & Info */}
      <div className="flex items-start gap-4 max-w-xl">
        <div className="w-10 h-10 bg-brand-red text-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/10 flex-shrink-0 mt-0.5">
          <Sparkles size={18} />
        </div>
        <div>
          <h2 className="font-bold text-neutral-900 text-sm">You're the organizer of this poll</h2>
          <p className="text-xs text-neutral-600 leading-relaxed mt-1">
            Save your organizer access so you can manage this poll later. Please choose one of the options on the right to secure your access.
          </p>
        </div>
      </div>

      {/* Right Side: Actions with Micro-copy */}
      <div className="flex flex-col sm:flex-row gap-6 md:gap-8 flex-shrink-0 w-full md:w-auto">
        {/* Primary Action: Copy link to share (safe voting link, admin stripped) */}
        <div className="flex flex-col gap-1.5 w-full sm:w-48">
          <button
            data-testid="share-link-button"
            onClick={handleShareLink}
            className="focus-ring w-full bg-brand-red text-white font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-brand-red-dark transition-all shadow-sm active:scale-95 text-center cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            <Share2 size={14} />
            {copiedShareLink ? "Copied Link!" : "Copy link to share"}
          </button>
          <p className="text-[10px] text-neutral-600 font-medium leading-normal">
            Share this so people can vote. It doesn't include your organizer access.
          </p>
        </div>

        {/* Secondary Action: Add to Dashboard */}
        <div className="flex flex-col gap-1.5 w-full sm:w-48">
          <button
            data-testid="claim-button"
            onClick={handleClaim}
            disabled={isClaiming}
            className="focus-ring w-full bg-white text-brand-red border border-brand-red/20 font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-brand-red-light transition-all active:scale-95 text-center cursor-pointer"
          >
            {isClaiming ? "Adding..." : "Add to My Dashboard"}
          </button>
          <p className="text-[10px] text-neutral-600 font-medium leading-normal">
            Requires Google sign-in to sync securely across all your devices.
          </p>
        </div>

        {/* Secondary Action: Copy private organizer link */}
        {isUserAnonymousOrSignedOut && (
          <div className="flex flex-col gap-1.5 w-full sm:w-48">
            <button
              data-testid="admin-link-button"
              onClick={() => {
                const adminLink = `${window.location.origin}${window.location.pathname}?adminToken=${activeAdminToken}${window.location.hash}`;
                navigator.clipboard.writeText(adminLink);
                setCopiedAdminLink(true);
                setTimeout(() => setCopiedAdminLink(false), 3000);
              }}
              className="focus-ring w-full bg-white text-neutral-600 border border-neutral-200 font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-neutral-50 transition-all active:scale-95 text-center cursor-pointer"
            >
              {copiedAdminLink ? "Copied Link!" : "Copy private organizer link"}
            </button>
            <p className="text-[10px] text-brand-red font-semibold leading-normal font-sans inline-flex items-start gap-1">
              <ShieldAlert size={12} className="flex-shrink-0 mt-0.5" />
              <span>Keep this private — anyone with it can manage or finalize this poll.</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
