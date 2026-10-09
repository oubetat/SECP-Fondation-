/**
 * SECP Industrial OS v2 — Cross-Kernel Round-Trip Interoperability Types
 * PATCH-040: Industrial CAD Interoperability & Loss Measurement
 * 
 * Formal data types for measuring REAL engineering information loss across
 * kernel/interchange boundaries: SECP -> STEP AP242 -> External CAD -> STEP AP242 -> SECP
 */

import { NativeSECPDocument, NativePoint3D, NativeAnalyticCurve, NativeAnalyticSurface, NativeNurbsCurve, NativeNurbsSurface, NativeVertex, NativeEdge, NativeLoop, NativeFace, NativeShell, NativeBRepSolid, NativeFeatureNode, NativeSketch, NativeComponentInstance, NativeAssemblyMate, NativeManufacturingFeature, NativeToolpathReference } from '../native-secp/NativeSECPTypes';
import { AP242SemanticModel } from '../AP242Types';

export type ExternalKernelStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'FAILED' | 'UNSUPPORTED';

export interface ExternalKernelIdentity {
  kernelName: string;
  vendor: string;
  version: string;
  build: string;
  platform: string;
  importerVersion: string;
  exporterVersion: string;
  isTestHarness?: boolean;
  configuration?: {
    linearTolerance?: number;
    angularTolerance?: number;
    units?: string;
    healingEnabled?: boolean;
    tessellationEnabled?: boolean;
  };
}

export type LossClassification =
  | 'NO_LOSS'
  | 'NUMERICAL_VARIATION'
  | 'REPRESENTATION_CHANGE'
  | 'SEMANTIC_CHANGE'
  | 'ENGINEERING_LOSS'
  | 'DATA_LOSS'
  | 'INVALID'
  | 'UNPROVEN';

export type FidelityStatus =
  | 'PROVEN'
  | 'PARTIAL'
  | 'LOST'
  | 'UNPROVEN'
  | 'FAIL';

export type DifferenceCategory =
  | 'GEOMETRY'
  | 'TOPOLOGY'
  | 'BREP'
  | 'NURBS'
  | 'FEATURE_HISTORY'
  | 'PARAMETRIC_INTENT'
  | 'ASSEMBLY'
  | 'PMI'
  | 'UNITS'
  | 'TOLERANCE'
  | 'IDENTITY'
  | 'PROVENANCE'
  | 'METADATA';

export type DifferenceSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface CrossKernelDifference {
  category: DifferenceCategory;
  entityId: string;
  sourceValue: any;
  roundtripValue: any;
  delta?: number | string | Record<string, any>;
  tolerance?: number;
  classification: LossClassification;
  severity: DifferenceSeverity;
  message: string;
}

export interface DomainComparisonResult {
  category: DifferenceCategory;
  fidelityStatus: FidelityStatus;
  lossClassification: LossClassification;
  sourceEntitiesCount: number;
  roundtripEntitiesCount: number;
  preservedCount: number;
  modifiedCount: number;
  lostCount: number;
  metrics: Record<string, number | boolean | string>;
  differences: CrossKernelDifference[];
}

export interface CrossKernelDifferenceReport {
  timestamp: string;
  sourceObjectId: string;
  sourceRevisionId: string;
  externalKernelName: string;
  overallLossClassification: LossClassification;
  totalDifferences: number;
  criticalCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  categories: Record<DifferenceCategory, DomainComparisonResult>;
  differences: CrossKernelDifference[];
}

export interface SourceBaseline {
  objectId: string;
  revisionId: string;
  document: NativeSECPDocument;
  canonicalHash: string;
  geometryFingerprint: {
    pointsCount: number;
    analyticCurvesCount: number;
    nurbsCurvesCount: number;
    analyticSurfacesCount: number;
    nurbsSurfacesCount: number;
    boundingBox: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
    totalVolumeMm3: number;
    totalSurfaceAreaMm2: number;
  };
  topologyFingerprint: {
    verticesCount: number;
    edgesCount: number;
    loopsCount: number;
    facesCount: number;
    shellsCount: number;
    solidsCount: number;
    adjacencyHash: string;
  };
  nurbsFingerprint: {
    curvesDegree: number[];
    surfacesDegree: [number, number][];
    totalControlPoints: number;
  };
  featureFingerprint: {
    featuresCount: number;
    featureTypes: string[];
    executionOrder: string[];
  };
  assemblyFingerprint: {
    instancesCount: number;
    nodesCount: number;
    matesCount: number;
  };
  pmiFingerprint: {
    mfgFeaturesCount: number;
    toolpathsCount: number;
  };
  units: {
    length: string;
    angle: string;
    scaleFactorToMm: number;
  };
  tolerance: {
    linear: number;
    angular: number;
  };
}

export interface ExportEvidence {
  timestamp: string;
  exporterVersion: string;
  schemaVersion: string;
  sourceCanonicalHash: string;
  stepArtifactHash: string;
  stepByteLength: number;
  stepContent: string;
  ap242Model: AP242SemanticModel;
  mappedEntitiesCount: number;
  warnings: string[];
  errors: string[];
}

export interface ExternalImportEvidence {
  timestamp: string;
  kernelIdentity: ExternalKernelIdentity;
  importSuccess: boolean;
  importedEntityCount: number;
  healingOperationsApplied: string[];
  toleranceAdjustments: Record<string, number>;
  unsupportedEntities: string[];
  warnings: string[];
  errors: string[];
  nativeHandle?: any;
}

export interface ExternalExportEvidence {
  timestamp: string;
  kernelIdentity: ExternalKernelIdentity;
  exportSuccess: boolean;
  exporterVersion: string;
  stepSchema: string;
  stepArtifactHash: string;
  stepByteLength: number;
  stepContent: string;
  exportedEntityCount: number;
  healingOperations: string[];
  warnings: string[];
  errors: string[];
}

export interface RoundtripEvidence {
  timestamp: string;
  importerVersion: string;
  document: NativeSECPDocument;
  canonicalHash: string;
  stepArtifactHash: string;
  structuralValid: boolean;
  topologyValid: boolean;
  geometryValid: boolean;
  warnings: string[];
  errors: string[];
}

export interface IdentityMappingEntry {
  sourceId: string;
  sourceType: string;
  externalId?: string;
  roundtripId: string;
  status: 'PRESERVED' | 'MAPPED' | 'REGENERATED' | 'LOST';
}

export interface ProvenanceTransition {
  step: 'SOURCE_NATIVE' | 'STEP_EXPORT' | 'EXTERNAL_IMPORT' | 'EXTERNAL_EXPORT' | 'STEP_IMPORT' | 'ROUNDTRIP_VERIFICATION';
  timestamp: string;
  operation: string;
  authorOrSystem: string;
  inputArtifactHash?: string;
  outputArtifactHash?: string;
  details?: Record<string, any>;
}

export type CrossKernelVerdict = 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID';

export interface CrossKernelEvidencePackage {
  packageId: string;
  timestamp: string;
  sourceArtifactHash: string;
  sourceCanonicalHash: string;
  sourceBaseline: SourceBaseline;
  externalKernelIdentity: ExternalKernelIdentity;
  externalKernelStatus: ExternalKernelStatus;
  exportEvidence: ExportEvidence;
  externalImportEvidence: ExternalImportEvidence;
  externalExportEvidence: ExternalExportEvidence;
  roundtripEvidence: RoundtripEvidence;
  differenceReport: CrossKernelDifferenceReport;
  identityMapping: IdentityMappingEntry[];
  provenanceChain: ProvenanceTransition[];
  adversarialResults?: {
    modelId: string;
    verdict: CrossKernelVerdict;
    losses: LossClassification[];
  }[];
  verdict: CrossKernelVerdict;
  verdictReason: string;
}

export interface CrossKernelExecutionOptions {
  requireGenuineExternalKernel?: boolean;
  customLinearTolerance?: number;
  customAngularTolerance?: number;
  failOnFeatureFlattening?: boolean;
}
