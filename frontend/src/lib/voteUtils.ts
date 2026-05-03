import type { VoteValue } from "../types/index";

/**
 * Cycles through vote values: NO -> YES -> IF_NEED_BE -> NO
 */
export function cycleVote(current: VoteValue): VoteValue {
  switch (current) {
    case "NO":
      return "YES";
    case "YES":
      return "IF_NEED_BE";
    case "IF_NEED_BE":
      return "NO";
    default:
      return "YES";
  }
}
