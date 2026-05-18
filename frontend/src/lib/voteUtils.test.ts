import { describe, it, expect } from 'vitest';
import { cycleVote } from './voteUtils';

describe('cycleVote', () => {
  it('should transition from BLANK to YES', () => {
    expect(cycleVote('BLANK')).toBe('YES');
  });

  it('should transition from YES to IF_NEED_BE', () => {
    expect(cycleVote('YES')).toBe('IF_NEED_BE');
  });

  it('should transition from IF_NEED_BE to NO', () => {
    expect(cycleVote('IF_NEED_BE')).toBe('NO');
  });

  it('should transition from NO back to BLANK', () => {
    expect(cycleVote('NO')).toBe('BLANK');
  });

  it('should handle undefined or unknown values by defaulting to BLANK', () => {
    // @ts-expect-error - testing invalid input
    expect(cycleVote('UNKNOWN')).toBe('BLANK');
  });
});
