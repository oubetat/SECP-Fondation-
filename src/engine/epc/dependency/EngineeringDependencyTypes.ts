/**
 * SECP Industrial OS — EPC-007: CAD / CAE / CAM Dependency Graph Types
 */

import { EngineeringObjectType } from '../../identity/CanonicalEngineeringIdentity';

export enum DependencyNodeType {
  CAD_REVISION = 'CAD_REVISION',
  CAE_MODEL = 'CAE_MODEL',
  MESH = 'MESH',
  SIMULATION = 'SIMULATION',
  CAM_OPERATION = 'CAM_OPERATION',
  MANUFACTURING_DEFINITION = 'MANUFACTURING_DEFINITION'
}

export enum DependencyStatus {
  CURRENT = 'CURRENT',
  STALE = 'STALE',
  BROKEN = 'BROKEN',
  MISSING = 'MISSING',
  INCOMPATIBLE = 'INCOMPATIBLE',
  INVALID = 'INVALID'
}

export enum DependencyEdgeType {
  GEOMETRY_DEPENDENCY = 'GEOMETRY_DEPENDENCY',
  REVISION_DEPENDENCY = 'REVISION_DEPENDENCY',
  MATERIAL_DEPENDENCY = 'MATERIAL_DEPENDENCY',
  MESH_DEPENDENCY = 'MESH_DEPENDENCY',
  SIMULATION_DEPENDENCY = 'SIMULATION_DEPENDENCY',
  MANUFACTURING_DEPENDENCY = 'MANUFACTURING_DEPENDENCY',
  CONFIGURATION_DEPENDENCY = 'CONFIGURATION_DEPENDENCY'
}

export interface DependencyNode {
  readonly id: string;
  readonly type: DependencyNodeType;
  readonly revision: string;
  readonly status: DependencyStatus;
  readonly sourceReference: string;
  readonly configurationId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly contentHash?: string;
  readonly metadata?: Record<string, any>;
}

export interface DependencyEdge {
  readonly dependencyId: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly dependencyType: DependencyEdgeType;
  readonly sourceRevision: string;
  readonly targetRevision: string;
  readonly createdAt: string;
  readonly status: DependencyStatus;
  readonly metadata?: Record<string, any>;
}

export interface DependencyGraph {
  readonly nodes: DependencyNode[];
  readonly edges: DependencyEdge[];
  readonly graphId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly configurationId: string;
}

export interface ImpactAnalysisResult {
  readonly directImpacts: string[];
  readonly indirectImpacts: string[];
  readonly staleArtifacts: string[];
  readonly brokenArtifacts: string[];
  readonly requiresRegeneration: string[];
  readonly requiresReverification: string[];
}

export interface DependencyValidationResult {
  readonly isValid: boolean;
  readonly verdict: DependencyStatus;
  readonly issues: string[];
  readonly timestamp: string;
}

export interface EPC007GateReport {
  readonly epc: 'EPC-007';
  readonly name: string;
  readonly verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly nodesValidated: boolean;
  readonly edgesValidated: boolean;
  readonly revisionPropagationValidated: boolean;
  readonly staleDetectionValidated: boolean;
  readonly brokenDependencyDetectionValidated: boolean;
  readonly configurationConsistencyValidated: boolean;
  readonly hashIntegrityValidated: boolean;
  readonly cycleDetectionValidated: boolean;
  readonly impactAnalysisValidated: boolean;
  readonly provenanceValidated: boolean;
  readonly evidenceIntegrationValidated: boolean;
  readonly determinismValidated: boolean;
  readonly adversarialResistanceValidated: boolean;
  readonly testsPassed: number;
  readonly testsFailed: number;
  readonly evidenceHash: string;
}
