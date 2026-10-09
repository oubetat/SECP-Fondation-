import { DerivedArtifactBindingResult } from '../../topology/CanonicalDerivedArtifactBinding';

export interface ManufacturingExecutionEnvelope {
  entityId: string;
  partId: string;
  revisionId: string;
  cadRevisionHash: string;
  canonicalGeometryHash: string;
  artifactDigest: string;
  gCodeHash: string;
  loadedProgramHash: string;
  machineId: string;
  executionId: string;
  telemetryRoot: string;
  bindingResult?: DerivedArtifactBindingResult;
  telemetryChain?: PhysicalTelemetryEnvelope[];
}

export interface PhysicalTelemetryEnvelope {
  deviceId: string;
  machineId: string;
  sequenceNumber: number;
  timestamp: string;
  payload: any;
  previousHash: string;
  signature: string;
}

export type PMALevel =
  | 'SIMULATED_PIPELINE_QUALIFIED'
  | 'PHYSICAL_EXECUTION_PROVEN'
  | 'PHYSICAL_INSPECTION_PROVEN'
  | 'FACTORY_PROVENANCE_COMPLETE'
  | 'INDUSTRIAL_FIELD_QUALIFIED'
  | 'NOT_CLOSED';

export type DeterminismClass =
  | 'BIT_EXACT'
  | 'CANONICALLY_DETERMINISTIC'
  | 'REPORT_DETERMINISTIC'
  | 'NOT_PROVEN';

export interface MetrologyProof {
  inspectionId: string;
  instrumentIdentity: string;
  measurementSystem: string;
  operatorId?: string;
  dimensionalMeasurements: Record<string, number>;
  geometricDeviations: Record<string, number>;
  datumReferences: string[];
  tolerances: Record<string, number>;
  measurementUncertainty: number;
  inspectionEvidenceHash: string;
}

export type DeviationVerdict = 'PASS' | 'FAIL' | 'OUT_OF_TOLERANCE' | 'INSPECTION_INCOMPLETE';

export interface PhysicalManufacturingAttestation {
  attestationId: string;
  documentId: string;
  instanceId: string;
  releasedArtifactHash: string;
  toolpathHash: string;
  machineId: string;
  controllerId: string;
  toolId: string;
  stockId: string;
  manufacturingRunId: string;
  physicalPartId: string;
  inspectionId?: string;
  telemetryEvidenceHash: string;
  executionEvidenceHash: string;
  inspectionEvidenceHash?: string;
  predecessorAttestationHash: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  claimLevel: PMALevel;
  determinismClass?: DeterminismClass;
}
