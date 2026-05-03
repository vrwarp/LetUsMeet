import { describe, it, expect } from 'vitest';
import { cycleVote } from './voteUtils';

describe('cycleVote', () => {
  it('should transition from NO to YES', () => {
    expect(cycleVote('NO')).toBe('YES');
  });

  it('should transition from YES to IF_NEED_BE', () => {
    expect(cycleVote('YES')).toBe('IF_NEED_BE');
  });

  it('should transition from IF_NEED_BE back to NO', () => {
    expect(cycleVote('IF_NEED_BE')).toBe('NO');
  });

  it('should handle undefined or unknown values by defaulting to YES', () => {
    // @ts-expect-error - testing invalid input
    expect(cycleVote('UNKNOWN')).toBe('YES');
  });
});
