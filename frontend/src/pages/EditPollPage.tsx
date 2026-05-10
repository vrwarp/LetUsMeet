import { useState, useEffect } from "react";
import { useNavigate, useParams, Link, useSearchParams } from "react-router-dom";
import { Plus, Trash2, Calendar as CalendarIcon, MapPin, Type, Save, Loader2, ArrowLeft, AlertTriangle } from "lucide-react";
import { subscribeToPoll, updatePoll, claimPoll } from "@/lib/pollService";
import { useAuth } from "@/hooks/useAuth";
import { ShieldCheck } from "lucide-react";
import type { Poll, ExactTimeSlot, FuzzyTimeSlot } from "@/types";

interface TimeSlotInput {
  id?: string;
  date: string;
  startTime?: string; // for EXACT
  endTime?: string;   // for EXACT
  label?: string;    // for FUZZY
  time?: string;     // for FUZZY
}

export default function EditPollPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [schedulingMode, setSchedulingMode] = useState<"EXACT" | "FUZZY">("EXACT");
  const [slots, setSlots] = useState<TimeSlotInput[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, any>>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [activeInput, setActiveInput] = useState<HTMLElement | null>(null);
  const [poll, setPoll] = useState<Poll | null>(null);

  const adminToken = searchParams.get("adminToken") || localStorage.getItem(`adminToken_${pollId}`);

  useEffect(() => {
    if (!pollId) return;
    
    setIsLoading(true);
    const unsubscribe = subscribeToPoll(pollId, (data) => {
      const fetchedPoll = data.poll as Poll;
      setPoll(fetchedPoll);
      setTitle(fetchedPoll.title);
      setDescription(fetchedPoll.description || "");
      setLocation(fetchedPoll.location);
      setSchedulingMode(fetchedPoll.schedulingMode);
      setVoteCounts(data.voteCounts);

      const initialSlots: TimeSlotInput[] = fetchedPoll.timeSlots.map(slot => {
        if (fetchedPoll.schedulingMode === "EXACT") {
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
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [pollId]);

  const handlePickerClick = (e: React.MouseEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    if (activeInput === el) {
      el.blur();
      setActiveInput(null);
    } else {
      (el as any).showPicker?.();
      setActiveInput(el);
    }
  };

  const handleBlur = () => {
    setActiveInput(null);
  };

  const addSlot = () => {
    const lastSlot = slots[slots.length - 1];
    if (schedulingMode === "EXACT") {
      setSlots([...slots, { date: lastSlot?.date || new Date().toISOString().split('T')[0], startTime: "09:00", endTime: "10:00" }]);
    } else {
      setSlots([...slots, { date: lastSlot?.date || new Date().toISOString().split('T')[0], label: "General", startTime: "", endTime: "" }]);
    }
  };

  const removeSlot = (index: number) => {
    const slot = slots[index];
    if (slot.id && voteCounts[slot.id]) {
      const counts = voteCounts[slot.id];
      const hasVotes = (counts.YES || 0) + (counts.NO || 0) + (counts.IF_NEED_BE || 0) > 0;
      if (hasVotes) {
        if (!confirm("This time slot already has votes cast. Deleting it will remove those votes. Are you sure?")) {
          return;
        }
      }
    }
    
    if (slots.length > 1) {
      setSlots(slots.filter((_, i) => i !== index));
    }
  };

  const updateSlot = (index: number, field: keyof TimeSlotInput, value: string) => {
    const newSlots = [...slots];
    newSlots[index] = { ...newSlots[index], [field]: value };
    setSlots(newSlots);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!pollId) return;
    try {
      await updatePoll(pollId, {
        title,
        description,
        location,
        timeSlots: schedulingMode === "EXACT"
          ? slots.map(slot => ({
            id: slot.id,
            startTime: new Date(`${slot.date}T${slot.startTime}`).toISOString(),
            endTime: new Date(`${slot.date}T${slot.endTime}`).toISOString(),
          })) as any[]
          : slots.map(slot => ({
            id: slot.id,
            date: slot.date,
            label: slot.label || "General",
            time: slot.time || undefined,
          })) as any[],
      });


      navigate(`/poll/${pollId}${adminToken ? `?adminToken=${adminToken}` : ""}`);
    } catch (err: any) {
      console.error("Failed to update poll", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClaim = async () => {
    if (!pollId || isClaiming) return;
    if (!adminToken) return;

    setIsClaiming(true);
    try {
      await claimPoll(pollId, adminToken, user?.uid);
      // Re-render via subscription
    } catch (err) {
      console.error("Failed to claim poll:", err);
      setError("Failed to claim poll. Please try again.");
    } finally {
      setIsClaiming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-brand-green animate-spin" />
        <p className="text-neutral-500 font-medium">Loading poll details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Link 
        to={`/poll/${pollId}${adminToken ? `?adminToken=${adminToken}` : ""}`}
        className="inline-flex items-center gap-2 text-brand-green-dark hover:text-brand-green font-bold mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Poll
      </Link>

      {(() => {
        if (!poll) return null;
        const isActuallyOrganizer = user && !user.isAnonymous && poll.organizerUid === user.uid;
        if (user && !user.isAnonymous && !isActuallyOrganizer && adminToken && adminToken === poll.adminToken) {
          return (
            <div className="mb-8 p-6 bg-brand-green-light/30 border border-brand-green-light rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-green rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-green/20">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-bold text-brand-charcoal text-lg">Claim this Poll</h2>
                  <p className="text-neutral-600 text-sm">You have administrative access. Would you like to add this poll to your dashboard?</p>
                </div>
              </div>
              <button
                onClick={handleClaim}
                disabled={isClaiming}
                className="px-8 py-3 bg-brand-green text-white rounded-xl font-bold hover:bg-brand-green-dark transition-all shadow-md shadow-brand-green/10 whitespace-nowrap disabled:opacity-50"
              >
                {isClaiming ? "Adding to Dashboard..." : "Add to My Dashboard"}
              </button>
            </div>
          );
        }
        return null;
      })()}

      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">Edit Your Poll</h1>
        <p className="text-neutral-500">Update the details of "{title}"</p>
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
              placeholder="e.g., Team Sync"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all text-lg"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="poll-description" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <Type size={16} className="text-brand-green" />
              Description (Optional)
            </label>
            <textarea
              id="poll-description"
              placeholder="Add more details about the meeting..."
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[100px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="poll-location" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <MapPin size={16} className="text-brand-green" />
              Location (Optional)
            </label>
            <input
              id="poll-location"
              type="text"
              placeholder="e.g., Zoom, Office"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-200">
           <div className="flex items-center gap-2 text-neutral-600 font-medium">
              <AlertTriangle size={18} className="text-amber-500" />
              <span>Scheduling mode is fixed to <strong>{schedulingMode === "EXACT" ? "Exact Times" : "Flexible Windows"}</strong></span>
           </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
          <label className="text-sm font-bold text-neutral-700 flex items-center gap-2 mb-6">
            <CalendarIcon size={16} className="text-brand-green" />
            Time Slots
          </label>

          <div className="flex flex-col gap-4">
            {slots.map((slot, index) => {
              const counts = slot.id ? voteCounts[slot.id] : null;
              const hasVotes = counts && (counts.YES || 0) + (counts.NO || 0) + (counts.IF_NEED_BE || 0) > 0;
              
              return (
                <div key={index} className="relative group">
                  <div className="flex flex-col sm:grid sm:grid-cols-[150px_1fr_40px] sm:items-center gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-100 transition-all hover:border-neutral-200 shadow-sm relative">
                    {hasVotes && (
                      <div className="absolute -top-2 -left-2 bg-amber-100 text-amber-700 p-1.5 rounded-full shadow-sm z-20 border border-amber-200" title="This slot already has votes. Deleting it will remove them.">
                        <AlertTriangle size={12} />
                      </div>
                    )}

                    {/* Date Column */}
                    <label className="relative group/date cursor-pointer">
                      <div className="flex items-center px-4 py-2.5 text-neutral-700 font-medium bg-white rounded-xl border border-neutral-200 group-focus-within/date:border-indigo-500 group-focus-within/date:ring-2 group-focus-within/date:ring-indigo-500/20 transition-all shadow-sm">
                        <CalendarIcon size={16} className="text-indigo-400 mr-2 flex-shrink-0" />
                        <span className="truncate text-sm font-bold">{slot.date ? new Date(slot.date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : "Select date"}</span>
                      </div>
                      <input
                        type="date"
                        required
                        onClick={handlePickerClick}
                        onBlur={handleBlur}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                        value={slot.date}
                        onChange={(e) => updateSlot(index, "date", e.target.value)}
                      />
                    </label>
                    
                    {/* Content Column */}
                    <div className="flex-1">
                      {schedulingMode === "EXACT" ? (
                        <div className="flex items-center gap-3">
                          <input
                            type="time"
                            required
                            className="flex-1 sm:w-28 px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white shadow-sm"
                            value={slot.startTime}
                            onChange={(e) => updateSlot(index, "startTime", e.target.value)}
                          />
                          <span className="text-neutral-600 font-bold text-[10px] uppercase tracking-widest flex-shrink-0">to</span>
                          <input
                            type="time"
                            required
                            className="flex-1 sm:w-28 px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none bg-white shadow-sm"
                            value={slot.endTime}
                            onChange={(e) => updateSlot(index, "endTime", e.target.value)}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
                          <input
                            type="text"
                            placeholder="Label"
                            className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-bold outline-none bg-white shadow-sm"
                            value={slot.label}
                            onChange={(e) => updateSlot(index, "label", e.target.value)}
                          />
                          <input
                            type="time"
                            className="w-full lg:w-28 px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-bold outline-none bg-white shadow-sm"
                            value={slot.time || ""}
                            onChange={(e) => updateSlot(index, "time", e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Action Column */}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeSlot(index)}
                        disabled={slots.length === 1}
                        className="p-2.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all sm:opacity-0 sm:group-hover:opacity-100 disabled:hidden flex-shrink-0"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={addSlot}
              className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-neutral-200 rounded-xl text-neutral-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all font-medium mt-2"
            >
              <Plus size={18} />
              Add another option
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !title}
          className="w-full py-4 bg-brand-green text-white rounded-xl font-bold text-xl hover:bg-brand-green-dark transition-all shadow-lg shadow-brand-green/10 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin" size={24} />
          ) : (
            <>
              <Save size={24} />
              Save Changes
            </>
          )}
        </button>
      </form>
    </div>
  );
}
