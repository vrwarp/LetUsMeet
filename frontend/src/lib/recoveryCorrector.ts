import * as bip39 from 'bip39';

export interface TypoReport {
  isValid: boolean;
  hasOovWords: boolean;
  wordReports: WordReport[];
}

export interface WordReport {
  index: number;
  word: string;
  inDict: boolean;
  suggestions: string[];
}

/**
 * Calculates Levenshtein Distance between two strings.
 */
function getLevenshteinDistance(a: string, b: string): number {
  const tmp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) tmp[i][0] = i;
  for (let j = 0; j <= b.length; j++) tmp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        tmp[i][j] = tmp[i - 1][j - 1];
      } else {
        tmp[i][j] = Math.min(
          tmp[i - 1][j] + 1,    // deletion
          tmp[i][j - 1] + 1,    // insertion
          tmp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  return tmp[a.length][b.length];
}

/**
 * Finds all BIP39 words within a given Levenshtein distance or prefix matches.
 */
export function getSimilarBip39Words(word: string, maxDistance = 1): string[] {
  const wordlist = bip39.wordlists.english;
  return wordlist.filter(w =>
    getLevenshteinDistance(word, w) <= maxDistance || w.startsWith(word)
  );
}

/**
 * Performs a comprehensive real-time validation and correction analysis.
 */
export function analyzeMnemonicTypos(rawInput: string): TypoReport {
  const words = rawInput.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const wordlist = bip39.wordlists.english;
  const hasTrailingSpace = /\s$/.test(rawInput);
  const lastIndex = words.length - 1;

  const wordReports: WordReport[] = words.map((word, index) => {
    const isFinished = index < lastIndex || hasTrailingSpace;
    let inDict = false;
    let suggestions: string[] = [];

    if (isFinished) {
      inDict = wordlist.includes(word);
      suggestions = inDict ? [] : getSimilarBip39Words(word);
    } else {
      // Actively typing the very last word: do not trigger unless it's not a prefix of ANY valid word
      const isPrefixOfAnyWord = wordlist.some(w => w.startsWith(word));
      if (isPrefixOfAnyWord) {
        inDict = true;
        suggestions = [];
      } else {
        inDict = false;
        suggestions = getSimilarBip39Words(word);
      }
    }

    return {
      index,
      word,
      inDict,
      suggestions
    };
  });

  const hasOovWords = wordReports.some(r => !r.inDict);
  const phrase = words.join(' ');
  const isValid = words.length === 24 && !hasOovWords && bip39.validateMnemonic(phrase);

  return { isValid, hasOovWords, wordReports };
}
