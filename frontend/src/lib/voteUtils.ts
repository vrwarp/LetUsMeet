import type { VoteValue } from "../types/index";

/**
 * Cycles through vote values: BLANK -> YES -> IF_NEED_BE -> NO -> BLANK
 */
export function cycleVote(current: VoteValue): VoteValue {
  switch (current) {
    case "BLANK":
      return "YES";
    case "YES":
      return "IF_NEED_BE";
    case "IF_NEED_BE":
      return "NO";
    case "NO":
    default:
      return "BLANK";
  }
}
