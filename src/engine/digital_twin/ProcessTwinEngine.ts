import { EvidenceBus314, EvidenceRecord } from '../engineering_ai/copilot/EvidenceBus314';

// ============================================================================
// 1. Core Interfaces & Types (PATCH-328)
// ============================================================================

export type ProcessType = 'MILLING' | 'TURNING' | 'DRILLING' | 'BORING' | 'GRINDING' | 'ADDITIVE' | 'INSPECTION' | 'ASSEMBLY' | 'HEAT_TREATMENT' | 'CUSTOM';

export type ProcessLifecycleState = 
  | 'DEFINED'
  | 'PLANNED'
  | 'APPROVED'
  | 'READY'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'ABORTED'
  | 'REWORK'
  | 'CANCELLED'
  | 'UNKNOWN';

export type ParameterProvenance = 
  | 'DESIGN'
  | 'CAM'
  | 'ENGINEERING_STANDARD'
  | 'MACHINE_CONFIGURATION'
  | 'OPERATOR'
  | 'MEASURED'
  | 'OPTIMIZED'
  | 'AI_PROPOSED'
  | 'UNKNOWN';

export type ProcessDataQuality = 'VALID' | 'INVALID' | 'MISSING' | 'STALE' | 'ESTIMATED' | 'UNKNOWN';

export type ProcessQualityState = 'PASS' | 'FAIL' | 'WARNING' | 'REWORK' | 'SCRAP' | 'UNKNOWN';

export type ProcessStabilityType = 'STABLE' | 'DRIFTING' | 'UNSTABLE' | 'UNKNOWN';

export type FaultType = 
  | 'MachineFault'
  | 'ToolFault'
  | 'MaterialFault'
  | 'ParameterFault'
  | 'ProcessSequenceFault'
  | 'QualityFault'
  | 'UnknownFault';

export type ProcessEventCategory =
  | 'PROCESS_CREATED'
  | 'PROCESS_REVISED'
  | 'PROCESS_APPROVED'
  | 'PROCESS_STARTED'
  | 'PROCESS_PAUSED'
  | 'PROCESS_RESUMED'
  | 'PROCESS_COMPLETED'
  | 'PROCESS_FAILED'
  | 'OPERATION_STARTED'
  | 'OPERATION_COMPLETED'
  | 'TOOL_CHANGED'
  | 'PARAMETER_CHANGED'
  | 'MACHINE_CHANGED'
  | 'ALARM_OCCURRED'
  | 'QUALITY_RESULT_RECORDED';

// ============================================================================
// 2. Struct Definitions
// ============================================================================

export interface ProcessTwin {
  processTwinId: string;
  processId: string;
  partId: string;
  partRevision: string;
  processRevision: string;
  processType: ProcessType;
  lifecycleState: ProcessLifecycleState;
  plantId: string;
  productionLineId: string;
}

export interface ProcessRevision {
  processRevisionId: string;
  processId: string;
  revisionNumber: string;
  previousRevision?: string;
  changeDescription: string;
  author: string;
  timestamp: string;
  approvalState: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  evidenceId?: string;
}

export interface ProcessDefinition {
  processId: string;
  inputs: string[];
  outputs: string[];
  operations: string[];
  resources: string[];
  parameters: string[];
  constraints: string[];
  qualityRequirements: string[];
}

export interface OperationIdentity {
  operationId: string;
  operationNumber: string; // e.g. "OP10", "OP20"
  operationType: ProcessType;
  sequence: number;
  revision: string;
  dependencies: string[]; // List of prior OperationIds
}

export interface MaterialTraceability {
  materialId: string;
  lotNumber: string;
  revision: string;
  source: string;
  rawMaterialLot: string;
}

export interface MachineBinding {
  machineId: string;
  machineRevision: string;
  configurationRevision: string;
  kinematicRevision: string;
  controllerRevision: string;
}

export interface ToolBinding {
  toolId: string;
  toolRevision: string;
  toolAssembly: string;
  toolOffset: {
    xOffsetMm: number;
    zOffsetMm: number;
    radiusMm: number;
  };
}

export interface FixtureBinding {
  fixtureId: string;
  fixtureRevision: string;
  fixtureConfiguration: string;
}

export interface NCProgramBinding {
  ncProgramId: string;
  ncProgramRevision: string;
  postProcessorRevision: string;
}

export interface ProcessParameter {
  name: 'SpindleSpeed' | 'FeedRate' | 'DepthOfCut' | 'StepOver' | 'CoolantState' | 'CuttingDirection' | 'ToolOrientation' | string;
  targetValue: number;
  actualValue?: number;
  unit: string;
  provenance: ParameterProvenance;
  lastUpdated: string;
  isAiProposedAndVerified: boolean;
}

export interface ProcessConstraints {
  machineLimits: { maxRpm: number; maxFeed: number };
  toolLimits: { maxDepthOfCutMm: number; maxWearMm: number };
  materialLimits: { maxHardnessBhn: number };
  qualityLimits: { surfaceRoughnessRaMicrons: number };
  geometricConstraints: { clearanceHeightMm: number };
  thermalLimits: { maxSpindleTempC: number };
  safetyConstraints: { doorClosedRequired: boolean };
}

export interface ProcessWindow {
  parameterName: string;
  minimum: number;
  target: number;
  maximum: number;
}

export interface ProcessFault {
  faultId: string;
  faultType: FaultType;
  description: string;
  severity: 'WARNING' | 'CRITICAL' | 'EMERGENCY_STOP';
  timestamp: string;
  associatedEventId?: string;
  associatedParameter?: string;
  associatedMachineId?: string;
  associatedToolId?: string;
  associatedOperationId?: string;
  evidenceId?: string;
}

export interface InspectionResult {
  inspectionId: string;
  measurement: number;
  unit: string;
  tolerance: { min: number; max: number };
  instrument: string;
  timestamp: string;
  partRevision: string;
  processRevision: string;
  outcome: ProcessQualityState;
  defectCategory?: string;
}

export interface ProcessEvent {
  eventId: string;
  processTwinId: string;
  category: ProcessEventCategory;
  timestamp: string;
  description: string;
  operationId?: string;
  evidenceId?: string;
}

export interface ProcessTelemetryReading {
  processExecutionId: string;
  operationId: string;
  timestamp: string;
  source: 'SPINDLE' | 'COOLANT' | 'AXIS_DRIVE' | 'ENVIRONMENTAL';
  parameterName: string;
  value: number;
  unit: string;
  quality: ProcessDataQuality;
}

// Variant representation
export interface ProcessVariant {
  processVariantId: string;
  parentProcessId: string;
  revision: string;
  status: 'DRAFT' | 'SIMULATED' | 'QUALIFIED' | 'PRODUCTION';
  cycleTimeMinutes: number;
  costEstimateUSD: number;
  energyKwh: number;
  toolLifePartCount: number;
  riskScore: number; // 1-100
  evidenceId?: string;
}

// Snapshot at T1, T2 etc
export interface ProcessTwinSnapshot {
  timestamp: string;
  processRevision: string;
  operationId: string;
  machineState: {
    status: string;
    temperatureC: number;
    overridePercent: number;
  };
  toolState: {
    toolId: string;
    toolWearMm: number;
  };
  parameters: Record<string, number>;
  executionState: string;
  qualityState: ProcessQualityState;
  telemetryState: Record<string, { value: number; quality: ProcessDataQuality }>;
}

// Execution Package
export interface ProcessExecutionPackage {
  partId: string;
  partRevision: string;
  processRevision: string;
  machineRevision: string;
  toolConfigurationId: string;
  fixtureConfigurationId: string;
  ncProgramRevision: string;
  parameters: Record<string, number>;
  executionId: string;
  telemetry: ProcessTelemetryReading[];
  inspection: InspectionResult[];
  evidenceIds: string[];
}

// ============================================================================
// 3. Helper Classes and Logic Engines
// ============================================================================

export class ProcessTwinStateTransitions {
  private static allowedTransitions: Record<ProcessLifecycleState, ProcessLifecycleState[]> = {
    'DEFINED': ['PLANNED', 'CANCELLED'],
    'PLANNED': ['APPROVED', 'CANCELLED'],
    'APPROVED': ['READY', 'REWORK', 'CANCELLED'],
    'READY': ['RUNNING', 'CANCELLED'],
    'RUNNING': ['PAUSED', 'COMPLETED', 'FAILED', 'ABORTED'],
    'PAUSED': ['RUNNING', 'ABORTED'],
    'COMPLETED': ['APPROVED', 'REWORK', 'CANCELLED'],
    'FAILED': ['REWORK', 'ABORTED'],
    'ABORTED': ['REWORK', 'CANCELLED'],
    'REWORK': ['DEFINED', 'PLANNED', 'READY'],
    'CANCELLED': ['DEFINED'],
    'UNKNOWN': ['DEFINED']
  };

  public static isValidTransition(from: ProcessLifecycleState, to: ProcessLifecycleState): boolean {
    const targets = this.allowedTransitions[from];
    return targets ? targets.includes(to) : false;
  }
}

export class ProcessFeasibilityChecker {
  public static verifyFeasibility(
    definition: ProcessDefinition,
    bindings: {
      machine: MachineBinding;
      tool: ToolBinding;
      fixture: FixtureBinding;
      nc: NCProgramBinding;
    },
    parameters: Record<string, number>,
    constraints: ProcessConstraints
  ): { feasible: boolean; score: number; reports: string[] } {
    const reports: string[] = [];
    let feasible = true;
    let score = 100;

    // 1. Verify Machine Binding Limits
    if (parameters['SpindleSpeed'] && parameters['SpindleSpeed'] > constraints.machineLimits.maxRpm) {
      feasible = false;
      score -= 25;
      reports.push(`FAIL: SpindleSpeed (${parameters['SpindleSpeed']} RPM) exceeds Machine Limit (${constraints.machineLimits.maxRpm} RPM)`);
    } else {
      reports.push('PASS: Spindle speed complies with machine limit envelopes.');
    }

    if (parameters['FeedRate'] && parameters['FeedRate'] > constraints.machineLimits.maxFeed) {
      feasible = false;
      score -= 20;
      reports.push(`FAIL: FeedRate (${parameters['FeedRate']} mm/min) exceeds Machine Limit (${constraints.machineLimits.maxFeed} mm/min)`);
    } else {
      reports.push('PASS: Feed rate complies with machine physical limits.');
    }

    // 2. Verify Tool Limits
    if (parameters['DepthOfCut'] && parameters['DepthOfCut'] > constraints.toolLimits.maxDepthOfCutMm) {
      feasible = false;
      score -= 15;
      reports.push(`FAIL: Depth of cut (${parameters['DepthOfCut']} mm) exceeds tool structure boundaries (${constraints.toolLimits.maxDepthOfCutMm} mm)`);
    } else {
      reports.push('PASS: Depth of cut is bounded by safe tool engagement envelope.');
    }

    // 3. Verify Hardware Binding Revisions
    if (!bindings.machine.machineRevision || !bindings.tool.toolRevision) {
      feasible = false;
      score -= 10;
      reports.push('FAIL: Resources bound to process lack traceable Revision records');
    } else {
      reports.push('PASS: Machine and tooling records have valid traceable engineering revisions.');
    }

    // 4. Verify Fixture Binding Configuration
    if (!bindings.fixture.fixtureConfiguration) {
      feasible = false;
      score -= 5;
      reports.push('FAIL: Fixture binding configuration descriptor is missing');
    }

    // 5. Verify NC Program Binding
    if (!bindings.nc.ncProgramRevision) {
      feasible = false;
      score -= 5;
      reports.push('FAIL: NC Program binding has unverified revision number');
    }

    return { feasible, score: Math.max(0, score), reports };
  }
}

export class ProcessChangeImpactAnalyzer {
  public static analyzeChange(
    originalParameters: Record<string, number>,
    newParameters: Record<string, number>,
    bindings: { tool: ToolBinding; machine: MachineBinding }
  ): { impactLevel: 'LOW' | 'MEDIUM' | 'HIGH'; itemsAffected: string[]; ecoWorkflowRequired: boolean } {
    const itemsAffected: string[] = [];
    let ecoWorkflowRequired = false;
    let deltaCount = 0;

    for (const key of Object.keys(newParameters)) {
      if (originalParameters[key] !== newParameters[key]) {
        itemsAffected.push(`Parameter: ${key} (${originalParameters[key]} -> ${newParameters[key]})`);
        deltaCount++;
        // Large speed/feed changes trigger formal ECO cycles
        if (key === 'SpindleSpeed' && Math.abs((newParameters[key] - originalParameters[key]) / originalParameters[key]) > 0.15) {
          ecoWorkflowRequired = true;
        }
        if (key === 'FeedRate' && Math.abs((newParameters[key] - originalParameters[key]) / originalParameters[key]) > 0.20) {
          ecoWorkflowRequired = true;
        }
      }
    }

    let impactLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (ecoWorkflowRequired || deltaCount >= 3) {
      impactLevel = 'HIGH';
    } else if (deltaCount > 0) {
      impactLevel = 'MEDIUM';
    }

    return { impactLevel, itemsAffected, ecoWorkflowRequired };
  }
}

export class ProcessTwinEventBus {
  private static listeners: Array<(event: ProcessEvent) => void> = [];

  public static addEventListener(cb: (event: ProcessEvent) => void) {
    this.listeners.push(cb);
  }

  public static publishEvent(
    processTwinId: string,
    category: ProcessEventCategory,
    description: string,
    operationId?: string
  ): ProcessEvent {
    const event: ProcessEvent = {
      eventId: `EVT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      processTwinId,
      category,
      timestamp: new Date().toISOString(),
      description,
      operationId
    };

    // Integrate with Evidence Bus to back critical changes
    const bus = EvidenceBus314.getInstance();
    const token = bus.registerEvidence(
      'MANUFACTURING_SOLVER',
      `EVT-${category}`,
      'REV-328-PROCESS',
      'ProcessLifecycleEvent',
      'VALIDATED',
      { description, timestamp: event.timestamp, eventId: event.eventId }
    );
    event.evidenceId = token.evidenceId;

    // Trigger local listeners
    this.listeners.forEach(cb => {
      try {
        cb(event);
      } catch (err) {
        console.error('Error in EventBus listener:', err);
      }
    });

    return event;
  }
}
