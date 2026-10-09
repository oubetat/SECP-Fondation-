/**
 * PATCH-SECP-066: Maintenance Closure Engine
 * Sealed work orders only after successful verification.
 */

import { MaintenanceClosureRecord, MaintenanceDecision, VerificationResult } from './MaintenanceGovernanceTypes';

export class MaintenanceClosureEngine {
  public static closeWorkOrder(
    workOrderId: string,
    verificationId: string,
    vResult: VerificationResult,
    closerId: string
  ): MaintenanceClosureRecord {
    if (vResult === 'FAILED' || vResult === 'REQUIRES_REWORK') {
      throw new Error('Closure BLOCKED: Verification did not pass.');
    }

    const decision: MaintenanceDecision = vResult === 'PASSED' ? 'CONTINUE_OPERATION' : 'MONITOR';

    return {
      closureId: `close-${workOrderId}`,
      workOrderId,
      verificationId,
      decision,
      residualRisk: vResult === 'CONDITIONAL' ? 'MINOR_TELEMETRY_NOISE' : 'NONE',
      closedBy: closerId,
      timestamp: new Date().toISOString()
    };
  }
}
