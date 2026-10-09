/**
 * SECP — ADSE-P8 Controls Integration & Dynamic Engineering Truth Types
 * Advanced Aerospace & Defense Systems Engineering (ADSE)
 * 
 * Governing Architectural Principle:
 * «Controls Integration does not create an independent Control Truth. It establishes the
 * authoritative, verifiable, and reconstructable relationships between engineering intent,
 * requirements, behavior, system architecture, structural context, thermal/power states,
 * and the dynamic execution of control laws against a plant model.»
 * 
 * Core Authority Rule:
 * «AI proposes control concepts → MBSE structures behavior → Core authorizes → Controller executes
 * → Physics computes consequences → Verification challenges → Evidence proves → Persistence reconstructs.»
 */

import { ADSEAuthorityState, ADSELifecycleState, EngineeringEntity, ADSEEntityType } from '../p0/types';
import { CoreBindingState } from '../p2/types';

/**
 * ADSE-P8 Capability Identifiers
 */
export const ADSE_P8_CAPABILITIES = {
  ADSE_CONTROL_INTEGRATION: 'ADSE_CONTROL_INTEGRATION',
  ADSE_CONTROL_MODEL_AUTHORITY: 'ADSE_CONTROL_MODEL_AUTHORITY',
  ADSE_PLANT_BINDING_AUTHORITY: 'ADSE_PLANT_BINDING_AUTHORITY',
  ADSE_CONTROL_LAW_EXECUTION: 'ADSE_CONTROL_LAW_EXECUTION',
  ADSE_DYNAMIC_STATE_AUTHORITY: 'ADSE_DYNAMIC_STATE_AUTHORITY',
  ADSE_CONTROL_VERIFICATION_GATE: 'ADSE_CONTROL_VERIFICATION_GATE',
  ADSE_CONTROL_FORENSIC_AUDIT: 'ADSE_CONTROL_FORENSIC_AUDIT',
  ADSE_CONTROL_DIGITAL_THREAD: 'ADSE_CONTROL_DIGITAL_THREAD'
} as const;

export type ControlMode = 
  | 'MANUAL_DIRECT'
  | 'AUGMENTED_STABILITY'
  | 'AUTOMATIC_NOMINAL'
  | 'AUTONOMOUS_MISSION'
  | 'SAFE_MODE_DEGRADED'
  | 'EMERGENCY_OVERRIDE'
  | 'OFFLINE_STANDBY';

export type ControlLawType = 
  | 'PID_CLASSIC'
  | 'LQR_OPTIMAL'
  | 'MPC_MODEL_PREDICTIVE'
  | 'FUZZY_LOGIC'
  | 'NEURAL_ADAPTIVE'
  | 'NON_LINEAR_DYNAMIC_INVERSION'
  | 'GAIN_SCHEDULED_LINEAR';

export type PlantModelType = 
  | 'LINEAR_SS_CONTINUOUS'
  | 'LINEAR_SS_DISCRETE'
  | 'NON_LINEAR_ODE'
  | 'TRANSFER_FUNCTION'
  | 'PHYSICS_SOLVER_BIPARTITE';

export type ControlExecutionStatus = 
  | 'PENDING'
  | 'SIMULATING'
  | 'COMPLETED'
  | 'STABLE'
  | 'UNSTABLE'
  | 'FAILED'
  | 'INVALIDATED'
  | 'VERIFIED';

/**
 * Root entity for a Control System within the ADSE context
 */
export interface ControlSystem extends EngineeringEntity {
  type: 'ControlSystem';
  displayName: string;
  p3ArchitectureId: string;    // Binding to P3 System Architecture
  p4NodeId: string;            // Digital Thread Lineage Node
  p5StructuralContextId?: string;
  p6ThermalContextId?: string;
  p7PowerContextId?: string;
  isPublished: boolean;
}

/**
 * Defines the mapping between a control system and the physical plant it controls
 */
export interface ControlledPlant extends EngineeringEntity {
  type: 'ControlledPlant';
  controlSystemId: string;
  canonicalArchitectureId: string; // The P3 component/subsystem being controlled
  plantModelType: PlantModelType;
  p5StructuralId?: string;
  stateVariables: StateVariable[];
  controlInputs: ControlInput[];
  measurements: Measurement[];
  parameters: Record<string, number>;
}

export interface StateVariable {
  name: string;
  unit: string;
  initialValue: number;
  minLimit?: number;
  maxLimit?: number;
  description: string;
}

export interface ControlInput {
  name: string;
  unit: string;
  actuatorId?: string;
  minLimit: number;
  maxLimit: number;
  defaultLevel: number;
}

export interface ControlOutput {
  name: string;
  unit: string;
  sensorId?: string;
}

export interface Measurement {
  name: string;
  unit: string;
  sourceStateVariable: string;
  sensorNoiseStdDev?: number;
  samplingRateHz: number;
}

/**
 * Authoritative Control Loop definition
 */
export interface ControlLoop extends EngineeringEntity {
  type: 'ControlLoop';
  controlSystemId: string;
  loopName: string;
  controllerId: string;
  plantId: string;
  feedbackPaths: FeedbackPath[];
  feedforwardPaths: FeedforwardPath[];
  executionRateHz: number;
  targetOperatingMode: ControlMode;
}

export interface FeedbackPath {
  measurementName: string;
  targetControllerInput: string;
  latencyMs: number;
}

export interface FeedforwardPath {
  referenceSignal: string;
  targetControllerInput: string;
}

/**
 * Controller entity implementing one or more Control Laws
 */
export interface Controller extends EngineeringEntity {
  type: 'Controller';
  controlSystemId: string;
  canonicalArchitectureId: string; // P3 Binding
  supportedModes: ControlMode[];
  activeMode: ControlMode;
  mbseStateId?: string;           // Binding to P2 MBSEState
  laws: ControlLaw[];
  samplingRateHz: number;
}

export interface ControlLaw extends EngineeringEntity {
  type: 'ControlLaw';
  controllerId: string;
  lawType: ControlLawType;
  parameters: ControlParameter[];
  constraints: ControlConstraint[];
  revisionId: string;
}

export interface ControlParameter {
  key: string;
  value: number | number[] | number[][];
  unit?: string;
  isTunable: boolean;
  description?: string;
}

export interface ControlConstraint {
  name: string;
  type: 'HARD' | 'SOFT';
  targetVariable: string;
  expression: string; // e.g. "v < 100"
}

/**
 * Dynamic Execution of a Control System
 */
export interface ControlExecution extends EngineeringEntity {
  type: 'ControlExecution';
  controlSystemId: string;
  loopId: string;
  scenarioId: string; // Link to P2/P1 scenario
  startTime: string;
  endTime?: string;
  durationSeconds: number;
  status: ControlExecutionStatus;
  fingerprint: string;
}

export interface ControlExecutionResult extends EngineeringEntity {
  type: 'ControlExecutionResult';
  executionId: string;
  timeSteps: number[]; // relative time in seconds
  stateTrajectories: Record<string, number[]>;
  inputTrajectories: Record<string, number[]>;
  outputTrajectories: Record<string, number[]>;
  stabilityFinding: ControlStabilityFinding;
  marginSummary: ControlMargin[];
}

export interface ControlStabilityFinding {
  isStable: boolean;
  method: 'LYAPUNOV' | 'POLE_PLACEMENT' | 'PHASE_GAIN_MARGIN' | 'EMPIRICAL_SIM';
  description: string;
  metricValue?: number;
}

export interface ControlMargin {
  variable: string;
  actualPeak: number;
  limit: number;
  marginPercent: number;
}

/**
 * Verification and Evidence for P8
 */
export interface ControlVerificationIntent extends EngineeringEntity {
  type: 'ControlVerificationIntent';
  controlSystemId: string;
  requirementId: string; // Binding to P1 Requirement
  targetLoopId: string;
  successCriteria: string;
  status: 'PENDING' | 'PASSED' | 'FAILED';
}

export interface ControlEvidence extends EngineeringEntity {
  type: 'ControlEvidence';
  verificationIntentId: string;
  executionResultId: string;
  summary: string;
  proofHash: string;
  authority: string;
}

export interface ControlImpact {
  affectedSystemIds: string[];
  invalidatedExecutionIds: string[];
  supersededEvidenceIds: string[];
  impactedArchitectureIds: string[];
  reason: string;
  timestamp: string;
}

/**
 * Snapshot for persistence and reconstruction
 */
export interface ControlSnapshot extends EngineeringEntity {
  type: 'ControlSnapshot';
  controlSystemId: string;
  timestamp: string;
  entities: {
    systems: ControlSystem[];
    plants: ControlledPlant[];
    loops: ControlLoop[];
    controllers: Controller[];
    laws: ControlLaw[];
    executions: ControlExecution[];
    results: ControlExecutionResult[];
    verifications: ControlVerificationIntent[];
    evidences: ControlEvidence[];
  };
  merkleRoot: string;
}
