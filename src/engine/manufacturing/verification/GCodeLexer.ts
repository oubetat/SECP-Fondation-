import {
  LexicalErrorCode,
  LexicalToken,
  LexicalTokenType,
  ParsedNCBlock,
  ParsedWord
} from "./types";

export interface LexerResult {
  tokens: LexicalToken[];
  blocks: ParsedNCBlock[];
  errors: {
    code: LexicalErrorCode;
    line: number;
    column: number;
    message: string;
    rawText: string;
  }[];
  warnings: string[];
}

export class GCodeLexer {
  private static readonly VALID_WORD_LETTERS = new Set([
    "G", "M", "X", "Y", "Z", "A", "B", "C", "U", "V", "W",
    "I", "J", "K", "R", "F", "S", "T", "H", "D", "P", "Q",
    "L", "N", "O", "E"
  ]);

  /**
   * Tokenizes and parses raw NC program text into distinct blocks and tokens.
   */
  public tokenize(ncText: string): LexerResult {
    const tokens: LexicalToken[] = [];
    const blocks: ParsedNCBlock[] = [];
    const errors: LexerResult["errors"] = [];
    const warnings: string[] = [];

    const lines = ncText.split(/\r?\n/);
    let insideBlockComment = false;
    let commentStartLine = 0;
    let commentStartCol = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineNum = lineIdx + 1;
      const rawLine = lines[lineIdx];
      const trimmed = rawLine.trim();

      if (trimmed.length === 0) {
        continue;
      }

      // Check for program delimiter %
      if (trimmed === "%") {
        tokens.push({
          type: LexicalTokenType.PROGRAM_DELIMITER,
          value: "%",
          line: lineNum,
          column: 1,
          rawText: "%"
        });
        blocks.push({
          lineNumber: lineNum,
          words: [],
          sourceText: rawLine,
          parameters: {},
          isProgramDelimiter: true
        });
        continue;
      }

      let col = 1;
      let i = 0;
      let lineComment = "";
      const blockWords: ParsedWord[] = [];
      const seenWordKeys = new Set<string>();
      let sequenceNum: number | undefined;

      while (i < rawLine.length) {
        const char = rawLine[i];

        // Whitespace
        if (/\s/.test(char)) {
          i++;
          col++;
          continue;
        }

        // Semicolon comment to end of line
        if (char === ";") {
          const commentText = rawLine.slice(i + 1).trim();
          lineComment = (lineComment ? lineComment + " " : "") + commentText;
          tokens.push({
            type: LexicalTokenType.COMMENT,
            value: commentText,
            line: lineNum,
            column: col,
            rawText: rawLine.slice(i)
          });
          break;
        }

        // Parenthesized comment
        if (char === "(") {
          const closeIdx = rawLine.indexOf(")", i + 1);
          if (closeIdx === -1) {
            insideBlockComment = true;
            commentStartLine = lineNum;
            commentStartCol = col;
            errors.push({
              code: LexicalErrorCode.UNTERMINATED_COMMENT,
              line: lineNum,
              column: col,
              message: `Unterminated comment starting at line ${lineNum}`,
              rawText: rawLine.slice(i)
            });
            break;
          } else {
            const commentText = rawLine.slice(i + 1, closeIdx);
            lineComment = (lineComment ? lineComment + " " : "") + commentText;
            tokens.push({
              type: LexicalTokenType.COMMENT,
              value: commentText,
              line: lineNum,
              column: col,
              rawText: rawLine.slice(i, closeIdx + 1)
            });
            col += (closeIdx + 1 - i);
            i = closeIdx + 1;
            continue;
          }
        }

        // Check if letter word
        const upperChar = char.toUpperCase();
        if (GCodeLexer.VALID_WORD_LETTERS.has(upperChar)) {
          const wordLetter = upperChar;
          const startCol = col;
          i++;
          col++;

          // Parse numeric or alphanumeric parameter
          let numStr = "";
          while (i < rawLine.length && /[\d\.\+\-\e\E]/.test(rawLine[i])) {
            numStr += rawLine[i];
            i++;
            col++;
          }

          if (numStr.length === 0) {
            errors.push({
              code: LexicalErrorCode.INVALID_WORD,
              line: lineNum,
              column: startCol,
              message: `Word '${wordLetter}' without numeric value at line ${lineNum}`,
              rawText: wordLetter
            });
            continue;
          }

          const parsedNum = parseFloat(numStr);
          if (isNaN(parsedNum)) {
            errors.push({
              code: LexicalErrorCode.INVALID_NUMBER,
              line: lineNum,
              column: startCol,
              message: `Invalid number '${numStr}' for word '${wordLetter}' at line ${lineNum}`,
              rawText: wordLetter + numStr
            });
            continue;
          }

          const wordObj: ParsedWord = {
            letter: wordLetter,
            value: parsedNum,
            rawText: wordLetter + numStr,
            line: lineNum,
            column: startCol
          };

          tokens.push({
            type: LexicalTokenType.WORD,
            value: wordObj.rawText,
            line: lineNum,
            column: startCol,
            rawText: wordObj.rawText
          });

          // Check for duplicate conflicting tokens in the same block (e.g. two X values)
          const wordKey = wordLetter === "G" || wordLetter === "M" ? `${wordLetter}${parsedNum}` : wordLetter;
          if (wordLetter !== "G" && wordLetter !== "M" && seenWordKeys.has(wordLetter)) {
            errors.push({
              code: LexicalErrorCode.DUPLICATE_TOKEN,
              line: lineNum,
              column: startCol,
              message: `Duplicate axis or parameter word '${wordLetter}' in line ${lineNum}`,
              rawText: wordObj.rawText
            });
          }
          seenWordKeys.add(wordKey);

          if (wordLetter === "N") {
            sequenceNum = Math.floor(parsedNum);
          }

          blockWords.push(wordObj);
          continue;
        }

        // Unrecognized character
        errors.push({
          code: LexicalErrorCode.INVALID_TOKEN,
          line: lineNum,
          column: col,
          message: `Unrecognized token '${char}' at line ${lineNum}, col ${col}`,
          rawText: char
        });
        i++;
        col++;
      }

      // Build ParsedNCBlock
      const params: Record<string, number | string> = {};
      for (const w of blockWords) {
        params[w.letter] = w.value;
      }

      blocks.push({
        lineNumber: lineNum,
        sequenceNumber: sequenceNum,
        words: blockWords,
        sourceText: rawLine,
        parameters: params,
        comment: lineComment || undefined
      });
    }

    return {
      tokens,
      blocks,
      errors,
      warnings
    };
  }
}
