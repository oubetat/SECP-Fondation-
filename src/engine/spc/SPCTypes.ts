/**
 * PATCH-SECP-062: Statistical Process Control & Manufacturing Intelligence Core
 * Core Type Definitions connecting CAM/NC execution directly with metrology and quality intelligence.
 */

export interface SPCObservation {
  observationId: string;
  partSerial: string;
  jobId: string;
  operationId: string;
  machineId: string;
  toolId: string;
  materialLotId: string;
  measurementSessionId: string;
  measurementFeatureId: string;
  nominal: number;
  measured: number;
  deviation: number;
  toleranceUpper: number; // USL
  toleranceLower: number; // LSL
  timestamp: string;
  
  // High-fidelity digital thread variables
  spindleSpeedRpm?: number;
  feedRateMmMine?: number;
  coolantTemperatureC?: number;
  toolHoursUsed?: number;
}

export interface ControlLimits {
  lcl: number; // Lower Control Limit (computed 3-sigma standard)
  cl: number;  // Center Line (Process Mean)
  ucl: number; // Upper Control Limit (computed 3-sigma standard)
  sigma: number; // Standard Deviation
}

export interface ProcessBaseline {
  baselineId: string;
  featureId: string;
  sampleCount: number;
  mean: number;
  median: number;
  standardDeviation: number; // sigma (within group)
  movingAverage: number;
  movingRange: number; // Average of absolute successive differences
  controlLimits: ControlLimits;
  baselineWindowStart: string;
  baselineWindowEnd: string;
}

export interface ProcessCapability {
  cp: number;  // Potential Capability index (short-term)
  cpk: number; // Actual Centering Capability index (short-term)
  pp: number;  // Performance index (long-term overall)
  ppk: number; // Performance Centering index (long-term overall)
  withinVariation: number;  // estimated from moving ranges
  overallVariation: number; // sample standard deviation
  status: 'CAPABLE' | 'MARGINAL' | 'INCAPABLE';
  interpretation: string;
}

export type DriftState = 'STABLE' | 'DRIFTING' | 'DEGRADING' | 'OUT_OF_CONTROL' | 'RECOVERING';

export interface ProcessDriftAssessment {
  state: DriftState;
  slopeMmPerSample: number;
  confidenceScore: number; // 0.0 to 1.0 representing trend strength
  estimatedSamplesToBoundary: number;
  description: string;
}

export type OutOfControlRuleId = 'RULE_1' | 'RULE_2' | 'RULE_3' | 'RULE_4' | 'RULE_5';

export interface OutOfControlSignal {
  ruleId: OutOfControlRuleId;
  name: string;
  pointIndices: number[];
  description: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface QualityPredictionAlert {
  alertId: string;
  timestamp: string;
  featureId: string;
  estimatedPartsUntilOutOfTolerance: number;
  probabilityOfDefect: number; // 0.0 to 1.0
  recommendedAction: string;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ProcessFeedbackProposal {
  proposalId: string;
  timestamp: string;
  machineId: string;
  toolId: string;
  parameterName: string; // e.g. "tool_wear_offset_z"
  suggestedOffsetMm: number;
  impactAnalysis: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  authorizedEngineerId?: string;
}

export interface ProcessHealthCertificate {
  certificateId: string;
  timestamp: string;
  jobId: string;
  machineId: string;
  operationId: string;
  processWindow: string; // Range representation e.g. "SN-101 to SN-125"
  sampleCount: number;
  cp: number;
  cpk: number;
  pp: number;
  ppk: number;
  controlLimits: ControlLimits;
  detectedSignals: OutOfControlSignal[];
  driftStatus: DriftState;
  anomalyStatus: 'CONTROLLED' | 'UNCONTROLLED' | 'CRITICAL';
  sourceMeasurementHashes: string[];
  provenanceHash: string; // SHA-256 secure signature
}
