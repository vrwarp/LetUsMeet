import React, { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface DeviceEnrollmentGateProps {
  children: React.ReactNode;
}

export default function DeviceEnrollmentGate({ children }: DeviceEnrollmentGateProps) {
  const { user, isDeviceRegistered, loading, enrollDevice } = useAuth();
  const [enrollmentState, setEnrollmentState] = useState<'idle' | 'prompting' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If loading, not logged in, or anonymous, let the children or other auth wrappers handle it
  if (loading || !user || user.isAnonymous) {
    return <>{children}</>;
  }

  // If logged in and device is registered, allow access
  if (isDeviceRegistered) {
    return <>{children}</>;
  }

  // Otherwise, show the interstitial
  const handleEnroll = async () => {
    try {
      setEnrollmentState('prompting');
      setErrorMessage(null);
      await enrollDevice();
      // On success, isDeviceRegistered in useAuth will become true, unmounting this UI
    } catch (err) {
      setEnrollmentState('error');
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setErrorMessage('Registration was canceled. We need a secure key to encrypt your polls.');
      } else {
        setErrorMessage('Something went wrong communicating with your device. Please try again.');
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 animate-fade-in">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-neutral-100 p-8 text-center flex flex-col items-center">
        <div className="w-16 h-16 bg-brand-green/10 text-brand-green rounded-full flex items-center justify-center mb-6">
          <ShieldCheck size={32} />
        </div>

        <h2 className="text-2xl font-black text-neutral-900 mb-4 tracking-tight">Secure your account</h2>

        <p className="text-neutral-500 text-sm font-medium leading-relaxed mb-8">
          LetUsMeet uses end-to-end encryption to keep your polls private. To generate your unique encryption key, we need to register this device using your built-in screen lock, Touch ID, or Face ID.
        </p>

        {errorMessage && (
          <div role="alert" className="w-full bg-red-50 text-brand-red text-sm font-medium py-3 px-4 rounded-xl mb-6 border border-red-100">
            {errorMessage}
          </div>
        )}

        <button
          onClick={handleEnroll}
          disabled={enrollmentState === 'prompting'}
          className="w-full bg-brand-green text-white py-3.5 rounded-full font-bold shadow-lg shadow-brand-green/20 hover:bg-brand-green-dark hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:scale-100 flex items-center justify-center gap-2 cursor-pointer"
        >
          {enrollmentState === 'prompting' ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Waiting for device...
            </>
          ) : (
            "Set up secure access"
          )}
        </button>
      </div>
    </div>
  );
}
