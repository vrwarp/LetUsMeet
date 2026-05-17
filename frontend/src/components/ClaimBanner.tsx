import { useState, useEffect } from "react";
import { useOutletContext, useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { 
  loadIdentity, 
  extractKeyFromFragment, 
  loadIdentityFromToken, 
  saveToIndexedDB, 
  saveToKeystore,
  loadFromKeystore
} from "@/lib/pollService";
import { 
  importSymmetricKey, 
  exportPrivateKey, 
  exportPublicKey 
} from "@/lib/crypto";

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

  const handleClaim = async () => {
    try {
      setIsClaiming(true);
      console.log("CLAIM DEBUG: Claim button clicked");
      if (!user || user.isAnonymous) {
        console.log("CLAIM DEBUG: User not signed in, redirecting to sign in...");
        await signInWithGoogle();
        return;
      }
      
      console.log("CLAIM DEBUG: pollId:", pollId, "adminToken:", activeAdminToken);
      
      let id = await loadIdentity(pollId);
      const symKeyString = extractKeyFromFragment();
      console.log("CLAIM DEBUG: initial id:", id, "symKeyString present:", !!symKeyString);
      
      if (!id && symKeyString) {
         const symKey = await importSymmetricKey(symKeyString);
         console.log("CLAIM DEBUG: attempting loadIdentityFromToken...");
         id = await loadIdentityFromToken(pollId, activeAdminToken, symKey);
         console.log("CLAIM DEBUG: loadIdentityFromToken result:", id);
      }

      if (id && symKeyString) {
        const priv = await exportPrivateKey(id.privateKey);
        const pub = await exportPublicKey(id.publicKey);
        console.log("CLAIM DEBUG: saving to keystore...");
        try {
          await saveToKeystore(pollId, {
            symmetricPollKey: symKeyString,
            ecdsaPrivateKey: priv,
            ecdsaPublicKey: pub
          });
        } catch (e) {
          console.warn("CLAIM DEBUG: saveToKeystore failed, falling back to IndexedDB:", e);
          await saveToIndexedDB(pollId, { 
            privateKey: priv, 
            publicKey: pub 
          });
        }
        
        console.log("CLAIM DEBUG: claim successful, updating state");
        setIsClaimed(true);
      } else {
        console.error("CLAIM DEBUG: Failed to recover identity or symKey missing. id:", id, "symKeyString:", !!symKeyString);
      }
    } catch (error) {
      console.error("CLAIM DEBUG: Error during claim process:", error);
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
        <div className="w-10 h-10 bg-[#8C0B0B] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-955/10 flex-shrink-0 mt-0.5">
          <Sparkles size={18} />
        </div>
        <div>
          <h2 className="font-bold text-neutral-900 text-sm">Poll Administrative Link</h2>
          <p className="text-xs text-neutral-600 leading-relaxed mt-1">
            You have the administrative token for this poll. Please choose one of the options on the right to secure your access.
          </p>
        </div>
      </div>

      {/* Right Side: Two Actions with Micro-copy */}
      <div className="flex flex-col sm:flex-row gap-6 md:gap-8 flex-shrink-0 w-full md:w-auto">
        {/* Action 1: Add to Dashboard */}
        <div className="flex flex-col gap-1.5 w-full sm:w-48">
          <button
            data-testid="claim-button"
            onClick={handleClaim}
            disabled={isClaiming}
            className="w-full bg-[#8C0B0B] text-white font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-red-800 transition-all shadow-sm active:scale-95 whitespace-nowrap text-center cursor-pointer"
          >
            {isClaiming ? "Adding..." : "Add to My Dashboard"}
          </button>
          <p className="text-[10px] text-neutral-500 font-medium leading-normal">
            Requires Google sign-in to sync securely across all your devices.
          </p>
        </div>

        {/* Action 2: Copy Link */}
        {isUserAnonymousOrSignedOut && (
          <div className="flex flex-col gap-1.5 w-full sm:w-48">
            <button
              onClick={() => {
                const adminLink = `${window.location.origin}${window.location.pathname}?adminToken=${activeAdminToken}${window.location.hash}`;
                navigator.clipboard.writeText(adminLink);
                setCopiedAdminLink(true);
                setTimeout(() => setCopiedAdminLink(false), 3000);
              }}
              className="w-full bg-white text-[#8C0B0B] border border-[#8C0B0B]/20 font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-[#FFF0F0] transition-all active:scale-95 whitespace-nowrap text-center cursor-pointer"
            >
              {copiedAdminLink ? "Copied Link!" : "Copy Admin Link"}
            </button>
            <p className="text-[10px] text-neutral-500 font-medium leading-normal font-sans">
              Save this secret link securely. Access is lost forever if misplaced.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
