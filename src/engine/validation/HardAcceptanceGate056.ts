/**
 * SECP Industrial OS v3 — PROMPT-056: Hard Acceptance Gate 056
 * Production Gate for Tool-by-Tool End-to-End Engineering Qualification.
 * Validates complete 8-stage lifecycle (Create -> Modify -> Regenerate -> Undo -> Redo -> Save -> Reload -> Verify)
 * for all engineering tools with zero false passes.
 */

import { createHash } from 'crypto';
import { ToolNegativeProofs } from '../tool-qualification/ToolNegativeProofs';
import { ToolPositiveProofs } from '../tool-qualification/ToolPositiveProofs';
import { ToolE2EQualificationEngine } from '../tool-qualification/ToolE2EQualificationEngine';
import { Gate056Report, ToolQualificationRecord } from '../tool-qualification/ToolQualificationTypes';

export class HardAcceptanceGate056 {
  private static readonly MASTER_TOOL_LIST = [
    'FEATURE_EXTRUDE',
    'FEATURE_REVOLVE',
    'FEATURE_SWEEP',
    'FEATURE_LOFT',
    'FEATURE_HOLE',
    'FEATURE_THREAD',
    'FEATURE_DRAFT',
    'FEATURE_SHELL',
    'FEATURE_RIB',
    'FEATURE_THIN',
    'SKETCH_LINE',
    'SKETCH_CIRCLE',
    'ASSEMBLY_MATE_COINCIDENT',
    'FEATURE_FILLET',
    'MOLD_TOOLING_SPLIT'
  ];

  /**
   * Executes complete Gate 056 evaluation.
   */
  public static async executeGate(): Promise<Gate056Report> {
    const timestamp = new Date().toISOString();
    const criticalFailures: string[] = [];

    // 1. Negative Proofs Execution (TP-NEG-001 ... TP-NEG-024)
    const negProofsResult = await ToolNegativeProofs.executeAllNegativeProofs();
    if (!negProofsResult.allPassed) {
      criticalFailures.push(`Negative proofs failed: ${negProofsResult.passCount}/${negProofsResult.totalCount} passed`);
    }

    // 2. Positive Proofs Execution (TP-POS-001 ... TP-POS-008)
    const posProofsResult = await ToolPositiveProofs.executeAllPositiveProofs();
    if (!posProofsResult.allPassed) {
      criticalFailures.push(`Positive proofs failed: ${posProofsResult.passCount}/${posProofsResult.totalCount} passed`);
    }

    // 3. Tool-by-Tool Qualification Matrix Execution
    const matrix: ToolQualificationRecord[] = [];
    for (const toolId of this.MASTER_TOOL_LIST) {
      const record = await ToolE2EQualificationEngine.qualifyTool(toolId);
      matrix.push(record);
      if (record.isSupported && record.finalVerdict === 'FAIL') {
        criticalFailures.push(`Supported tool '${toolId}' failed E2E qualification.`);
      }
    }

    // Evaluate passed count and verdict
    const totalProofs = negProofsResult.totalCount + posProofsResult.totalCount;
    const passedProofs = negProofsResult.passCount + posProofsResult.passCount;
    const passedCount = passedProofs;
    const totalCount = totalProofs;
    const score = Math.round((passedCount / totalCount) * 100);

    const verdict = (negProofsResult.allPassed && posProofsResult.allPassed && criticalFailures.length === 0)
      ? 'PASS'
      : 'FAIL';

    // Cryptographic signatures
    const proofSignatures = [...negProofsResult.results, ...posProofsResult.results]
      .map(p => `${p.proofId}:${p.passed}`)
      .join('|');
    const matrixSignatures = matrix.map(m => `${m.toolId}:${m.finalVerdict}`).join('|');
    const merkleRoot = createHash('sha256').update(proofSignatures + matrixSignatures + timestamp).digest('hex');
    const signaturePayload = `GATE-SECP-056:${verdict}:${score}:${merkleRoot}:${timestamp}`;
    const cryptographicSignature = `0x${createHash('sha256').update(signaturePayload).digest('hex')}`;

    return {
      gateId: 'GATE-SECP-056',
      promptId: 'PROMPT-056',
      title: 'Tool-by-Tool End-to-End Engineering Qualification Gate',
      timestamp,
      verdict,
      passedCount,
      totalCount,
      score,
      matrix,
      negativeProofs: negProofsResult.results,
      positiveProofs: posProofsResult.results,
      criticalFailuresDetected: criticalFailures,
      cryptographicSignature,
      provenanceLedgerEntry: {
        ledgerIndex: 56,
        parentGate: 'GATE-SECP-055',
        merkleRoot
      }
    };
  }

  public static async runGateVerification(): Promise<{ passed: boolean; gateId: string; report: Gate056Report }> {
    const report = await this.executeGate();
    return {
      passed: report.verdict === 'PASS',
      gateId: report.gateId,
      report
    };
  }
}
