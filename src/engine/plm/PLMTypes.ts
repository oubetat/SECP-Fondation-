/**
 * PATCH-SECP-088: Engineering PLM & ECO System Types
 * Defines the core data structures for Enterprise Product Lifecycle Management,
 * including Artifacts, Revisions, ECOs, and Release Manifests.
 */

export type ArtifactType = 
  | 'CAD_GEOMETRY'
  | 'ASSEMBLY'
  | 'BOM'
  | 'PMI_GDNT'
  | 'FEA_RESULT'
  | 'CFD_RESULT'
  | 'THERMAL_RESULT'
  | 'CAM_TOOLPATH'
  | 'MACHINE_SIMULATION'
  | 'INSPECTION_PLAN'
  | 'INSPECTION_REPORT';

export type ArtifactStatus = 
  | 'DRAFT'
  | 'VALID'
  | 'OUTDATED'
  | 'INVALIDATED'
  | 'REQUIRES_RECALCULATION'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'RELEASED'
  | 'SUPERSEDED'
  | 'WITHDRAWN';

export interface EngineeringArtifact {
  artifactId: string;
  type: ArtifactType;
  name: string;
  revision: string;
  version: number;
  status: ArtifactStatus;
  createdBy: string;
  createdAt: string;
  parentRevision?: string;
  geometryHash: string;
  dependencyHash: string; // Hash of all dependency artifact IDs and their revisions
  provenanceReference?: string;
  metadata: Record<string, any>;
}

export interface ECOChangeRequest {
  requestId: string;
  ecoId: string;
  artifactId: string;
  changeType: 'MODIFY' | 'ADD' | 'REMOVE';
  description: string;
  reason: string;
}

export interface EngineeringChangeOrder {
  ecoId: string;
  title: string;
  description: string;
  reason: string;
  author: string;
  createdAt: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'VALIDATION' | 'REVIEW' | 'APPROVED' | 'REJECTED' | 'CLOSED';
  affectedArtifacts: string[]; // List of artifact IDs
  changeRequests: ECOChangeRequest[];
  validationGates: {
    gateName: string;
    passed: boolean;
    validator: string;
    timestamp?: string;
  }[];
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvalTimestamp?: string;
  releaseId?: string;
}

export interface ReleaseManifest {
  releaseId: string;
  productId: string;
  productName: string;
  ecoId: string;
  timestamp: string;
  status: 'RELEASED' | 'WITHDRAWN';
  
  // Revisions of all core artifacts at the time of release
  revisions: {
    cadRevision: string;
    assemblyRevision: string;
    bomRevision: string;
    pmiRevision: string;
    feaRevision?: string;
    cfdRevision?: string;
    thermalRevision?: string;
    camRevision?: string;
    simulationRevision?: string;
    inspectionPlanRevision?: string;
    inspectionReportRevision?: string;
  };
  
  provenanceRoot: string; // Root Merkle hash
  releaseHash: string; // Deterministic hash of the entire manifest
  approvalSignature: string;
}

export interface ImpactAnalysisResult {
  ecoId: string;
  targetArtifactId: string;
  affectedDownstreamArtifacts: {
    artifactId: string;
    type: ArtifactType;
    reason: string;
    impactSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }[];
  isInvalidationRequired: boolean;
}
