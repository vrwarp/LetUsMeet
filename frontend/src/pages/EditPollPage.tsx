import { useState, useEffect } from "react";
import { useNavigate, useParams, Link, useSearchParams } from "react-router-dom";
import { Plus, Trash2, Calendar as CalendarIcon, MapPin, Type, Save, Loader2, ArrowLeft, Clock, X, AlertTriangle } from "lucide-react";
import { fetchPollAction, updatePollAction } from "@/lib/pollApi";
import { useAuth } from "@/hooks/useAuth";
import type { Poll, TimeSlot, ExactTimeSlot, FuzzyTimeSlot } from "@/types";

interface TimeSlotInput {
  id?: string;
  date: string;
  startTime: string; // for EXACT
  endTime: string;   // for EXACT
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
  const [activeInput, setActiveInput] = useState<HTMLElement | null>(null);

  const adminToken = searchParams.get("adminToken") || localStorage.getItem(`adminToken_${pollId}`);

  useEffect(() => {
    async function loadPoll() {
      if (!pollId) return;
      try {
        const result = await fetchPollAction({ pollId }) as any;
        const poll = result.data.poll as Poll;
        
        // Authorization check
        const isOwner = user && !user.isAnonymous && poll.organizerUid === user.uid;
        const isAdmin = adminToken === poll.adminToken;
        
        if (!isOwner && !isAdmin && !isLoading) {
           // We'll check this after loading to be sure
        }

        setTitle(poll.title);
        setDescription(poll.description || "");
        setLocation(poll.location);
        setSchedulingMode(poll.schedulingMode);
        setVoteCounts(result.data.voteCounts);

        const initialSlots: TimeSlotInput[] = poll.timeSlots.map(slot => {
          if (poll.schedulingMode === "EXACT") {
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
      } catch (err: any) {
        console.error("Failed to fetch poll:", err);
        setError("Poll not found or unauthorized.");
        setIsLoading(false);
      }
    }
    loadPoll();
  }, [pollId, user, adminToken]);

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
      setSlots([...slots, { date: lastSlot?.date || new Date().toISOString().split('T')[0], label: "General" }]);
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

    try {
      await updatePollAction({
        pollId,
        adminToken: adminToken || undefined,
        title,
        description,
        location,
        timeSlots: schedulingMode === "EXACT"
          ? slots.map(slot => ({
            id: slot.id,
            startTime: new Date(`${slot.date}T${slot.startTime}`).toISOString(),
            endTime: new Date(`${slot.date}T${slot.endTime}`).toISOString(),
          }))
          : slots.map(slot => ({
            id: slot.id,
            date: slot.date,
            label: slot.label || "General",
            time: slot.time || undefined,
          })),
      });

      navigate(`/poll/${pollId}${adminToken ? `?adminToken=${adminToken}` : ""}`);
    } catch (err: any) {
      console.error("Failed to update poll", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-neutral-500 font-medium">Loading poll details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Link 
        to={`/poll/${pollId}${adminToken ? `?adminToken=${adminToken}` : ""}`}
        className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Poll
      </Link>

      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">Edit Your Poll</h1>
        <p className="text-neutral-500">Update the details of "{title}"</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="poll-title" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <Type size={16} className="text-indigo-500" />
              Meeting Title
            </label>
            <input
              id="poll-title"
              required
              type="text"
              placeholder="e.g., Team Sync"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-lg"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="poll-description" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <Type size={16} className="text-indigo-500" />
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
              <MapPin size={16} className="text-indigo-500" />
              Location (Optional)
            </label>
            <input
              id="poll-location"
              type="text"
              placeholder="e.g., Zoom, Office"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-200">
           <div className="flex items-center gap-2 text-neutral-600 font-medium">
              <AlertTriangle size={18} className="text-amber-500" />
              <span>Scheduling mode is fixed to <strong>{schedulingMode}</strong></span>
           </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
          <label className="text-sm font-bold text-neutral-700 flex items-center gap-2 mb-6">
            <CalendarIcon size={16} className="text-indigo-500" />
            Time Slots
          </label>

          <div className="flex flex-col gap-4">
            {slots.map((slot, index) => {
              const counts = slot.id ? voteCounts[slot.id] : null;
              const hasVotes = counts && (counts.YES || 0) + (counts.NO || 0) + (counts.IF_NEED_BE || 0) > 0;
              
              return (
                <div key={index} className="flex flex-wrap items-center gap-3 p-4 bg-neutral-50 rounded-xl border border-neutral-100 group relative">
                  {hasVotes && (
                    <div className="absolute -top-2 -right-2 bg-amber-100 text-amber-700 p-1.5 rounded-full shadow-sm z-10" title="Has votes cast">
                      <AlertTriangle size={12} />
                    </div>
                  )}
                  <label className="relative flex-1 min-w-[160px] cursor-pointer">
                    <div className="flex items-center px-3 py-2 text-neutral-700 font-medium bg-white rounded-lg border border-neutral-200">
                      <CalendarIcon size={16} className="text-indigo-400 mr-2" />
                      <span>{slot.date ? new Date(slot.date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : "Select date"}</span>
                    </div>
                    <input
                      type="date"
                      required
                      onClick={handlePickerClick}
                      onBlur={handleBlur}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      value={slot.date}
                      onChange={(e) => updateSlot(index, "date", e.target.value)}
                    />
                  </label>
                  
                  {schedulingMode === "EXACT" ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        required
                        className="px-3 py-2 rounded-lg border border-neutral-200 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        value={slot.startTime}
                        onChange={(e) => updateSlot(index, "startTime", e.target.value)}
                      />
                      <span className="text-neutral-400 font-bold text-xs">TO</span>
                      <input
                        type="time"
                        required
                        className="px-3 py-2 rounded-lg border border-neutral-200 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        value={slot.endTime}
                        onChange={(e) => updateSlot(index, "endTime", e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        placeholder="Label"
                        className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 text-sm font-medium outline-none"
                        value={slot.label}
                        onChange={(e) => updateSlot(index, "label", e.target.value)}
                      />
                      <input
                        type="time"
                        className="w-28 px-3 py-2 rounded-lg border border-neutral-200 text-sm font-medium outline-none"
                        value={slot.time || ""}
                        onChange={(e) => updateSlot(index, "time", e.target.value)}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => removeSlot(index)}
                    disabled={slots.length === 1}
                    className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
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
          className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
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
