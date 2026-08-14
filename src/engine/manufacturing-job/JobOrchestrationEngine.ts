/**
 * PATCH-SECP-059 — Job Orchestration Engine
 * Creates production jobs, assigns routing sequences, manages state machine transitions,
 * reserves shopfloor resources, and executes change impact reporting.
 */

import { 
  ManufacturingJob, 
  RoutingOperation, 
  ResourceRequirements, 
  JobStatus, 
  ResourceAvailability, 
  JobChangeImpactReport, 
  ProductionReadinessReport 
} from './ManufacturingJobTypes';
import { ManufacturingExecutionPackage } from '../nc/NCExecutionTypes';
import { NCExecutionBridge } from '../nc/NCExecutionBridge';

export class JobOrchestrationEngine {
  /**
   * 059-A: Generates deterministic provenance hash for a Manufacturing Job
   */
  public static computeJobHash(job: Omit<ManufacturingJob, 'provenanceHash'>): string {
    const payload = JSON.stringify({
      jobId: job.jobId,
      partId: job.partId,
      partRevision: job.partRevision,
      executionPackageId: job.executionPackageId,
      ncProgramHash: job.ncProgramHash,
      machineId: job.machineId,
      materialType: job.materialType,
      quantityOrdered: job.quantityOrdered,
      routing: job.routing.map(r => ({ seq: r.sequenceNumber, name: r.name, res: r.resources }))
    });

    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `SECP-059-JOB-HASH-${hex}`;
  }

  /**
   * 059-B & 059-C: Generates default industrial standard operations routing for a CNC machined part
   */
  public static createStandardRouting(
    machineId: string,
    toolIds: string[],
    materialType: string
  ): RoutingOperation[] {
    const routing: RoutingOperation[] = [
      {
        operationId: 'op-10-saw',
        sequenceNumber: 10,
        name: 'OP10: Sawing Raw Stock Material',
        workCenterId: 'wc-raw-saw',
        estimatedSetupTimeMin: 15,
        estimatedRunTimePerUnitMin: 3.5,
        resources: {
          machineId: 'mch-horizontal-bandsaw',
          requiredCapabilities: [],
          toolIds: ['tool-saw-blade-01'],
          fixtureId: 'fix-saw-vise',
          materialType,
          requiredOperatorQualification: 'APPRENTICE',
          requiresCMMInspection: false
        },
        dependencyOperationIds: []
      },
      {
        operationId: 'op-20-rough-mill',
        sequenceNumber: 20,
        name: 'OP20: 3-Axis Rough Face Machining',
        workCenterId: 'wc-cnc-mill',
        estimatedSetupTimeMin: 30,
        estimatedRunTimePerUnitMin: 12.0,
        resources: {
          machineId,
          requiredCapabilities: ['THREE_AXIS_MILLING'],
          toolIds: [toolIds[0] || 'tool-endmill-12'],
          fixtureId: 'fix-hydraulic-vise',
          materialType,
          requiredOperatorQualification: 'JOURNEYMAN',
          requiresCMMInspection: false
        },
        dependencyOperationIds: ['op-10-saw']
      },
      {
        operationId: 'op-30-finish-mill',
        sequenceNumber: 30,
        name: 'OP30: 5-Axis Multi-Sided Finish Contouring',
        workCenterId: 'wc-cnc-5axis',
        estimatedSetupTimeMin: 45,
        estimatedRunTimePerUnitMin: 18.5,
        resources: {
          machineId,
          requiredCapabilities: ['THREE_AXIS_MILLING', 'FIVE_AXIS_MILLING'],
          toolIds: [toolIds[1] || 'tool-ball-08'],
          fixtureId: 'fix-rotary-platter',
          materialType,
          requiredOperatorQualification: 'MASTER',
          requiresCMMInspection: false
        },
        dependencyOperationIds: ['op-20-rough-mill']
      },
      {
        operationId: 'op-40-drill',
        sequenceNumber: 40,
        name: 'OP40: Peck Drilling Holes & Tapping',
        workCenterId: 'wc-cnc-mill',
        estimatedSetupTimeMin: 15,
        estimatedRunTimePerUnitMin: 4.2,
        resources: {
          machineId,
          requiredCapabilities: ['PECK_DRILLING', 'RIGID_TAPPING'],
          toolIds: [toolIds[2] || 'tool-drill-08'],
          fixtureId: 'fix-hydraulic-vise',
          materialType,
          requiredOperatorQualification: 'JOURNEYMAN',
          requiresCMMInspection: false
        },
        dependencyOperationIds: ['op-30-finish-mill']
      },
      {
        operationId: 'op-50-inspection',
        sequenceNumber: 50,
        name: 'OP50: Metrology & Final CMM Inspection',
        workCenterId: 'wc-metrology-lab',
        estimatedSetupTimeMin: 10,
        estimatedRunTimePerUnitMin: 5.0,
        resources: {
          machineId: 'mch-zeiss-cmm',
          requiredCapabilities: [],
          toolIds: ['tool-cmm-probe-ruby'],
          fixtureId: 'fix-cmm-clamping-kit',
          materialType,
          requiredOperatorQualification: 'JOURNEYMAN',
          requiresCMMInspection: true
        },
        dependencyOperationIds: ['op-40-drill']
      }
    ];

    return routing;
  }

  /**
   * 059-A: Factory helper to instantiate a new Manufacturing Job
   */
  public static createJob(
    jobId: string,
    partId: string,
    quantity: number,
    execPackage: ManufacturingExecutionPackage,
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM'
  ): ManufacturingJob {
    const clPkg = execPackage.verifiedCLData;
    const toolIds = clPkg.trajectories.map(t => t.tool.toolId);
    const materialType = 'AL-6061-T6';
    const routing = this.createStandardRouting(execPackage.machineDefinition.machineId, toolIds, materialType);

    const tempJob: Omit<ManufacturingJob, 'provenanceHash'> = {
      jobId,
      partId,
      partRevision: execPackage.revisionId,
      executionPackageId: execPackage.packageId,
      ncProgramHash: execPackage.ncProgramHash,
      machineId: execPackage.machineDefinition.machineId,
      materialType,
      quantityOrdered: quantity,
      quantityCompleted: 0,
      priority,
      status: 'PLANNED',
      routing,
      timestamp: new Date().toISOString()
    };

    return {
      ...tempJob,
      provenanceHash: this.computeJobHash(tempJob)
    };
  }

  /**
   * 059-E: Finite State Machine transition engine.
   * Ensures invalid state shifts (e.g. COMPLETED directly back to READY or PLANNED) are rejected.
   */
  public static validateStateTransition(current: JobStatus, target: JobStatus): { valid: boolean; error?: string } {
    const allowedTransitions: Record<JobStatus, JobStatus[]> = {
      PLANNED: ['READY', 'CANCELLED', 'HOLD'],
      READY: ['QUEUED', 'BLOCKED', 'HOLD', 'CANCELLED'],
      QUEUED: ['DISPATCHED', 'BLOCKED', 'HOLD', 'CANCELLED'],
      DISPATCHED: ['IN_PROGRESS', 'BLOCKED', 'HOLD', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'FAILED', 'BLOCKED', 'HOLD', 'CANCELLED'],
      COMPLETED: [], // Terminal normal
      BLOCKED: ['READY', 'QUEUED', 'CANCELLED', 'HOLD'],
      HOLD: ['READY', 'QUEUED', 'CANCELLED'],
      FAILED: ['PLANNED', 'CANCELLED'], // Can re-plan a failed job
      CANCELLED: [] // Terminal cancel
    };

    const targets = allowedTransitions[current] || [];
    if (targets.includes(target)) {
      return { valid: true };
    }
    return {
      valid: false,
      error: `Invalid Job transition from State '${current}' to '${target}'. Allowed transitions: [${targets.join(', ')}]`
    };
  }

  /**
   * 059-F: Material / Tool / Fixture Reservations validation
   */
  public static verifyReservations(
    job: ManufacturingJob,
    inventory: ResourceAvailability[]
  ): { allSatisfied: boolean; missingResourceIds: string[] } {
    const missing: string[] = [];

    // Flatten all required resource IDs from routing operations
    job.routing.forEach(op => {
      const res = op.resources;

      // 1. Machine availability check
      const machineOk = inventory.find(i => i.resourceId === res.machineId && i.type === 'MACHINE' && i.isAvailable);
      if (!machineOk) {
        missing.push(res.machineId);
      }

      // 2. Tool availability check
      res.toolIds.forEach(tId => {
        const toolOk = inventory.find(i => i.resourceId === tId && i.type === 'TOOL' && i.isAvailable);
        if (!toolOk) {
          missing.push(tId);
        }
      });

      // 3. Fixture availability check
      if (res.fixtureId) {
        const fixtureOk = inventory.find(i => i.resourceId === res.fixtureId && i.type === 'FIXTURE' && i.isAvailable);
        if (!fixtureOk) {
          missing.push(res.fixtureId);
        }
      }

      // 4. Material stock check
      if (res.materialType) {
        const materialOk = inventory.find(
          i => i.resourceId === res.materialType && i.type === 'MATERIAL' && i.isAvailable && (i.quantityOnHand || 0) >= job.quantityOrdered
        );
        if (!materialOk) {
          missing.push(res.materialType);
        }
      }
    });

    const uniqueMissing = Array.from(new Set(missing));
    return {
      allSatisfied: uniqueMissing.length === 0,
      missingResourceIds: uniqueMissing
    };
  }

  /**
   * 059-H: Job Change Impact Analyzer using SECP-058 packages
   */
  public static analyzeJobChangeImpact(
    job: ManufacturingJob,
    oldPkg: ManufacturingExecutionPackage,
    newPkg: ManufacturingExecutionPackage
  ): JobChangeImpactReport {
    // Leverage NC change analyzer directly
    const ncImpact = NCExecutionBridge.analyzeChangeImpact(oldPkg, newPkg);

    const isNCPackageModified = oldPkg.executionPackageHash !== newPkg.executionPackageHash;
    const isMachineIdModified = oldPkg.machineDefinition.machineId !== newPkg.machineDefinition.machineId;
    const isTopologyModified = ncImpact.isTopologyChanged;

    let actionRequired: 'NONE' | 'REVIEW_SCHEDULE' | 'REVALIDATE_MACHINE' | 'REPLAN_JOB' | 'FULL_REGENERATION' = 'NONE';
    let description = 'Upstream execution packages are identical. Job schedule remains safe and valid.';

    if (isTopologyModified) {
      actionRequired = 'FULL_REGENERATION';
      description = 'CRITICAL: Upstream B-Rep topology has been altered. This job must be completely halted, toolpaths regenerated, and execution package rebuilt.';
    } else if (isMachineIdModified) {
      actionRequired = 'REVALIDATE_MACHINE';
      description = 'HIGH: Target machine changed. The routing steps and machine assignments must be revalidated against new axis constraints.';
    } else if (isNCPackageModified) {
      actionRequired = 'REVIEW_SCHEDULE';
      description = 'MEDIUM: G-code block hash shifted. Program content requires quick dispatch review; scheduling priority checked.';
    }

    return {
      jobId: job.jobId,
      oldNCOrPackageHash: oldPkg.executionPackageHash,
      newNCOrPackageHash: newPkg.executionPackageHash,
      isNCPackageModified,
      isMachineIdModified,
      isTopologyModified,
      actionRequired,
      description
    };
  }

  /**
   * 059-I: Integrated Production Readiness Gate Checker
   * Extends SECP-058 design gate checkpoints into planning, routing, scheduling, and resource clearance
   */
  public static checkProductionReadiness(
    job: ManufacturingJob,
    execPackage: ManufacturingExecutionPackage,
    isScheduleValid: boolean,
    inventory: ResourceAvailability[]
  ): ProductionReadinessReport {
    // 1. Retrieve engineering gates directly from SECP-058 readiness bridge
    const engReadiness = NCExecutionBridge.checkExecutionReadiness(execPackage);

    const gateStateReport: Record<string, 'PASS' | 'FAIL'> = {};

    gateStateReport.designValid = engReadiness.designValid ? 'PASS' : 'FAIL';
    gateStateReport.manufacturable = engReadiness.manufacturable ? 'PASS' : 'FAIL';
    gateStateReport.toolpathVerified = engReadiness.toolpathVerified ? 'PASS' : 'FAIL';
    gateStateReport.ncVerified = engReadiness.ncVerified ? 'PASS' : 'FAIL';

    // 2. Resource availability check (059-F)
    const reservationReport = this.verifyReservations(job, inventory);
    gateStateReport.resourcesAvailable = reservationReport.allSatisfied ? 'PASS' : 'FAIL';

    // 3. Routing sequence validation (OP10 must come before OP20, dependencies must have sequencing integrity)
    let routingValid = true;
    job.routing.forEach(op => {
      op.dependencyOperationIds.forEach(depId => {
        const depOp = job.routing.find(r => r.operationId === depId);
        if (depOp && depOp.sequenceNumber >= op.sequenceNumber) {
          routingValid = false; // Cyclic or sequence inversion violation
        }
      });
    });
    gateStateReport.routingValid = routingValid && job.routing.length > 0 ? 'PASS' : 'FAIL';

    // 4. Production scheduling checks (059-D)
    gateStateReport.scheduleValid = isScheduleValid ? 'PASS' : 'FAIL';

    const isProductionReady = Object.values(gateStateReport).every(v => v === 'PASS');
    gateStateReport.productionReady = isProductionReady ? 'PASS' : 'FAIL';

    return {
      jobId: job.jobId,
      designValid: engReadiness.designValid,
      manufacturable: engReadiness.manufacturable,
      toolpathVerified: engReadiness.toolpathVerified,
      ncVerified: engReadiness.ncVerified,
      resourcesAvailable: reservationReport.allSatisfied,
      routingValid,
      scheduleValid: isScheduleValid,
      isProductionReady,
      gateStateReport
    };
  }
}
