/**
 * SECP Industrial OS v2 — CAD Forensic Runner
 * PATCH-033: CAD Kernel Forensic Qualification
 */

import { ForensicCaseEvaluator } from './CADForensicCase';
import { 
  CADForensicReport, 
  CADForensicFinding, 
  CADCapabilityMatrixEntry,
  CADForensicVerdict 
} from './CADForensicTypes';

export class CADForensicRunner {
  private evaluators: ForensicCaseEvaluator[] = [];

  constructor(evaluators: ForensicCaseEvaluator[]) {
    this.evaluators = evaluators;
  }

  public async runQualification(): Promise<CADForensicReport> {
    const start = Date.now();
    const findings: CADForensicFinding[] = [];
    const matrix: Map<string, CADCapabilityMatrixEntry> = new Map();

    for (const evaluator of this.evaluators) {
      const caseStart = Date.now();
      
      try {
        const { verdict, result, observations, limitations, evidence } = await evaluator.evaluate();
        const caseEnd = Date.now();

        findings.push({
          caseId: evaluator.id,
          verdict,
          metrics: {
            executionTimeMs: caseEnd - caseStart,
          },
          evidence,
          observations,
          limitations
        });

        // Update Matrix
        this.updateMatrix(matrix, evaluator, verdict, !!evidence);

      } catch (error) {
        findings.push({
          caseId: evaluator.id,
          verdict: 'FAILED',
          metrics: { executionTimeMs: Date.now() - caseStart },
          observations: [`Exception during execution: ${error instanceof Error ? error.message : String(error)}`],
          limitations: ['Execution crashed']
        });
        
        this.updateMatrix(matrix, evaluator, 'FAILED', false);
      }
    }

    const report = this.finalizeReport(Array.from(matrix.values()), findings);
    return report;
  }

  private updateMatrix(
    matrix: Map<string, CADCapabilityMatrixEntry>, 
    evaluator: ForensicCaseEvaluator, 
    verdict: CADForensicVerdict,
    hasEvidence: boolean
  ) {
    const existing = matrix.get(evaluator.capability);
    
    // Aggregation logic for matrix
    // If one case fails, the capability might be PARTIAL or FAILED
    let implementation: 'IMPLEMENTED' | 'PARTIAL' | 'NOT_IMPLEMENTED' = 'IMPLEMENTED';
    if (verdict === 'NOT_IMPLEMENTED') implementation = 'NOT_IMPLEMENTED';
    else if (verdict === 'PARTIAL' || verdict === 'FAILED') implementation = 'PARTIAL';

    const entry: CADCapabilityMatrixEntry = {
      capability: evaluator.capability,
      implementation: implementation,
      tested: true,
      verified: verdict === 'PROVEN',
      evidence: hasEvidence,
      verdict: this.aggregateVerdict(existing?.verdict, verdict)
    };

    matrix.set(evaluator.capability, entry);
  }

  private aggregateVerdict(current: CADForensicVerdict | undefined, next: CADForensicVerdict): CADForensicVerdict {
    if (!current) return next;
    
    // Hierarchy: FAILED > INVALID > PARTIAL > UNPROVEN > PROVEN
    const weights: Record<CADForensicVerdict, number> = {
      'FAILED': 5,
      'INVALID': 4,
      'PARTIAL': 3,
      'UNPROVEN': 2,
      'PROVEN': 1,
      'NOT_IMPLEMENTED': 0
    };

    return weights[next] > weights[current] ? next : current;
  }

  private finalizeReport(matrix: CADCapabilityMatrixEntry[], findings: CADForensicFinding[]): CADForensicReport {
    const provenCount = matrix.filter(m => m.verdict === 'PROVEN').length;
    const partialCount = matrix.filter(m => m.verdict === 'PARTIAL').length;
    const unprovenCount = matrix.filter(m => m.verdict === 'UNPROVEN').length;
    const failedCount = matrix.filter(m => m.verdict === 'FAILED').length;

    let gateVerdict: 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID' = 'PASS';
    if (failedCount > 0) gateVerdict = 'FAIL';
    else if (provenCount === 0) gateVerdict = 'UNPROVEN';

    return {
      kernelVersion: '2.0.0-PATCH-033',
      timestamp: new Date().toISOString(),
      matrix,
      findings,
      summary: {
        provenCount,
        partialCount,
        unprovenCount,
        failedCount,
        totalCount: matrix.length
      },
      gateVerdict
    };
  }
}
