import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';


import { useNavigate, useParams, Link } from "react-router-dom";
import { Plus, Trash2, Calendar as CalendarIcon, MapPin, Type, Save, Loader2, ArrowLeft, Clock, X, Lock } from "lucide-react";
import {
  extractKeyFromFragment,
  subscribeToLedger,
  getLedgerSession,
  friendlyStatus
} from "@/lib/pollService";
import type { LedgerSession } from "charproof";
import type { PollState, PollAction, ExactTimeSlot, FuzzyTimeSlot } from "@/types";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { dragAnnouncements } from "@/lib/dndAnnouncements";

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


function SortableSlotItem({
  id,
  index,
  slot,
  schedulingMode,
  isReady,
  updateSlot,
  removeSlot,
  handlePickerClick,
  handleBlur
}: {
  id: string;
  index: number;
  slot: TimeSlotInput;
  schedulingMode: "EXACT" | "FUZZY";
  isReady: boolean;
  updateSlot: (index: number, field: keyof TimeSlotInput, value: string) => void;
  removeSlot: (index: number) => void;
  handlePickerClick: (e: React.MouseEvent<HTMLInputElement>) => void;
  handleBlur: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group/item">
      <div className="flex flex-col gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100 transition-all hover:border-neutral-200 shadow-sm">
        {schedulingMode === "EXACT" ? (
          <>
            {/* EXACT Row 1 */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                {...attributes}
                {...listeners}
                className="flex items-center justify-center cursor-grab active:cursor-grabbing p-1 text-neutral-600 hover:text-neutral-700 transition-colors flex-shrink-0 touch-none"
              >
                <GripVertical size={20} aria-hidden="true" />
                <span className="sr-only">Reorder slot {index + 1}</span>
              </button>
              <label className="relative group/date cursor-pointer flex-1 min-w-0">
                <div className="flex items-center px-3 h-10 text-neutral-700 font-bold bg-white rounded-xl border border-neutral-200 group-focus-within/date:border-indigo-500 group-focus-within/date:ring-2 group-focus-within/date:ring-indigo-500/20 transition-all shadow-sm">
                  <CalendarIcon size={14} className="text-indigo-400 mr-2 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate text-sm font-bold">{slot.date ? new Date(slot.date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : "Select date"}</span>
                </div>
                <input
                  type="date"
                  required
                  aria-label="Slot date"
                  data-testid={`slot-date-${index}`}
                  onClick={handlePickerClick}
                  onBlur={handleBlur}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  value={slot.date}
                  onChange={(e) => updateSlot(index, "date", e.target.value)}
                  disabled={!isReady}
                />
              </label>
              <button
                type="button"
                onClick={() => removeSlot(index)}
                aria-label="Remove time slot"
                disabled={!isReady}
                className="w-9 h-9 flex items-center justify-center bg-white text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl border border-neutral-200 shadow-sm transition-all flex-shrink-0"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>

            {/* EXACT Row 2 */}
            <div className="w-full">
              <div className="flex items-center gap-2">
                <label className="relative group/start cursor-pointer flex-1">
                  <div className="flex items-center px-3 py-2 text-neutral-700 font-bold bg-white rounded-xl border border-neutral-200 group-focus-within/start:border-indigo-500 group-focus-within/start:ring-2 group-focus-within/start:ring-indigo-500/20 transition-all w-full shadow-sm">
                    <Clock size={14} className="text-indigo-400 mr-2 flex-shrink-0" aria-hidden="true" />
                    <span className="text-sm">{slot.startTime || "09:00"}</span>
                  </div>
                  <input
                    type="time"
                    required
                    aria-label="Start time"
                    data-testid={`slot-start-${index}`}
                    onClick={handlePickerClick}
                    onBlur={handleBlur}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    value={slot.startTime}
                    onChange={(e) => updateSlot(index, "startTime", e.target.value)}
                    disabled={!isReady}
                  />
                </label>
                <span className="text-neutral-600 font-bold text-[10px] uppercase tracking-widest flex-shrink-0">to</span>
                <label className="relative group/end cursor-pointer flex-1">
                  <div className="flex items-center px-3 py-2 text-neutral-700 font-bold bg-white rounded-xl border border-neutral-200 group-focus-within/end:border-indigo-500 group-focus-within/end:ring-2 group-focus-within/end:ring-indigo-500/20 transition-all w-full shadow-sm">
                    <Clock size={14} className="text-indigo-400 mr-2 flex-shrink-0" aria-hidden="true" />
                    <span className="text-sm">{slot.endTime || "10:00"}</span>
                  </div>
                  <input
                    type="time"
                    required
                    aria-label="End time"
                    data-testid={`slot-end-${index}`}
                    onClick={handlePickerClick}
                    onBlur={handleBlur}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    value={slot.endTime}
                    onChange={(e) => updateSlot(index, "endTime", e.target.value)}
                    disabled={!isReady}
                  />
                </label>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* FUZZY Row 1: Grip handle, Label, Trash */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                {...attributes}
                {...listeners}
                className="flex items-center justify-center cursor-grab active:cursor-grabbing p-1 text-neutral-600 hover:text-neutral-700 transition-colors flex-shrink-0 touch-none"
              >
                <GripVertical size={20} aria-hidden="true" />
                <span className="sr-only">Reorder slot {index + 1}</span>
              </button>
              <input
                type="text"
                aria-label="Slot label"
                data-testid={`slot-label-${index}`}
                placeholder="Label (e.g. Morning)"
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-neutral-200 text-sm font-bold outline-none bg-white shadow-sm focus:ring-2 focus:ring-indigo-500/20"
                value={slot.label || ""}
                onChange={(e) => updateSlot(index, "label", e.target.value)}
                disabled={!isReady}
              />
              <button
                type="button"
                onClick={() => removeSlot(index)}
                aria-label="Remove time slot"
                disabled={!isReady}
                className="w-9 h-9 flex items-center justify-center bg-white text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-xl border border-neutral-200 shadow-sm transition-all flex-shrink-0"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>

            {/* FUZZY Row 2: Date, Time */}
            <div className="flex items-center gap-2">
              <label className="relative group/date cursor-pointer flex-1 min-w-0">
                <div className="flex items-center px-3 h-10 text-neutral-700 font-bold bg-white rounded-xl border border-neutral-200 group-focus-within/date:border-indigo-500 group-focus-within/date:ring-2 group-focus-within/date:ring-indigo-500/20 transition-all shadow-sm">
                  <CalendarIcon size={14} className="text-indigo-400 mr-2 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate text-sm font-bold">{slot.date ? new Date(slot.date + "T00:00:00").toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : "Select date"}</span>
                </div>
                <input
                  type="date"
                  required
                  aria-label="Slot date"
                  data-testid={`slot-date-${index}`}
                  onClick={handlePickerClick}
                  onBlur={handleBlur}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  value={slot.date}
                  onChange={(e) => updateSlot(index, "date", e.target.value)}
                  disabled={!isReady}
                />
              </label>

              <label className="relative group/time cursor-pointer flex-shrink-0">
                <div className="flex items-center px-3 h-10 text-neutral-600 font-bold bg-white rounded-xl border border-neutral-200 group-focus-within/time:border-indigo-400 group-focus-within/time:ring-2 group-focus-within/time:ring-indigo-500/10 transition-all w-[110px] shadow-sm hover:border-neutral-300">
                  <span className="text-neutral-600 font-black mr-2 text-sm" aria-hidden="true">~</span>
                  <span className="truncate text-sm">{slot.time || "--:--"}</span>
                  {slot.time && (
                    <button
                      type="button"
                      aria-label="Clear approximate time"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        updateSlot(index, "time", "");
                      }}
                      disabled={!isReady}
                      className="ml-auto text-neutral-400 hover:text-red-500 transition-colors relative z-20"
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <input
                  type="time"
                  aria-label="Approximate time"
                  data-testid={`slot-time-${index}`}
                  onClick={handlePickerClick}
                  onBlur={handleBlur}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                  value={slot.time || ""}
                  onChange={(e) => updateSlot(index, "time", e.target.value)}
                  disabled={!isReady}
                />
              </label>
            </div>

            {/* FUZZY Row 3: Suggestions */}
            <div className="flex flex-wrap gap-1">
              {["Morning", "Afternoon", "Evening"].map(suggestion => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => updateSlot(index, "label", suggestion)}
                  disabled={!isReady}
                  className="whitespace-nowrap px-2 py-1 rounded-full bg-white text-[10px] font-bold text-neutral-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all uppercase tracking-tight border border-neutral-200 hover:border-indigo-100 shadow-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function EditPollPage() {
  const { pollId } = useParams<{ pollId: string }>();
  const navigate = useNavigate();
  const [isReady, setIsReady] = useState(false);

  useDocumentTitle("Edit poll — LetUsMeet");

  useEffect(() => {
    setIsReady(true);
  }, []);
  
  const [pollState, setPollState] = useState<PollState | null>(null);
  const [syncStatus, setSyncStatus] = useState("Loading this poll…");
  const [session, setSession] = useState<LedgerSession | null>(null);
  const [activeInput, setActiveInput] = useState<HTMLElement | null>(null);

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSlots((items) => {
        const oldIndex = items.findIndex((i) => (i.id || "") === active.id);
        const newIndex = items.findIndex((i) => (i.id || "") === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

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
        const s = await getLedgerSession(pollId, { shareableKey: b64Key });
        setSession(s);

        const unsubscribe = subscribeToLedger(s, (state, status) => {
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
                     id: exact.id || generateId(),
                     date: start.toISOString().split('T')[0],
                     startTime: start.toTimeString().substring(0, 5),
                     endTime: end.toTimeString().substring(0, 5),
                   };
                 } else {
                   const fuzzy = slot as FuzzyTimeSlot;
                   return {
                     id: fuzzy.id || generateId(),
                     date: fuzzy.date,
                     label: fuzzy.label,
                     time: fuzzy.time,
                   };
                 }
               });
               setSlots(initialSlots);
            }
            setIsLoading(false);
          } else if (status === "No valid events found.") {
            setIsLoading(false);
          }
          setSyncStatus(status);
        });

        // Verify Admin
        if (pollState?.adminPublicKey) {
           setIsAdmin(s.getSignerPublicKey() === pollState.adminPublicKey);
        }

        return unsubscribe;
      } catch {
        setError("Failed to initialize.");
        setIsLoading(false);
      }
    };

    const unsubPromise = init();
    return () => { unsubPromise.then(unsub => unsub?.()); };
  }, [pollId, pollState?.adminPublicKey]);

  // Re-check admin when pollState is updated
  useEffect(() => {
    if (session && pollState?.adminPublicKey) {
      setIsAdmin(session.getSignerPublicKey() === pollState.adminPublicKey);
    }
  }, [pollState?.adminPublicKey, session]);

  const addSlot = () => {
    const lastSlot = slots[slots.length - 1];
    const defaultDate = new Date().toISOString().split('T')[0];
    const newId = generateId();
    const mode = pollState?.metadata?.schedulingMode || "EXACT";

    if (mode === "EXACT") {
      setSlots([...slots, { 
        id: newId,
        date: lastSlot?.date || defaultDate, 
        startTime: lastSlot?.startTime || "09:00", 
        endTime: lastSlot?.endTime || "10:00" 
      }]);
    } else {
      setSlots([...slots, { 
        id: newId,
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
    if (!session || !pollId || !pollState?.metadata) return;

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
      await session.appendEvent(action);
      
      navigate(`/poll/${pollId}${window.location.search}${window.location.hash}`);
    } catch {
      setError("Failed to update poll.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h1 className="sr-only">Loading poll editor</h1>
        <Loader2 className="w-10 h-10 text-brand-green animate-spin" aria-hidden="true" />
        <p role="status" aria-live="polite" className="text-neutral-500 font-medium">{friendlyStatus(syncStatus)}</p>
      </div>
    );
  }

  if (error || !pollState || !isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Lock className="w-16 h-16 text-neutral-300 mx-auto mb-6" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-neutral-800 mb-4">Admin Access Required</h1>
        <p className="text-neutral-600 text-lg mb-8">{error || "You do not have the administrative key for this poll."}</p>
        <Link to={`/poll/${pollId}${window.location.search}${window.location.hash}`} className="btn-primary-green inline-block">Back to Poll</Link>
      </div>
    );
  }

  const schedulingMode = pollState.metadata!.schedulingMode;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link 
        to={`/poll/${pollId}${window.location.search}${window.location.hash}`}
        className="inline-flex items-center gap-2 text-brand-green-dark font-bold mb-8"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back to Poll
      </Link>

      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">Edit Your Poll</h1>
        <p className="text-neutral-500">Update the details of "{pollState.metadata!.title}"</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="poll-title" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <Type size={16} className="text-brand-green" aria-hidden="true" />
              Meeting Title
            </label>
            <input
              id="poll-title"
              required
              type="text"
              className="w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!isReady}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="poll-description" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <Type size={16} className="text-brand-green" aria-hidden="true" />
              Description
            </label>
            <textarea
              id="poll-description"
              className="w-full min-h-[100px] resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isReady}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="poll-location" className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <MapPin size={16} className="text-brand-green" aria-hidden="true" />
              Location
            </label>
            <input
              id="poll-location"
              type="text"
              className="w-full"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={!isReady}
            />
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
          <span className="text-sm font-bold text-neutral-700 flex items-center gap-2 mb-6">
            <CalendarIcon size={16} className="text-brand-green" aria-hidden="true" />
            Time Slots
          </span>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            accessibility={{ announcements: dragAnnouncements }}
          >
            <SortableContext
              items={slots.map(s => s.id || "")}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {slots.map((slot, index) => (
                  <SortableSlotItem
                    key={slot.id || index}
                    id={slot.id || ""}
                    index={index}
                    slot={slot}
                    schedulingMode={schedulingMode}
                    isReady={isReady}
                    updateSlot={updateSlot}
                    removeSlot={removeSlot}
                    handlePickerClick={handlePickerClick}
                    handleBlur={handleBlur}
                  />
                ))}

                <button
                  type="button"
                  onClick={addSlot}
                  disabled={!isReady}
                  className="flex flex-col items-center justify-center gap-2 p-3 border-2 border-dashed border-neutral-300 rounded-xl text-neutral-800 hover:border-brand-green hover:text-brand-green hover:bg-brand-green-light/20 transition-all font-bold text-sm min-h-[102px] w-full h-full disabled:text-neutral-600 disabled:border-neutral-200 disabled:cursor-not-allowed"
                >
                  <Plus size={20} aria-hidden="true" />
                  Add time slot
                </button>
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {error && <div role="alert" className="p-4 bg-red-50 text-red-600 rounded-xl font-bold">{error}</div>}

        <button
          type="submit"
          aria-busy={isSubmitting}
          disabled={!isReady || isSubmitting || !title || slots.length === 0}
          className="btn-primary-green w-full py-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <><Save size={24} aria-hidden="true" /> Save Changes</>}
        </button>
      </form>
    </div>
  );
}
