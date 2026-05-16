import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Plus, Trash2, Calendar as CalendarIcon, MapPin, Type, Save, Loader2, ArrowLeft, Clock, X, Lock } from "lucide-react";
import { 
  extractKeyFromFragment, 
  subscribeToLedger, 
  appendSignedEvent, 
  loadIdentity 
} from "@/lib/pollService";
import { importSymmetricKey, exportPublicKey } from "@/lib/crypto";
import type { PollState, PollAction, ExactTimeSlot, FuzzyTimeSlot } from "@/types";

interface TimeSlotInput {
  id?: string;
  date: string;
  startTime?: string; // for EXACT
  endTime?: string;   // for EXACT
  label?: string;    // for FUZZY
  time?: string;     // for FUZZY
}

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

export default function EditPollPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const navigate = useNavigate();
  
  const [pollState, setPollState] = useState<PollState | null>(null);
  const [syncStatus, setSyncStatus] = useState("Initializing...");
  const [symmetricKey, setSymmetricKey] = useState<CryptoKey | null>(null);
  const [identity, setIdentity] = useState<{ privateKey: CryptoKey, publicKey: CryptoKey } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [slots, setSlots] = useState<TimeSlotInput[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Initialize and Subscribe
  useEffect(() => {
    if (!pollId) return;

    const b64Key = extractKeyFromFragment();
    if (!b64Key) {
      setError("Secret key missing.");
      setIsLoading(false);
      return;
    }

    const init = async () => {
      try {
        const key = await importSymmetricKey(b64Key);
        setSymmetricKey(key);

        const id = await loadIdentity(pollId);
        setIdentity(id);

        const unsubscribe = subscribeToLedger(pollId, key, (state, status) => {
          if (state) {
            setPollState(state);
            // Only update form if not already edited by user
            // Simplified: always update on first load
            if (isLoading) {
               setTitle(state.metadata?.title || "");
               setDescription(state.metadata?.description || "");
               setLocation(state.metadata?.location || "");
               
               const initialSlots: TimeSlotInput[] = (state.metadata?.timeSlots || []).map(slot => {
                 if (state.metadata?.schedulingMode === "EXACT") {
                   const exact = slot as ExactTimeSlot;
                   const start = new Date(exact.startTime);
                   const end = new Date(exact.endTime);
                   return {
                     id: exact.id,
                     date: start.toISOString().split('T')[0],
                     startTime: start.toTimeString().substring(0, 5),
                     endTime: end.toTimeString().substring(0, 5),
                   };
                 } else {
                   const fuzzy = slot as FuzzyTimeSlot;
                   return {
                     id: fuzzy.id,
                     date: fuzzy.date,
                     label: fuzzy.label,
                     time: fuzzy.time,
                   };
                 }
               });
               setSlots(initialSlots);
            }
          }
          setSyncStatus(status);
          setIsLoading(false);
        });

        // Verify Admin
        if (id && pollState?.adminPublicKey) {
           const pub = await exportPublicKey(id.publicKey);
           setIsAdmin(pub === pollState.adminPublicKey);
        }

        return unsubscribe;
      } catch (err: any) {
        setError("Failed to initialize.");
        setIsLoading(false);
      }
    };

    const unsubPromise = init();
    return () => { unsubPromise.then(unsub => unsub?.()); };
  }, [pollId, pollState?.adminPublicKey]);

  // Re-check admin when pollState is updated
  useEffect(() => {
    if (identity && pollState?.adminPublicKey) {
      exportPublicKey(identity.publicKey).then(pub => {
        setIsAdmin(pub === pollState.adminPublicKey);
      });
    }
  }, [pollState?.adminPublicKey, identity]);

  const addSlot = () => {
    const lastSlot = slots[slots.length - 1];
    const defaultDate = new Date().toISOString().split('T')[0];
    const mode = pollState?.metadata?.schedulingMode || "EXACT";

    if (mode === "EXACT") {
      setSlots([...slots, { 
        date: lastSlot?.date || defaultDate, 
        startTime: lastSlot?.startTime || "09:00", 
        endTime: lastSlot?.endTime || "10:00" 
      }]);
    } else {
      setSlots([...slots, { 
        date: lastSlot?.date || defaultDate, 
        label: "", 
        time: "" 
      }]);
    }
  };

  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, field: keyof TimeSlotInput, value: string) => {
    const newSlots = [...slots];
    newSlots[index] = { ...newSlots[index], [field]: value };
    setSlots(newSlots);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symmetricKey || !identity || !pollId || !pollState?.metadata) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const mode = pollState.metadata.schedulingMode;
      const updatedMetadata = {
        title,
        description,
        location,
        timeSlots: mode === "EXACT"
          ? slots.map(slot => ({
            id: slot.id || generateId(),
            startTime: new Date(`${slot.date}T${slot.startTime || "09:00"}`).toISOString(),
            endTime: new Date(`${slot.date}T${slot.endTime || "10:00"}`).toISOString(),
          })) as any[]
          : slots.map(slot => ({
            id: slot.id || generateId(),
            date: slot.date,
            label: slot.label || "General",
            time: slot.time || undefined,
          })) as any[],
      };

      const action: PollAction = { type: "POLL_UPDATED", payload: updatedMetadata };
      await appendSignedEvent(pollId, symmetricKey, identity.privateKey, identity.publicKey, action);
      
      navigate(`/poll/${pollId}${window.location.hash}`);
    } catch (err: any) {
      setError("Failed to update poll.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-brand-green animate-spin" />
        <p className="text-neutral-500 font-medium">{syncStatus}</p>
      </div>
    );
  }

  if (error || !pollState || !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Lock className="w-16 h-16 text-neutral-300 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-neutral-800 mb-4">Admin Access Required</h2>
        <p className="text-neutral-600 text-lg mb-8">{error || "You do not have the administrative key for this poll."}</p>
        <Link to={`/poll/${pollId}${window.location.hash}`} className="btn-primary-green inline-block">Back to Poll</Link>
      </div>
    );
  }

  const schedulingMode = pollState.metadata!.schedulingMode;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link 
        to={`/poll/${pollId}${window.location.hash}`}
        className="inline-flex items-center gap-2 text-brand-green-dark font-bold mb-8"
      >
        <ArrowLeft size={16} /> Back to Poll
      </Link>

      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">Edit Your Poll</h1>
        <p className="text-neutral-500">Update the details of "{pollState.metadata!.title}"</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="poll-title" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <Type size={16} className="text-brand-green" />
              Meeting Title
            </label>
            <input
              id="poll-title"
              required
              type="text"
              className="w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="poll-description" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <Type size={16} className="text-brand-green" />
              Description
            </label>
            <textarea
              id="poll-description"
              className="w-full min-h-[100px] resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="poll-location" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <MapPin size={16} className="text-brand-green" />
              Location
            </label>
            <input
              id="poll-location"
              type="text"
              className="w-full"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
          <label className="text-sm font-bold text-neutral-700 flex items-center gap-2 mb-6">
            <CalendarIcon size={16} className="text-brand-green" />
            Time Slots
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {slots.map((slot, index) => (
              <div key={index} className="relative group">
                <div className="flex flex-col gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100 transition-all hover:border-neutral-200 shadow-sm relative">
                    <div className="flex items-center gap-2">
                      <label className="relative group/date cursor-pointer flex-1 min-w-0">
                        <div className="flex items-center px-3 h-10 text-neutral-700 font-bold bg-white rounded-xl border border-neutral-200 group-focus-within/date:border-brand-green group-focus-within/date:ring-2 group-focus-within/date:ring-brand-green/20 transition-all shadow-sm">
                          <CalendarIcon size={14} className="text-brand-green/60 mr-2 flex-shrink-0" />
                          <span className="truncate text-sm font-bold">{slot.date ? new Date(slot.date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : "Select date"}</span>
                        </div>
                        <input
                          type="date"
                          required
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                          value={slot.date}
                          onChange={(e) => updateSlot(index, "date", e.target.value)}
                        />
                      </label>

                      {schedulingMode === "FUZZY" ? (
                        <label className="relative group/time cursor-pointer flex-shrink-0">
                          <div className="flex items-center px-3 h-10 text-neutral-600 font-bold bg-white rounded-xl border border-neutral-200 group-focus-within/time:border-brand-green group-focus-within/time:ring-2 group-focus-within/time:ring-brand-green/20 transition-all w-[110px] shadow-sm hover:border-neutral-300">
                            <span className="text-neutral-400 font-black mr-2 text-sm">~</span>
                            <span className="truncate text-sm">{slot.time || "--:--"}</span>
                            {slot.time && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  updateSlot(index, "time", "");
                                }}
                                className="ml-auto text-neutral-400 hover:text-red-500 transition-colors relative z-20"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                          <input
                            type="time"
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                            value={slot.time || ""}
                            onChange={(e) => updateSlot(index, "time", e.target.value)}
                          />
                        </label>
                      ) : (
                        <button
                          type="button"
                          onClick={() => removeSlot(index)}
                          aria-label="Remove time slot"
                          className="w-9 h-9 flex items-center justify-center bg-white text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl border border-neutral-200 shadow-sm transition-all flex-shrink-0"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                  <div className="w-full">
                    {schedulingMode === "EXACT" ? (
                      <div className="flex items-center gap-2">
                        <label className="relative group/start cursor-pointer flex-1">
                          <div className="flex items-center px-3 py-2 text-neutral-700 font-bold bg-white rounded-xl border border-neutral-200 group-focus-within/start:border-brand-green group-focus-within/start:ring-2 group-focus-within/start:ring-brand-green/20 transition-all w-full shadow-sm">
                            <Clock size={14} className="text-brand-green/40 mr-2 flex-shrink-0" />
                            <span className="text-sm">{slot.startTime || "09:00"}</span>
                          </div>
                          <input
                            type="time"
                            required
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                            value={slot.startTime}
                            onChange={(e) => updateSlot(index, "startTime", e.target.value)}
                          />
                        </label>
                        <span className="text-neutral-300 font-bold">-</span>
                        <label className="relative group/end cursor-pointer flex-1">
                          <div className="flex items-center px-3 py-2 text-neutral-700 font-bold bg-white rounded-xl border border-neutral-200 group-focus-within/end:border-brand-green group-focus-within/end:ring-2 group-focus-within/end:ring-brand-green/20 transition-all w-full shadow-sm">
                            <Clock size={14} className="text-brand-green/40 mr-2 flex-shrink-0" />
                            <span className="text-sm">{slot.endTime || "10:00"}</span>
                          </div>
                          <input
                            type="time"
                            required
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                            value={slot.endTime}
                            onChange={(e) => updateSlot(index, "endTime", e.target.value)}
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                          <Type size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-green/40 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="e.g. Evening, Session 1..."
                            className="w-full pl-9 py-2 text-sm font-bold bg-white border border-neutral-200 rounded-xl focus:border-brand-green transition-all shadow-sm"
                            value={slot.label}
                            onChange={(e) => updateSlot(index, "label", e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSlot(index)}
                          className="w-9 h-9 flex items-center justify-center bg-white text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl border border-neutral-200 shadow-sm transition-all flex-shrink-0"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addSlot}
              className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-neutral-200 rounded-2xl text-neutral-400 hover:border-brand-green hover:text-brand-green hover:bg-brand-green-light/20 transition-all font-bold text-sm bg-white/50 group"
            >
              <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center group-hover:bg-brand-green group-hover:text-white transition-all">
                <Plus size={20} />
              </div>
              Add time slot
            </button>
          </div>
        </div>

        {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl font-bold">{error}</div>}

        <button
          type="submit"
          disabled={isSubmitting || !title || slots.length === 0}
          className="btn-primary-green w-full py-4 flex items-center justify-center gap-2"
        >
          {isSubmitting ? <Loader2 className="animate-spin" /> : <><Save size={24} /> Save Changes</>}
        </button>
      </form>
    </div>
  );
}
