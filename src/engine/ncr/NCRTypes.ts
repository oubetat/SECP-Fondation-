/**
 * PATCH-SECP-063: Manufacturing Nonconformance & Corrective Action Core
 * Structural types mapping part/process deviations, containment holds,
 * root-cause investigations, disposition states, and requalification pipelines.
 */

export type NCRType = 
  | 'PART_DEFECT'
  | 'PROCESS_DEVIATION'
  | 'MATERIAL_NONCONFORMANCE'
  | 'TOOL_FAILURE'
  | 'MACHINE_DEVIATION'
  | 'DOCUMENTATION_NONCONFORMANCE';

export type NCRSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';

export type ContainmentStatus = 
  | 'DETECTED'
  | 'CONTAINMENT_REQUIRED'
  | 'LOT_HOLD'
  | 'AFFECTED_PARTS_IDENTIFIED';

export type RootCauseStatus = 'CANDIDATE' | 'UNDER_INVESTIGATION' | 'CONFIRMED' | 'REJECTED';

export type DispositionType = 
  | 'ACCEPTED'
  | 'USE_AS_IS'
  | 'REWORK'
  | 'REPAIR'
  | 'SCRAP'
  | 'RETURN_TO_SUPPLIER'
  | 'HOLD';

export type ChangeImpactLevel = 
  | 'NONE'
  | 'LOCAL_REWORK'
  | 'PROCESS_REVALIDATION'
  | 'NC_REGENERATION'
  | 'CAM_REGENERATION'
  | 'FULL_ENGINEERING_REQUALIFICATION';

export interface NonconformanceRecord {
  ncrId: string;
  ncrNumber: string; // e.g. "NCR-2026-0001"
  type: NCRType;
  severity: NCRSeverity;
  status: 'OPEN' | 'CONTAINED' | 'DISPOSITIONED' | 'CLOSED';
  title: string;
  description: string;
  timestamp: string;
  
  // High-fidelity digital thread linkages
  partSerial?: string;
  jobId?: string;
  operationId?: string;
  machineId?: string;
  toolId?: string;
  materialLotId?: string;
  measurementSessionId?: string;
  spcObservationId?: string;
  
  loggedBy: string;
}

export interface ContainmentHold {
  holdId: string;
  ncrId: string;
  status: ContainmentStatus;
  materialLotId: string;
  affectedPartSerials: string[];
  holdReleaseCode?: string;
  isReleased: boolean;
  lockTimestamp: string;
  releaseTimestamp?: string;
  releasedBy?: string;
}

export interface RootCauseInvestigation {
  investigationId: string;
  ncrId: string;
  sourceSpcCorrelationR?: number;
  candidateCause: string;
  status: RootCauseStatus;
  investigationNotes: string;
  evidencePaths: string[];
  reviewedBy?: string;
  resolutionTimestamp?: string;
}

export interface CAPA_Action {
  actionId: string;
  ncrId: string;
  actionType: 'CORRECTIVE' | 'PREVENTIVE';
  description: string;
  owner: string;
  dueDate: string;
  evidencePath?: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  effectivenessRating?: 'EXCELLENT' | 'ADEQUATE' | 'INEFFECTIVE';
  verificationNotes?: string;
}

export interface DispositionRecord {
  dispositionId: string;
  ncrId: string;
  disposition: DispositionType;
  justification: string;
  authorizedEngineerId: string;
  signatureHash: string; // Secure digital confirmation
  timestamp: string;
}

export interface ChangeImpactAssessment {
  assessmentId: string;
  ncrId: string;
  rootCauseCategoryId: string; // e.g. "tooling", "cad_geometry", "fixture"
  impactLevel: ChangeImpactLevel;
  requiredActions: string[];
  requiresRevalidation: boolean;
  assessedBy: string;
  timestamp: string;
}

export interface RequalificationLog {
  requalificationId: string;
  ncrId: string;
  correctiveActionId: string;
  newPartSerial: string;
  newJobId: string;
  metrologyVerified: boolean;
  metrologyMeasurementHash?: string;
  spcControlled: boolean;
  effectivenessStatus: 'PENDING_VERIFICATION' | 'EFFECTIVE_VERIFIED' | 'INEFFECTIVE_REDESIGN';
  timestamp: string;
}

export interface NCRProvenanceCertificate {
  certificateId: string;
  ncrId: string;
  ncrNumber: string;
  timestamp: string;
  digitalThreadSummary: {
    partSerial: string;
    machineId: string;
    materialLotId: string;
    defectSeverity: NCRSeverity;
  };
  containmentStatus: ContainmentStatus;
  disposition: DispositionType;
  capaCount: number;
  provenanceHash: string; // Immutable SHA-256 process state signature
}
