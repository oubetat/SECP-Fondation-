/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-263 — G-Code Syntax & Dialect Parser
 * 
 * Verifies NC Block syntax, dialect compliance, block structure, modal group conflicts,
 * unsupported commands, and structural program integrity.
 */

import { ControllerDialect } from '../post-processor/PostTypes';
import { NCBlockTokens, VerificationIssue } from './GCodeVerificationTypes';

export class GCodeParser {
  // Recognized standard G-code groups to prevent in-block group conflicts
  private static readonly MODAL_GROUPS: Record<string, number[]> = {
    NON_MODAL: [4, 10, 28, 30, 53, 92],
    MOTION: [0, 1, 2, 3, 33, 73, 74, 76, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89],
    PLANE: [17, 18, 19],
    DISTANCE: [90, 91],
    ARC_DISTANCE: [90.1, 91.1],
    FEED_MODE: [93, 94, 95],
    UNITS: [20, 21, 70, 71],
    CUTTER_COMP: [40, 41, 42],
    TOOL_LENGTH: [43, 44, 49, 43.4],
    WCS: [54, 55, 56, 57, 58, 59, 54.1],
    CANNED_CYCLE_RETURN: [98, 99]
  };

  // Supported M-codes across dialects
  private static readonly SUPPORTED_M_CODES = new Set<number>([
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 19, 30, 88, 89, 98, 99, 128, 129
  ]);

  /**
   * Parse and validate syntax of tokenized NC blocks for the target dialect
   */
  public static parseAndValidate(
    blocks: NCBlockTokens[],
    dialect: ControllerDialect
  ): { issues: VerificationIssue[]; hasTermination: boolean } {
    const issues: VerificationIssue[] = [];
    let hasTermination = false;
    let issueCounter = 1;

    if (blocks.length === 0 || blocks.every(b => b.isEmpty || b.isCommentOnly)) {
      issues.push({
        id: `ISSUE-SYNTAX-${issueCounter++}`,
        code: 'SYNTAX_ERROR',
        severity: 'CRITICAL',
        lineIndex: 0,
        message: 'Empty or comment-only NC program provided. No executable NC blocks found.'
      });
      return { issues, hasTermination: false };
    }

    for (const block of blocks) {
      if (block.isEmpty || block.isCommentOnly) {
        continue;
      }

      // 1. Check for Duplicate Coordinate Words in Single Block (e.g. X10 X20)
      const coordinateWords: Array<'X' | 'Y' | 'Z' | 'A' | 'B' | 'C' | 'F' | 'S'> = ['X', 'Y', 'Z', 'A', 'B', 'C', 'F', 'S'];
      for (const letter of coordinateWords) {
        const count = (block.wordsMap.get(letter) || []).length;
        if (count > 1) {
          issues.push({
            id: `ISSUE-SYNTAX-${issueCounter++}`,
            code: 'SYNTAX_ERROR',
            severity: 'ERROR',
            lineIndex: block.lineIndex,
            sequenceNumber: block.sequenceNumber,
            rawGCode: block.rawText,
            axis: letter,
            message: `Conflicting multiple definitions of axis/word '${letter}' in block: ${block.rawText}`,
            recommendation: `Ensure each axis or modal parameter is specified at most once per NC block.`
          });
        }
      }

      // 2. Check for Conflicting G-Codes in Same Modal Group
      const gCodes = block.wordsMap.get('G') || [];
      if (gCodes.length > 1) {
        for (const [groupName, groupCodes] of Object.entries(this.MODAL_GROUPS)) {
          if (groupName === 'NON_MODAL') continue;
          const matchingInGroup = gCodes.filter(g => groupCodes.includes(g));
          if (matchingInGroup.length > 1) {
            issues.push({
              id: `ISSUE-MODAL-${issueCounter++}`,
              code: 'INVALID_MODAL_TRANSITION',
              severity: 'ERROR',
              lineIndex: block.lineIndex,
              sequenceNumber: block.sequenceNumber,
              rawGCode: block.rawText,
              message: `Conflicting modal G-codes from group '${groupName}' (G${matchingInGroup.join(', G')}) in the same block.`,
              recommendation: `Split conflicting G-codes across distinct NC blocks.`
            });
          }
        }
      }

      // 3. Check for Conflicting M-Codes (e.g. M03 spindle start and M05 spindle stop)
      const mCodes = block.wordsMap.get('M') || [];
      if (mCodes.includes(3) && mCodes.includes(5)) {
        issues.push({
          id: `ISSUE-SYNTAX-${issueCounter++}`,
          code: 'SYNTAX_ERROR',
          severity: 'CRITICAL',
          lineIndex: block.lineIndex,
          sequenceNumber: block.sequenceNumber,
          rawGCode: block.rawText,
          message: 'Contradictory spindle commands: M03 (Spindle CW) and M05 (Spindle Stop) in same block.'
        });
      }
      if (mCodes.includes(8) && mCodes.includes(9)) {
        issues.push({
          id: `ISSUE-SYNTAX-${issueCounter++}`,
          code: 'SYNTAX_ERROR',
          severity: 'ERROR',
          lineIndex: block.lineIndex,
          sequenceNumber: block.sequenceNumber,
          rawGCode: block.rawText,
          message: 'Contradictory coolant commands: M08 (Coolant ON) and M09 (Coolant OFF) in same block.'
        });
      }

      // Check Program Termination
      if (mCodes.includes(30) || mCodes.includes(2) || mCodes.includes(99)) {
        hasTermination = true;
      }

      // 4. Check for Unsupported M-Codes
      for (const m of mCodes) {
        if (!this.SUPPORTED_M_CODES.has(m)) {
          issues.push({
            id: `ISSUE-DIALECT-${issueCounter++}`,
            code: 'UNSUPPORTED_NC_COMMAND',
            severity: 'WARNING',
            lineIndex: block.lineIndex,
            sequenceNumber: block.sequenceNumber,
            rawGCode: block.rawText,
            message: `Unsupported or non-standard M-code M${m} detected for dialect ${dialect}.`
          });
        }
      }

      // 5. Dialect-Specific Checks
      this.checkDialectCompliance(block, dialect, issues, () => `ISSUE-DIALECT-${issueCounter++}`);
    }

    if (!hasTermination) {
      issues.push({
        id: `ISSUE-TERM-${issueCounter++}`,
        code: 'MISSING_PROGRAM_TERMINATION',
        severity: 'ERROR',
        lineIndex: blocks.length > 0 ? blocks[blocks.length - 1].lineIndex : 0,
        message: 'Program missing standard termination code (M30 or M02). Program execution may not halt safely.'
      });
    }

    return { issues, hasTermination };
  }

  private static checkDialectCompliance(
    block: NCBlockTokens,
    dialect: ControllerDialect,
    issues: VerificationIssue[],
    idGen: () => string
  ): void {
    const raw = block.rawText;
    const gCodes = block.wordsMap.get('G') || [];

    switch (dialect) {
      case 'FANUC_31I':
        // Fanuc expects standard G43.4 for TCPC or G05.1 for AICC
        break;
      case 'SIEMENS_840D':
        // Siemens handles TRAORI / TRAFOOF, CYCLE800
        break;
      case 'HEIDENHAIN_TNC640':
        // Heidenhain uses M128/M129 for TCPM
        break;
      case 'HAAS_NGC':
        // Haas uses G254 for DWO and G234 for TCPC
        if (gCodes.includes(234) && !block.wordsMap.has('H')) {
          // G234 TCPC requires H offset on Haas
          issues.push({
            id: idGen(),
            code: 'UNSUPPORTED_NC_COMMAND',
            severity: 'WARNING',
            lineIndex: block.lineIndex,
            sequenceNumber: block.sequenceNumber,
            rawGCode: raw,
            message: 'Haas G234 TCPC command is recommended to specify H tool length offset.'
          });
        }
        break;
      case 'GENERIC_ISO':
      default:
        // Generic ISO checks
        break;
    }
  }
}
