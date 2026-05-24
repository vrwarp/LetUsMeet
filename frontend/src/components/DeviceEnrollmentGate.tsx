import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import dataGardenImg from "@/assets/data-garden-compressed.webp";

interface DeviceEnrollmentGateProps {
  children: React.ReactNode;
}

export default function DeviceEnrollmentGate({ children }: DeviceEnrollmentGateProps) {
  const { user, isDeviceRegistered, loading, enrollDevice, keyMismatchError } = useAuth();
  const [enrollmentState, setEnrollmentState] = useState<'idle' | 'prompting' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If loading, not logged in, or anonymous, let the children or other auth wrappers handle it
  // Also bypass if there is a key mismatch/unrecognized device error so that the app layout modal covers the page instead
  const shouldShowGate = !loading && user && !user.isAnonymous && !isDeviceRegistered && !keyMismatchError;

  const handleEnroll = async () => {
    try {
      setEnrollmentState('prompting');
      setErrorMessage(null);
      await enrollDevice();
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
    <>
      {children}

      {shouldShowGate && (
        <div className="fixed inset-0 z-[200] bg-neutral-900/40 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 text-center animate-fade-in">
          <div 
            className="max-w-md w-full max-h-[calc(100vh-2rem)] sm:max-h-[90vh] overflow-y-auto bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-neutral-100/80 text-brand-charcoal animate-fade-in-up flex flex-col relative mx-4 sm:mx-0"
            style={{
              backgroundColor: "#ffffff",
              backgroundImage: "linear-gradient(#f0f4f1 1.5px, transparent 1.5px), linear-gradient(90deg, #f0f4f1 1.5px, transparent 1.5px)",
              backgroundSize: "32px 32px"
            }}
          >
            {/* Illustration Banner */}
            <div className="w-full relative aspect-[2.3] sm:aspect-[1.8] flex items-end justify-center bg-white/40 border-b border-neutral-100 px-4 pt-4 pb-0 overflow-hidden">
              <img 
                src={dataGardenImg} 
                alt="Secure Account Illustration" 
                className="w-full h-full object-contain max-h-[120px] sm:max-h-[190px] drop-shadow-[0_8px_16px_rgba(36,102,39,0.06)]"
              />
            </div>

            <div className="px-5 pb-6 pt-3 sm:px-10 sm:pb-10 sm:pt-4 flex flex-col items-center">
              <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight leading-tight">
                Secure your account
              </h2>

              <p className="text-neutral-500 text-xs sm:text-sm font-medium mt-3 sm:mt-4 leading-relaxed max-w-sm">
                Using <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-green hover:text-brand-green-dark underline font-bold transition-colors">zero-knowledge encryption</a>, your data is locked in a digital vault away from everyone—even LetUsMeet. To generate your private passkey, this device must be registered using your built-in security features (like Touch ID or Face ID).
              </p>

              {errorMessage && (
                <div role="alert" className="w-full bg-red-50 text-brand-red text-xs sm:text-sm font-semibold py-3 px-4 rounded-xl mt-4 border border-red-100">
                  {errorMessage}
                </div>
              )}

              <div className="w-full mt-6 sm:mt-8">
                <button
                  onClick={handleEnroll}
                  disabled={enrollmentState === 'prompting'}
                  className="w-full bg-brand-green text-white py-3.5 rounded-full font-bold shadow-lg shadow-brand-green/20 hover:bg-brand-green-dark hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:scale-100 flex items-center justify-center gap-2 cursor-pointer text-sm"
                >
                  {enrollmentState === 'prompting' ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Waiting for device...
                    </>
                  ) : (
                    "Set up secure access"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
