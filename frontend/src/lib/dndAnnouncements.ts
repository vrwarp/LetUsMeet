import type { Announcements } from "@dnd-kit/core";

/**
 * Screen-reader announcements for the sortable time-slot lists. dnd-kit emits
 * these to a live region as the user picks up, moves, drops, or cancels a drag,
 * describing reorder operations in human terms (in place of the default
 * generic instructions).
 */
export const dragAnnouncements: Announcements = {
  onDragStart({ active }) {
    return `Picked up slot ${active.id}. Use the arrow keys to move, space or enter to drop, escape to cancel.`;
  },
  onDragOver({ active, over }) {
    if (over) {
      return `Slot ${active.id} was moved over position of slot ${over.id}.`;
    }
    return `Slot ${active.id} is no longer over a drop position.`;
  },
  onDragEnd({ active, over }) {
    if (over) {
      return `Slot ${active.id} was dropped onto position of slot ${over.id}. Order updated.`;
    }
    return `Slot ${active.id} was dropped.`;
  },
  onDragCancel({ active }) {
    return `Reordering cancelled. Slot ${active.id} returned to its original position.`;
  },
};

export default dragAnnouncements;
