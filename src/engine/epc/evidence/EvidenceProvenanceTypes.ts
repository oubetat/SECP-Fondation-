/**
 * SECP Industrial OS — EPC-011: Engineering Evidence Provenance Types
 */

export enum ProvenanceAction {
  CAD_GENERATION = 'CAD_GENERATION',
  CAD_MODIFICATION = 'CAD_MODIFICATION',
  FEA_EXECUTION = 'FEA_EXECUTION',
  CFD_EXECUTION = 'CFD_EXECUTION',
  THERMAL_ANALYSIS = 'THERMAL_ANALYSIS',
  DYNAMICS_SIMULATION = 'DYNAMICS_SIMULATION',
  TEST_EXECUTION = 'TEST_EXECUTION',
  MEASUREMENT = 'MEASUREMENT',
  VERIFICATION = 'VERIFICATION',
  VALIDATION = 'VALIDATION',
  MANUFACTURING = 'MANUFACTURING',
  TELEMETRY = 'TELEMETRY',
  SIM2REAL = 'SIM2REAL'
}

export interface EvidenceProvenance {
  provenanceId: string;
  evidenceId: string;
  actor: string;
  action: ProvenanceAction;
  timestamp: string;
  source: string;
  sourceVersion: string;
  inputs: Record<string, any>;
  process: {
    processId: string;
    processType: string;
    processVersion: string;
    executionId: string;
    startTime: string;
    endTime: string;
    status: string;
  };
  outputs: string[]; // List of resulting artifact IDs
  parentEvidenceIds: string[];
  configurationId?: string;
  revisionId: string;
  hash?: string; // Integrity hash of the provenance record itself
  metadata?: Record<string, any>;
}

export interface ProvenanceValidationResult {
  valid: boolean;
  missingFields: string[];
}
