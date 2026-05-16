import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { subscribeToUserKeystore, loadFromKeystore, getGenesisEvent } from "@/lib/pollService";
import { getRecoveryStatus, enablePrfRecovery, getDeviceId } from "@/lib/deviceService";
import { setupPhraseRecovery } from "@/lib/recoveryService";
import { importSymmetricKey } from "@/lib/crypto";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Calendar, MapPin, ExternalLink, Activity, Lock, ShieldCheck, ShieldAlert, Key, Clipboard, CheckCircle2, Monitor, XCircle } from "lucide-react";
import type { PollMetadata, PendingDevice } from "../types";
import { db } from "@/firebase";
import { onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { generateVerificationCode } from "@/lib/crypto";

function PendingCodeDisplay({ publicKey }: { publicKey: string }) {
  const [code, setCode] = useState<string>("......");
  useEffect(() => {
    generateVerificationCode(publicKey).then(setCode);
  }, [publicKey]);
  return <>{code}</>;
}

interface DecryptedDashboardEntry {
  pollId: string;
  symmetricKey: string;
  metadata: PollMetadata;
}

export default function DashboardPage() {
  const { user, loading, pendingRequests } = useAuth();
  const [entries, setEntries] = useState<DecryptedDashboardEntry[]>([]);
  const [fetching, setFetching] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [accountData, setAccountData] = useState<any>(null);
  const [showRotationSuccess, setShowRotationSuccess] = useState(false);


  const handleApprove = async (req: PendingDevice) => {
    const { approveDeviceAuthorization } = await import("@/lib/deviceService");
    try {
      setApprovingId(req.deviceId);
      await approveDeviceAuthorization(req);
    } catch (e) {
      console.error("Failed to approve device:", e);
      alert("Failed to authorize device.");
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (req: PendingDevice) => {
    try {
      await deleteDoc(doc(db, "users", user!.uid, "pending_devices", req.deviceId));
    } catch (e) {
      console.error("Failed to reject device:", e);
    }
  };
  const [recoveryStatus, setRecoveryStatus] = useState<{ isSealed: boolean, methods: string[] }>({ isSealed: false, methods: [] });
  const [enablingRecovery, setEnablingRecovery] = useState(false);

  const [showPhraseModal, setShowPhraseModal] = useState(false);
  const [generatedMnemonic, setGeneratedMnemonic] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (loading || !user || user.isAnonymous) {
      setFetching(false);
      return;
    }

    setFetching(true);

    // Listen to account keys for device list and recovery status
    const accountKeysRef = doc(db, "users", user.uid, "account_keys", "default");
    const unsubAccount = onSnapshot(accountKeysRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAccountData(data);
        getRecoveryStatus().then(setRecoveryStatus);
      }
    });

    const unsubscribe = subscribeToUserKeystore(user.uid, async (keystoreEntries) => {
      const decryptedEntries: DecryptedDashboardEntry[] = [];

      for (const entry of keystoreEntries) {
        try {
          const keystoreData = await loadFromKeystore(entry.pollId);
          if (!keystoreData) continue;

          const cryptoKey = await importSymmetricKey(keystoreData.symmetricPollKey);
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

    return () => {
      unsubAccount();
      unsubscribe();
    };
  }, [user, loading]);

  const handleEnableRecovery = async () => {
    setEnablingRecovery(true);
    try {
      await enablePrfRecovery();
      const status = await getRecoveryStatus();
      setRecoveryStatus(status);
    } catch (e) {
      console.error("Failed to enable recovery:", e);
      alert("Failed to enable recovery. Make sure your browser supports passkeys and you have one set up.");
    } finally {
      setEnablingRecovery(false);
    }
  };

  const handleGeneratePhrase = async () => {
    setEnablingRecovery(true);
    try {
      const phrase = await setupPhraseRecovery();
      setGeneratedMnemonic(phrase);
      setShowPhraseModal(true);
      const status = await getRecoveryStatus();
      setRecoveryStatus(status);
    } catch (e) {
      console.error("Failed to setup phrase recovery:", e);
      alert("Failed to setup phrase recovery.");
    } finally {
      setEnablingRecovery(false);
    }
  };

  const handleRevoke = async (deviceId: string) => {
    if (!confirm("Are you sure you want to revoke this device? It will lose access to all your polls immediately.")) return;
    const { revokeDevice } = await import("@/lib/deviceService");
    try {
      await revokeDevice(deviceId);
      setShowRotationSuccess(true);
      setTimeout(() => setShowRotationSuccess(false), 5000);
    } catch (e) {
      console.error("Failed to revoke device:", e);
      alert("Failed to revoke device.");
    }
  };

  const copyToClipboard = () => {
    if (generatedMnemonic) {
      navigator.clipboard.writeText(generatedMnemonic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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

  const hasPhrase = recoveryStatus.methods.some(m => m.toLowerCase().includes("phrase"));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Pending Authorization Requests */}
      {pendingRequests.map(req => (
        <div key={req.deviceId} data-testid="pending-auth-request" className="mb-6 bg-brand-green/10 border-2 border-brand-green/30 p-6 rounded-[2rem] flex flex-col md:flex-row items-center gap-6 shadow-lg shadow-brand-green/5 animate-pulse-subtle">
          <div className="w-14 h-14 bg-brand-green/20 text-brand-green rounded-2xl flex items-center justify-center flex-shrink-0">
            <Monitor size={28} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-lg font-bold text-brand-green-dark">Authorize New Device?</h3>
            <p className="text-brand-green-dark/70 text-sm">
              A new device named <span className="font-bold">"{req.deviceName}"</span> is requesting access.
              Confirm code: <span className="font-mono font-bold bg-white/50 px-2 py-0.5 rounded border border-brand-green/20 ml-1"><PendingCodeDisplay publicKey={req.publicKey} /></span>
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleReject(req)}
              data-testid="reject-auth-btn"
              className="px-6 py-3 bg-white text-neutral-600 rounded-xl font-bold hover:bg-neutral-50 transition-colors flex items-center gap-2"
            >
              <XCircle size={18} /> Reject
            </button>
            <button
              onClick={() => handleApprove(req)}
              disabled={approvingId === req.deviceId}
              data-testid="approve-auth-btn"
              className="px-8 py-3 bg-brand-green text-white rounded-xl font-black hover:bg-brand-green-dark transition-colors flex items-center gap-2 shadow-md shadow-brand-green/20 disabled:opacity-50"
            >
              {approvingId === req.deviceId ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 size={18} />}
              Approve Access
            </button>
          </div>
        </div>
      ))}

      {/* Security Banner */}
      {!recoveryStatus.isSealed && (
        <div className="mb-10 bg-amber-50 border-2 border-amber-200 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-6 shadow-sm">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center flex-shrink-0">
            <ShieldAlert size={32} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl font-bold text-amber-900 mb-2">Account Recovery Disabled</h3>
            <p className="text-amber-800 text-sm leading-relaxed">
              You recently performed a security action (like revoking a device). For your protection, your recovery passkey was disconnected. If you lose access to this device now, you will lose your data.
            </p>
          </div>
          <button
            onClick={handleEnableRecovery}
            disabled={enablingRecovery}
            data-testid="enable-recovery-btn"
            className="whitespace-nowrap px-8 py-4 bg-amber-600 text-white rounded-2xl font-black hover:bg-amber-700 transition-colors flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-amber-200"
          >
            {enablingRecovery ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Key size={20} />
            )}
            Enable Recovery
          </button>
        </div>
      )}

      {/* Recovery Phrase Section */}
      {!hasPhrase && recoveryStatus.isSealed && (
        <div className="mb-10 bg-white border border-neutral-100 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-6 shadow-sm">
          <div className="w-16 h-16 bg-brand-green/10 text-brand-green rounded-2xl flex items-center justify-center flex-shrink-0">
            <Clipboard size={32} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl font-bold text-neutral-800 mb-2">Setup "Cold Storage" Recovery</h3>
            <p className="text-neutral-500 text-sm leading-relaxed">
              Your passkey is secure, but if you lose your hardware, a 24-word recovery phrase is your last resort. It stays valid across all device changes.
            </p>
          </div>
          <button
            onClick={handleGeneratePhrase}
            disabled={enablingRecovery}
            className="whitespace-nowrap px-8 py-4 bg-neutral-900 text-white rounded-2xl font-black hover:bg-black transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            Generate Phrase
          </button>
        </div>
      )}

      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-neutral-900 tracking-tight">Your Polls</h1>
          <p className="text-neutral-500 font-medium">Manage and finalize your created polls</p>
        </div>

        <div className="flex flex-wrap gap-3" data-testid="recovery-status">
          {recoveryStatus.methods.map((method, i) => {
            const isPhrase = method.toLowerCase().includes("phrase");
            return (
              <button
                key={i}
                onClick={() => {
                  if (isPhrase) {
                    if (confirm("Would you like to regenerate your recovery phrase? This will create a NEW 24-word phrase and invalidate the old one. This is useful if you lost your previous phrase but still have access to this device.")) {
                      handleGeneratePhrase();
                    }
                  }
                }}
                disabled={!isPhrase}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border transition-all ${isPhrase
                  ? "bg-brand-green/10 text-brand-green-dark border-brand-green/20 hover:bg-brand-green/20 cursor-pointer active:scale-95"
                  : "bg-neutral-100 text-neutral-500 border-neutral-200 cursor-default"
                  }`}
              >
                <ShieldCheck size={16} className={isPhrase ? "text-brand-green" : "text-neutral-400"} />
                <span>{method} Active</span>
                {isPhrase && <span className="ml-1 text-[10px] uppercase tracking-wider bg-brand-green/20 px-1.5 rounded-sm opacity-60">Reset</span>}
              </button>
            );
          })}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white p-12 rounded-[3rem] border border-neutral-100 text-center shadow-xl shadow-neutral-100/50">
          <div className="w-16 h-16 bg-brand-green-light/30 text-brand-green rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Calendar size={32} />
          </div>
          <h2 className="text-xl font-bold text-neutral-800 mb-2">No polls</h2>
          <p className="text-neutral-500 max-w-md mx-auto mb-8 font-medium">
            Created polls will appear here automatically when you're signed in.
          </p>
          <Link to="/create" className="btn-primary-green inline-block">
            Create New Poll
          </Link>
        </div>
      ) : (
        <div className="grid gap-6">
          {entries.map((entry) => (
            <div key={entry.pollId} className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="flex-1">
                  <h2 className="text-2xl font-black text-neutral-800 group-hover:text-brand-green transition-colors mb-4">{entry.metadata.title}</h2>
                  <div className="flex flex-wrap gap-5 text-sm font-bold text-neutral-400">
                    {entry.metadata.location && (
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-neutral-300" />
                        <span>{entry.metadata.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Activity size={16} className="text-neutral-300" />
                      <span>{entry.metadata.schedulingMode}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    to={`/poll/${entry.pollId}#key=${entry.symmetricKey}`}
                    className="px-6 py-3 bg-neutral-50 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition-colors"
                  >
                    View
                  </Link>
                  <Link
                    to={`/poll/${entry.pollId}/results#key=${entry.symmetricKey}`}
                    className="px-6 py-3 bg-brand-green text-white rounded-2xl font-bold hover:bg-brand-green-dark flex items-center gap-2 shadow-lg shadow-brand-green/20 transition-all hover:scale-[1.02]"
                  >
                    <ExternalLink size={16} /> Results
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Device Management Section */}
      <div className="mt-16 mb-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-black text-neutral-900 tracking-tight">Your Devices</h2>
            <p className="text-neutral-500 font-medium">Manage browser instances with access to your polls</p>
          </div>
          {showRotationSuccess && (
            <div data-testid="rotation-success-toast" className="bg-brand-green text-white px-4 py-2 rounded-xl text-sm font-bold animate-fade-in-up">
              AMK Rotated & Devices Migrated!
            </div>
          )}
        </div>

        <div className="grid gap-4" data-testid="device-list">
          {accountData?.devices && Object.values(accountData.devices).map((device: any) => {
            const isCurrent = device.deviceId === getDeviceId();
            return (
              <div
                key={device.deviceId}
                data-testid="device-item"
                className={`bg-white p-6 rounded-[2rem] border ${isCurrent ? 'border-brand-green/30 bg-brand-green/5' : 'border-neutral-100'} flex items-center justify-between shadow-sm`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isCurrent ? 'bg-brand-green text-white' : 'bg-neutral-100 text-neutral-400'}`}>
                    <Monitor size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-800">
                      {device.deviceName} {isCurrent && <span className="text-brand-green ml-2 text-xs uppercase tracking-widest">(Current)</span>}
                    </h3>
                    <p className="text-xs text-neutral-400 font-medium">
                      Authorized {new Date(device.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {!isCurrent && (
                  <button
                    onClick={() => handleRevoke(device.deviceId)}
                    data-testid="revoke-device-btn"
                    className="p-3 text-neutral-400 hover:text-brand-red transition-colors hover:bg-red-50 rounded-xl"
                    title="Revoke Access"
                  >
                    <XCircle size={20} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Phrase Modal */}
      {showPhraseModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl bg-brand-charcoal/80 overflow-y-auto">
          <div className="bg-white rounded-[3rem] p-8 sm:p-12 max-w-2xl w-full shadow-2xl relative animate-fade-in-up">
            <h2 className="text-3xl font-black text-neutral-900 mb-4">Your Recovery Phrase</h2>
            <p className="text-neutral-600 mb-8 font-medium">
              Write these 24 words down in order and store them in a secure, physical location.
              <span className="text-brand-red font-bold"> Do not share this with anyone or save it online.</span>
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
              {generatedMnemonic?.split(' ').map((word, i) => (
                <div key={i} className="bg-neutral-50 p-3 rounded-xl border border-neutral-100 flex items-center gap-3">
                  <span className="text-neutral-400 text-xs font-black w-4">{i + 1}</span>
                  <span className="font-bold text-neutral-800 tracking-tight">{word}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={copyToClipboard}
                className="flex-1 px-8 py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-black hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2"
              >
                {copied ? <CheckCircle2 size={20} className="text-brand-green" /> : <Clipboard size={20} />}
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
              <button
                onClick={() => setShowPhraseModal(false)}
                className="flex-1 px-8 py-4 bg-brand-green text-white rounded-2xl font-black hover:bg-brand-green-dark transition-colors flex items-center justify-center gap-2"
              >
                I've Saved It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
