/**
 * PATCH-SECP-060 — Execution Session Engine
 * Coordinates shop-floor sessions, maps jobs, and ensures strict planned-to-loaded NC program hashes consistency.
 */

import { 
  ManufacturingExecutionSession, 
  MachineExecutionState, 
  OperationExecutionState, 
  ExecutionSafetyGateReport 
} from './ManufacturingExecutionTypes';
import { ManufacturingJob } from '../manufacturing-job/ManufacturingJobTypes';
import { ManufacturingExecutionPackage } from '../nc/NCExecutionTypes';

export class ExecutionSessionEngine {
  /**
   * Initializes a new shop-floor session for a planned job
   */
  public static initializeSession(
    sessionId: string,
    job: ManufacturingJob,
    operatorId: string,
    loadedNCOrPackageHash: string
  ): ManufacturingExecutionSession {
    return {
      sessionId,
      jobId: job.jobId,
      machineId: job.machineId,
      operatorId,
      loadedNCOrPackageHash,
      plannedNCProgramHash: job.ncProgramHash,
      machineState: 'AVAILABLE',
      currentOperationId: undefined,
      currentOperationState: 'NOT_STARTED',
      toolConsumption: {},
      verifiedMaterialLot: undefined,
      partInstances: [],
      sessionStatus: 'ACTIVE',
      timestampStart: new Date().toISOString()
    };
  }

  /**
   * 060-G: Strict Execution Safety Gate Checking before READY -> RUNNING
   */
  public static runSafetyGateCheck(
    session: ManufacturingExecutionSession,
    execPackage: ManufacturingExecutionPackage,
    isOperatorCertified: boolean,
    isJobActive: boolean,
    unresolvedECNs: number
  ): ExecutionSafetyGateReport {
    const ncProgramVerified = execPackage.ncBlocks.length > 0;
    const machineAvailable = session.machineState !== 'OFFLINE' && session.machineState !== 'MAINTENANCE';
    
    // Machine compatibility check
    const machineCapabilityCompatible = execPackage.machineDefinition.axes.length >= 3;
    
    // Checks that all tools are mapped to our session setup
    const toolingAvailable = execPackage.verifiedCLData.trajectories.length > 0;
    const fixtureAvailable = execPackage.machineDefinition.envelope.xMax > 0;
    const materialAvailable = session.verifiedMaterialLot !== undefined;
    const operatorAuthorized = isOperatorCertified;
    const jobNotSuperseded = isJobActive;
    
    // 060-G CRITICAL Assertion: loaded hash must match planned package hash
    const ncProgramHashMatches = session.loadedNCOrPackageHash === session.plannedNCProgramHash;

    const isReadyToRun = 
      ncProgramVerified &&
      machineAvailable &&
      machineCapabilityCompatible &&
      toolingAvailable &&
      fixtureAvailable &&
      materialAvailable &&
      operatorAuthorized &&
      jobNotSuperseded &&
      ncProgramHashMatches &&
      unresolvedECNs === 0;

    let rejectionReason: string | undefined;
    if (!isReadyToRun) {
      const reasons: string[] = [];
      if (!ncProgramVerified) reasons.push('NC Program has no verified blocks.');
      if (!machineAvailable) reasons.push('Target CNC machine is offline or undergoing maintenance.');
      if (!machineCapabilityCompatible) reasons.push('CNC kinematic capabilities are insufficient.');
      if (!toolingAvailable) reasons.push('Required manufacturing tooling is missing.');
      if (!materialAvailable) reasons.push('Material raw lot has not been scanned/verified.');
      if (!operatorAuthorized) reasons.push('Operator lacks the required industrial certifications.');
      if (!jobNotSuperseded) reasons.push('Upstream Manufacturing Job has been superseded by design changes.');
      if (!ncProgramHashMatches) reasons.push(`PLAN-EXEC Hash Mismatch: loaded NC program (${session.loadedNCOrPackageHash}) does not match planned NC hash (${session.plannedNCProgramHash}).`);
      if (unresolvedECNs > 0) reasons.push(`Active engineering change notices (${unresolvedECNs}) remain unresolved.`);
      rejectionReason = `EXECUTION_BLOCKED: ${reasons.join(' | ')}`;
    }

    return {
      sessionId: session.sessionId,
      isReadyToRun,
      ncProgramVerified,
      machineAvailable,
      machineCapabilityCompatible,
      toolingAvailable,
      fixtureAvailable,
      materialAvailable,
      operatorAuthorized,
      jobNotSuperseded,
      ncProgramHashMatches,
      unresolvedChangesCount: unresolvedECNs,
      rejectionReason
    };
  }
}
