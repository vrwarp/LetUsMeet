import { describe, it, expect } from 'vitest';
import { analyzeMnemonicTypos } from './recoveryCorrector';

describe('recoveryCorrector OOV triggers and prefixes', () => {
  const validMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';

  it('validates a perfect 24-word mnemonic successfully', () => {
    const report = analyzeMnemonicTypos(validMnemonic);
    expect(report.isValid).toBe(true);
    expect(report.hasOovWords).toBe(false);
  });

  it('does NOT trigger OOV for a valid prefix when typing the last word', () => {
    // Typing "sal" at the very end shouldn't trigger OOV because it is a prefix of "salmon"
    const report = analyzeMnemonicTypos('salmon salmon sal');
    expect(report.hasOovWords).toBe(false);
    expect(report.wordReports.every(w => w.inDict)).toBe(true);
  });

  it('TRIGGERS OOV if a prefix is finished (followed by other words)', () => {
    // "sal" is followed by "s", so it is a finished word and should trigger OOV
    const report = analyzeMnemonicTypos('salmon sal s');
    expect(report.hasOovWords).toBe(true);
    expect(report.wordReports[1].inDict).toBe(false); // "sal" is invalid
    expect(report.wordReports[2].inDict).toBe(true);  // "s" is a valid prefix of "salmon" etc
  });

  it('TRIGGERS OOV if a prefix is finished with a trailing space', () => {
    // "sal " has a trailing space, so it is finished and should trigger OOV
    const report = analyzeMnemonicTypos('salmon sal ');
    expect(report.hasOovWords).toBe(true);
    expect(report.wordReports[1].inDict).toBe(false);
  });

  it('TRIGGERS OOV immediately if the active prefix cannot start any valid word', () => {
    // No BIP39 word starts with "salq"
    const report = analyzeMnemonicTypos('salmon salq');
    expect(report.hasOovWords).toBe(true);
    expect(report.wordReports[1].inDict).toBe(false);
  });
});
