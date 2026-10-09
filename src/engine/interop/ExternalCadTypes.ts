
import { WorkflowStage, WorkflowArtifact } from '../workflow/RealEngineerWorkflowTypes';

export type CadFormat = 
  | 'STEP_AP203' 
  | 'STEP_AP214' 
  | 'STEP_AP242' 
  | 'IGES' 
  | 'PARASOLID' 
  | 'ACIS' 
  | 'JT' 
  | 'STL' 
  | 'DXF';

export type InteroperabilityLossSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CadInteroperabilityLoss {
  type: 'GEOMETRY_LOSS' | 'TOPOLOGY_LOSS' | 'FEATURE_LOSS' | 'PMI_LOSS' | 'METADATA_LOSS' | 'ASSEMBLY_LOSS' | 'MATERIAL_LOSS';
  severity: InteroperabilityLossSeverity;
  description: string;
  affectedEntityId?: string;
}

export interface InteroperabilityDiagnostics {
  status: 'SUCCESS' | 'SUCCESS_WITH_WARNINGS' | 'PARTIAL' | 'FAILED';
  unitConversion?: { from: string; to: string; factor: number };
  losses: CadInteroperabilityLoss[];
  geometryValidation: {
    volumeDeviationPct: number;
    surfaceAreaDeviationPct: number;
    manifold: boolean;
    selfIntersections: number;
  };
}

export interface ImportSession {
  sessionId: string;
  externalFileId: string;
  format: CadFormat;
  sourceApplication: string;
  importTimestamp: string;
  diagnostics: InteroperabilityDiagnostics;
  internalModelId?: string;
}

export interface ExportSession {
  sessionId: string;
  internalModelId: string;
  targetFormat: CadFormat;
  exportTimestamp: string;
  diagnostics: InteroperabilityDiagnostics;
  externalFileId?: string;
}
