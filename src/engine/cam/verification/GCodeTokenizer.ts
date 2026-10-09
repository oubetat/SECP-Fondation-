/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-263 — G-Code Tokenizer
 * 
 * Lexical scanner and tokenizer for CNC G-code and conversational dialect lines.
 * Transforms raw text lines into structured NCBlockTokens with exact numeric values,
 * precision tracking, comment preservation, and dialect-specific syntax parsing.
 */

import { ControllerDialect } from '../post-processor/PostTypes';
import { NCBlockTokens, NCWord, NCWordLetter } from './GCodeVerificationTypes';

export class GCodeTokenizer {
  /**
   * Tokenize an entire NC program string into an array of NCBlockTokens
   */
  public static tokenizeProgram(
    rawText: string,
    dialect: ControllerDialect = 'GENERIC_ISO'
  ): NCBlockTokens[] {
    const lines = rawText.split(/\r?\n/);
    return lines.map((line, index) => this.tokenizeLine(line, index, dialect));
  }

  /**
   * Tokenize a single G-Code line into NCBlockTokens
   */
  public static tokenizeLine(
    lineText: string,
    lineIndex: number,
    dialect: ControllerDialect = 'GENERIC_ISO'
  ): NCBlockTokens {
    const trimmed = lineText.trim();

    if (trimmed.length === 0) {
      return {
        lineIndex,
        rawText: lineText,
        words: [],
        wordsMap: new Map(),
        isCommentOnly: false,
        isEmpty: true,
        hasBlockSkip: false
      };
    }

    let workLine = trimmed;
    let comment: string | undefined;
    const hasBlockSkip = workLine.startsWith('/');
    if (hasBlockSkip) {
      workLine = workLine.substring(1).trim();
    }

    // 1. Extract Comments based on Dialect
    // Dialects like Siemens use ';' for comments, others use '( ... )' or ';'
    const commentMatchParen = workLine.match(/\((.*?)\)/);
    const commentMatchSemi = workLine.match(/;(.*)$/);

    if (commentMatchParen) {
      comment = commentMatchParen[1].trim();
      workLine = workLine.replace(/\(.*?\)/g, ' ').trim();
    } else if (commentMatchSemi) {
      comment = commentMatchSemi[1].trim();
      workLine = workLine.substring(0, workLine.indexOf(';')).trim();
    }

    const isCommentOnly = workLine.length === 0 && comment !== undefined;

    // 2. Tokenize NC words
    const words: NCWord[] = [];
    const wordsMap = new Map<NCWordLetter, number[]>();
    let sequenceNumber: number | undefined;

    if (!isCommentOnly && workLine.length > 0) {
      // Regex matches letter followed by optional sign and digits/decimals
      // e.g. G01, X-120.450, M08, S12000, F500.0, etc.
      // Also handles Siemens Sinumerik named commands like TRAORI, CYCLE800, etc.
      const wordRegex = /([A-Za-z])([+-]?\d*\.?\d+)/g;
      let match: RegExpExecArray | null;

      while ((match = wordRegex.exec(workLine)) !== null) {
        const letter = match[1].toUpperCase() as NCWordLetter;
        const rawVal = match[2];
        const numVal = parseFloat(rawVal);
        const isInteger = !rawVal.includes('.');
        const precision = isInteger ? 0 : (rawVal.split('.')[1] || '').length;

        const word: NCWord = {
          letter,
          numericValue: isNaN(numVal) ? 0 : numVal,
          rawValue: rawVal,
          isInteger,
          precision
        };

        if (letter === 'N') {
          sequenceNumber = Math.round(numVal);
        } else {
          words.push(word);
          const existing = wordsMap.get(letter) || [];
          existing.push(word.numericValue);
          wordsMap.set(letter, existing);
        }
      }

      // Handle named dialect commands (e.g. Siemens TRAORI, TRAFOOF, CYCLE800, Heidenhain M128)
      if (dialect === 'SIEMENS_840D') {
        if (/TRAORI\b/i.test(workLine)) {
          words.push({ letter: 'G', numericValue: 43.4, rawValue: 'TRAORI', isInteger: false, precision: 1 });
        }
        if (/TRAFOOF\b/i.test(workLine)) {
          words.push({ letter: 'G', numericValue: 49, rawValue: 'TRAFOOF', isInteger: true, precision: 0 });
        }
      }
    }

    return {
      lineIndex,
      sequenceNumber,
      rawText: lineText,
      comment,
      words,
      wordsMap,
      isCommentOnly,
      isEmpty: false,
      hasBlockSkip
    };
  }

  /**
   * Helper to retrieve all numeric values for a given word letter in a block
   */
  public static getWordValues(block: NCBlockTokens, letter: NCWordLetter): number[] {
    return block.wordsMap.get(letter) || [];
  }

  /**
   * Helper to retrieve the first value for a word letter, or null if absent
   */
  public static getFirstWordValue(block: NCBlockTokens, letter: NCWordLetter): number | null {
    const vals = block.wordsMap.get(letter);
    return vals && vals.length > 0 ? vals[0] : null;
  }
}
