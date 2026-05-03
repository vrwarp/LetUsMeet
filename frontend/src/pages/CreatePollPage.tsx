import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Calendar as CalendarIcon, MapPin, Type, ArrowRight, Loader2 } from "lucide-react";
import { createPollApi } from "@/lib/pollApi";
import { useAuth } from "@/hooks/useAuth";

interface TimeSlotInput {
  date: string;
  startTime: string;
  endTime: string;
}

export default function CreatePollPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [slots, setSlots] = useState<TimeSlotInput[]>([
    { date: new Date().toISOString().split('T')[0], startTime: "09:00", endTime: "10:00" }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addSlot = () => {
    const lastSlot = slots[slots.length - 1];
    setSlots([...slots, { ...lastSlot }]);
  };

  const removeSlot = (index: number) => {
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
    if (!user) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      const formattedSlots = slots.map(slot => ({
        startTime: new Date(`${slot.date}T${slot.startTime}`).toISOString(),
        endTime: new Date(`${slot.date}T${slot.endTime}`).toISOString(),
      }));

      const result = await createPollApi({
        title,
        location,
        schedulingMode: "EXACT",
        timeSlots: formattedSlots,
      });

      const pollId = result.data.pollId;
      navigate(`/poll/${pollId}`);
    } catch (err: any) {
      console.error("Failed to create poll", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">Create a Meeting Poll</h1>
        <p className="text-neutral-500">Define the details and suggest some time slots.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        {/* Basic Info Card */}
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <Type size={16} className="text-indigo-500" />
              Meeting Title
            </label>
            <input
              required
              type="text"
              placeholder="e.g., Team Sync, Dinner with friends"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-lg"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <MapPin size={16} className="text-indigo-500" />
              Location (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Zoom, Starbucks, Office"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>

        {/* Time Slots Card */}
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <CalendarIcon size={16} className="text-indigo-500" />
              Propose Time Slots
            </label>
          </div>

          <div className="flex flex-col gap-4">
            {slots.map((slot, index) => (
              <div key={index} className="flex flex-wrap items-center gap-3 p-4 bg-neutral-50 rounded-xl border border-neutral-100 group relative">
                <input
                  type="date"
                  required
                  className="flex-1 min-w-[140px] px-3 py-2 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  value={slot.date}
                  onChange={(e) => updateSlot(index, "date", e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    required
                    className="w-32 px-3 py-2 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                    value={slot.startTime}
                    onChange={(e) => updateSlot(index, "startTime", e.target.value)}
                  />
                  <span className="text-neutral-400 font-medium">to</span>
                  <input
                    type="time"
                    required
                    className="w-32 px-3 py-2 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                    value={slot.endTime}
                    onChange={(e) => updateSlot(index, "endTime", e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeSlot(index)}
                  disabled={slots.length === 1}
                  className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 disabled:hidden"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}

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
          className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={24} />
              Creating...
            </>
          ) : (
            <>
              Create and Share
              <ArrowRight size={24} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
