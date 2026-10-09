/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-263 — Semantic Validator & Precision Auditor
 * 
 * Verifies high-level CNC semantics, numerical precision, rounding errors,
 * safety initialization sequences, and multi-axis RTCP/TCPM activation/cancellation lifecycles.
 */

import { ControllerDialect } from '../post-processor/PostTypes';
import { NCBlockTokens, NCExecutionState, NCPrecisionReport, VerificationIssue } from './GCodeVerificationTypes';

export class SemanticValidator {
  /**
   * Perform semantic audit, numerical precision check, and controller-specific safety validation
   */
  public static validateSemantics(
    blocks: NCBlockTokens[],
    states: NCExecutionState[],
    dialect: ControllerDialect
  ): { precisionReport: NCPrecisionReport; issues: VerificationIssue[] } {
    const issues: VerificationIssue[] = [];
    let issueCounter = 1;

    // 1. Audit Numerical Precision & Rounding
    let maxPrecision = 0;
    let totalNumericWords = 0;
    let hasFormattingAnomalies = false;

    for (const block of blocks) {
      for (const word of block.words) {
        if (!word.isInteger) {
          totalNumericWords++;
          if (word.precision > maxPrecision) {
            maxPrecision = word.precision;
          }
          if (word.precision < 2 && ['X', 'Y', 'Z', 'I', 'J', 'K'].includes(word.letter)) {
            hasFormattingAnomalies = true;
          }
        }
      }
    }

    const precisionReport: NCPrecisionReport = {
      detectedDecimalPrecision: maxPrecision || 3,
      maxRoundingErrorMm: Math.pow(10, -(maxPrecision || 3)) / 2,
      angularRoundingErrorDeg: Math.pow(10, -(maxPrecision || 3)) / 2,
      totalBlocksAudited: blocks.length,
      hasFormattingAnomalies
    };

    if (hasFormattingAnomalies) {
      issues.push({
        id: `ISSUE-PRECISION-${issueCounter++}`,
        code: 'NUMERICAL_ROUNDING_VIOLATION',
        severity: 'WARNING',
        lineIndex: 0,
        message: 'Some coordinate words have low decimal precision (< 2 decimals), which may cause geometric chordal discretization error.'
      });
    }

    // 2. Controller-Specific RTCP Mode Cancellation Audit
    let rtcpActive = false;
    let rtcpActivationLine = 0;

    for (const state of states) {
      if (state.rtcpMode !== 'OFF') {
        rtcpActive = true;
        rtcpActivationLine = state.lineIndex;
      } else {
        rtcpActive = false;
      }
    }

    if (rtcpActive) {
      issues.push({
        id: `ISSUE-RTCP-${issueCounter++}`,
        code: 'INVALID_SAFETY_SEQUENCE',
        severity: 'ERROR',
        lineIndex: rtcpActivationLine,
        message: `RTCP / TCPC mode (${dialect}) remained active at program end without explicit cancellation (G49, TRAFOOF, or M129). Machine spindle head may not unclamp safely.`,
        recommendation: `Add G49 / TRAFOOF / M129 cancellation code prior to program termination.`
      });
    }

    // 3. Check Safety Initialization Block at Program Start
    if (blocks.length > 0) {
      const firstExecutable = blocks.find(b => !b.isEmpty && !b.isCommentOnly);
      if (firstExecutable) {
        const gCodes = firstExecutable.wordsMap.get('G') || [];
        const hasSafetyCodes = gCodes.some(g => [90, 21, 20, 17, 40, 49, 80, 54].includes(g));
        if (!hasSafetyCodes && !firstExecutable.rawText.includes('%')) {
          issues.push({
            id: `ISSUE-SAFETY-${issueCounter++}`,
            code: 'INVALID_SAFETY_SEQUENCE',
            severity: 'INFO',
            lineIndex: firstExecutable.lineIndex,
            sequenceNumber: firstExecutable.sequenceNumber,
            rawGCode: firstExecutable.rawText,
            message: 'Program starts without standard CNC modal safety reset block (G90 G21 G17 G40 G49 G80).'
          });
        }
      }
    }

    return { precisionReport, issues };
  }
}
