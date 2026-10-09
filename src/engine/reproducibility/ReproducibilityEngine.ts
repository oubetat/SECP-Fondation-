/**
 * SECP Industrial OS — EPC-012: Reproducibility Engine
 */

import { 
  ReproducibilityContract, 
  ReproducibilityRun, 
  ReproducibilityStatus, 
  EnvironmentFingerprint,
  TolerancePolicy,
  ComparisonResult
} from './ReproducibilityTypes';
import { EnvironmentFingerprintService } from './EnvironmentFingerprintService';
import { ReproducibilityComparator } from './ReproducibilityComparator';
import { EvidenceIntegrityService } from '../epc/evidence/EvidenceIntegrityService';
import { SimulationScenario } from '../simulation/SimulationScenarioTypes';

export class ReproducibilityEngine {
  private contracts: Map<string, ReproducibilityContract> = new Map();
  private runs: Map<string, ReproducibilityRun[]> = new Map();

  /**
   * Initializes a Reproducibility Contract and freezes inputs.
   */
  public createContract(
    workflowId: string,
    caseId: string,
    scenario: SimulationScenario,
    tolerancePolicy: Record<string, TolerancePolicy>,
    deterministicMode: boolean
  ): ReproducibilityContract {
    const inputHash = this.computeInputHash(scenario);
    const env = EnvironmentFingerprintService.capture(scenario.solver.version);
    
    const contract: ReproducibilityContract = {
      contractId: `REPRO-CON-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      workflowId,
      caseId,
      baselineId: scenario.id,
      modelId: scenario.geometry.modelId,
      solverId: scenario.solver.solverId,
      solverVersion: scenario.solver.version,
      meshId: scenario.mesh.meshId,
      parameterSetId: scenario.id,
      inputHash,
      configurationHash: scenario.solver.configurationHash,
      executionEnvironmentHash: env.hash,
      deterministicMode,
      tolerancePolicy,
      referenceResultId: '', // To be filled by Reference Run
      status: ReproducibilityStatus.INCONCLUSIVE,
      createdAt: new Date().toISOString()
    };

    this.contracts.set(contract.contractId, contract);
    return contract;
  }

  /**
   * Computes a combined hash for all critical engineering inputs.
   */
  private computeInputHash(scenario: SimulationScenario): string {
    const inputData = {
      geometry: scenario.geometry.hash,
      material: scenario.material.propertiesHash,
      mesh: scenario.mesh.hash,
      parameters: scenario.parameters.map(p => ({ id: p.id, value: p.value })),
      loads: scenario.loads,
      boundaryConditions: scenario.boundaryConditions
    };
    return EvidenceIntegrityService.computeHash(inputData);
  }

  /**
   * Starts a Reproducibility Run.
   */
  public startRun(contractId: string, scenario: SimulationScenario): ReproducibilityRun {
    const contract = this.contracts.get(contractId);
    if (!contract) throw new Error('Contract not found');

    const env = EnvironmentFingerprintService.capture(scenario.solver.version);
    const inputHash = this.computeInputHash(scenario);

    const run: ReproducibilityRun = {
      runId: `REPRO-RUN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      workflowId: contract.workflowId,
      contractId: contract.contractId,
      startedAt: new Date().toISOString(),
      inputHash,
      configurationHash: scenario.solver.configurationHash,
      environmentHash: env.hash,
      solverVersion: scenario.solver.version,
      status: ReproducibilityStatus.INCONCLUSIVE
    };

    const history = this.runs.get(contractId) || [];
    history.push(run);
    this.runs.set(contractId, history);

    return run;
  }

  /**
   * Completes a run and updates contract if it was a reference run.
   */
  public completeRun(
    runId: string, 
    results: Record<string, any>, 
    isReference: boolean = false
  ): void {
    let targetRun: ReproducibilityRun | undefined;
    let targetContract: ReproducibilityContract | undefined;

    for (const [cid, history] of this.runs.entries()) {
      targetRun = history.find(r => r.runId === runId);
      if (targetRun) {
        targetContract = this.contracts.get(cid);
        break;
      }
    }

    if (!targetRun || !targetContract) throw new Error('Run or Contract not found');

    targetRun.completedAt = new Date().toISOString();
    targetRun.resultHash = EvidenceIntegrityService.computeHash(results);

    if (isReference) {
      if (targetContract.referenceResultId) throw new Error('Reference already established');
      targetContract.referenceResultId = runId;
      targetContract.status = ReproducibilityStatus.PASS; // Baseline established
      targetRun.status = ReproducibilityStatus.PASS;
      // Store results in a mock way or actual storage
      (targetContract as any).referenceResults = results; 
    } else {
      // Comparison Run
      const refResults = (targetContract as any).referenceResults;
      if (!refResults) {
        targetRun.status = ReproducibilityStatus.INCONCLUSIVE;
        targetRun.failureReason = 'Reference results missing';
        return;
      }

      // Check for Input/Config/Env shifts
      if (targetRun.inputHash !== targetContract.inputHash) {
        targetRun.status = ReproducibilityStatus.BASELINE_CHANGED;
        targetRun.failureReason = 'Input hash mismatch';
        return;
      }

      const comparison = ReproducibilityComparator.compare(
        refResults,
        results,
        targetContract.tolerancePolicy
      );

      targetRun.status = comparison.overallStatus;
      if (comparison.overallStatus === ReproducibilityStatus.FAIL) {
        targetRun.failureReason = comparison.violations.join('; ');
      }
      (targetRun as any).comparisonResult = comparison;
    }
  }

  public getContract(id: string): ReproducibilityContract | undefined {
    return this.contracts.get(id);
  }

  public getRuns(contractId: string): ReproducibilityRun[] {
    return this.runs.get(contractId) || [];
  }
}
