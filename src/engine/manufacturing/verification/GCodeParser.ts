import {
  NCProgramAST,
  ParsedNCBlock
} from "./types";
import { GCodeLexer } from "./GCodeLexer";

export interface ParserResult {
  ast: NCProgramAST;
  programNumber?: number;
  programName?: string;
  totalBlocks: number;
  totalMotions: number;
  totalToolChanges: number;
  errors: string[];
  warnings: string[];
}

export class GCodeParser {
  private lexer: GCodeLexer;

  constructor() {
    this.lexer = new GCodeLexer();
  }

  /**
   * Parses raw NC text or pre-parsed blocks into a full structured NCProgramAST.
   */
  public parse(ncInput: string | ParsedNCBlock[]): ParserResult {
    let blocks: ParsedNCBlock[];
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof ncInput === "string") {
      const lexResult = this.lexer.tokenize(ncInput);
      blocks = lexResult.blocks;
      for (const err of lexResult.errors) {
        errors.push(`[Line ${err.line}] ${err.code}: ${err.message}`);
      }
      warnings.push(...lexResult.warnings);
    } else {
      blocks = ncInput;
    }

    let programNumber: number | undefined;
    let programName: string | undefined;

    const headerBlocks: ParsedNCBlock[] = [];
    const setupBlocks: ParsedNCBlock[] = [];
    const toolChangeBlocks: ParsedNCBlock[] = [];
    const motionBlocks: ParsedNCBlock[] = [];
    const footerBlocks: ParsedNCBlock[] = [];

    const operations: { operationId: string; blocks: ParsedNCBlock[] }[] = [];
    let currentOpId = "OP_DEFAULT";
    let currentOpBlocks: ParsedNCBlock[] = [];

    let isHeader = true;
    let isFooter = false;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const words = block.words;

      // Extract Program Number (O-word or :1234)
      for (const w of words) {
        if (w.letter === "O") {
          programNumber = typeof w.value === "number" ? w.value : parseInt(w.value as string, 10);
        }
      }

      // Check comments for program name or operation tag
      if (block.comment) {
        if (!programName && isHeader) {
          programName = block.comment;
        }
        const opMatch = block.comment.match(/OPERATION[:\s]+([\w\-]+)/i);
        if (opMatch) {
          if (currentOpBlocks.length > 0) {
            operations.push({ operationId: currentOpId, blocks: [...currentOpBlocks] });
            currentOpBlocks = [];
          }
          currentOpId = opMatch[1];
        }
      }

      // Detect Footer (M30, M02, or end retracts)
      const hasM30 = words.some(w => w.letter === "M" && (w.value === 30 || w.value === 2));
      if (hasM30) {
        isFooter = true;
      }

      // Detect Tool Change (M6 or T-word with M6)
      const hasM6 = words.some(w => w.letter === "M" && w.value === 6);
      const hasT = words.some(w => w.letter === "T");
      if (hasM6 || (hasT && !words.some(w => w.letter === "G" && (w.value === 0 || w.value === 1 || w.value === 2 || w.value === 3)))) {
        toolChangeBlocks.push(block);
      }

      // Detect Motion (G0, G1, G2, G3, or coordinates X/Y/Z/A/B/C with active motion)
      const hasMotionG = words.some(w => w.letter === "G" && [0, 1, 2, 3, 81, 82, 83, 84, 85].includes(Number(w.value)));
      const hasAxisCoord = words.some(w => ["X", "Y", "Z", "A", "B", "C"].includes(w.letter));

      if (hasMotionG || hasAxisCoord) {
        isHeader = false;
        motionBlocks.push(block);
      } else if (isHeader) {
        headerBlocks.push(block);
      }

      // Detect Setup (G90, G21, G17, G54, G40, G49, G80)
      const hasSetupG = words.some(w => w.letter === "G" && [17, 18, 19, 20, 21, 40, 49, 54, 55, 56, 57, 58, 59, 80, 90, 91, 94, 95].includes(Number(w.value)));
      if (hasSetupG && !hasMotionG && !hasAxisCoord) {
        setupBlocks.push(block);
      }

      if (isFooter) {
        footerBlocks.push(block);
      }

      currentOpBlocks.push(block);
    }

    if (currentOpBlocks.length > 0) {
      operations.push({ operationId: currentOpId, blocks: currentOpBlocks });
    }

    const ast: NCProgramAST = {
      programId: programNumber ? `O${programNumber}` : "PROG_UNNAMED",
      header: headerBlocks,
      setup: setupBlocks,
      operations,
      toolChanges: toolChangeBlocks,
      motions: motionBlocks,
      footer: footerBlocks,
      allBlocks: blocks
    };

    return {
      ast,
      programNumber,
      programName,
      totalBlocks: blocks.length,
      totalMotions: motionBlocks.length,
      totalToolChanges: toolChangeBlocks.length,
      errors,
      warnings
    };
  }
}
