/**
 * SECP Industrial OS v2 — Unified Physics Model Types
 * PATCH-042: Physics Foundation
 */

import { EngineeringEvidence } from '../evidence/EngineeringEvidenceTypes';
import { ProvenanceNode } from '../provenance/ProvenanceGraphTypes';
import { DimensionVector } from './units/Dimension';

export enum PhysicsDomain {
  FLUID = 'FLUID',
  STRUCTURAL = 'STRUCTURAL',
  THERMAL = 'THERMAL',
  ELECTROMAGNETIC = 'ELECTROMAGNETIC',
  MULTIPHYSICS = 'MULTIPHYSICS'
}

export type PhysicsModelStatus = 'DRAFT' | 'DEFINED' | 'VALIDATED' | 'INVALID' | 'UNPROVEN';

export interface PhysicalQuantity {
  value: number;
  unit: string;
  dimension: DimensionVector;
}

export interface UnitReference {
  unitSystem: string;
  linearUnit: string;
  angularUnit: string;
  massUnit: string;
  timeUnit: string;
  temperatureUnit: string;
}

export interface MaterialReference {
  materialId: string;
  materialRevision: string;
  source: string;
  provenanceRef?: string;
  propertySetReference?: string;
}

export interface GeometryReference {
  artifactId: string;
  artifactHash: string;
  revision: string;
  source: string;
}

export interface MeshReference {
  meshId: string;
  artifactId: string;
  artifactHash: string;
  revision: string;
  elementCount: number;
  nodeCount: number;
  status: string;
}

export type BoundaryConditionType = 
  | 'DIRICHLET' 
  | 'NEUMANN' 
  | 'ROBIN' 
  | 'PERIODIC' 
  | 'SYMMETRY' 
  | 'WALL' 
  | 'INLET' 
  | 'OUTLET';

export interface BoundaryCondition {
  id: string;
  type: BoundaryConditionType;
  targetRegion: string;
  field: string;
  quantity: PhysicalQuantity;
  metadata?: Record<string, any>;
  provenance?: string;
}

export interface InitialCondition {
  id: string;
  targetRegion: string;
  field: string;
  quantity: PhysicalQuantity;
  provenance?: string;
}

export interface PhysicsField {
  fieldId: string;
  name: string;
  quantityDimension: string;
  locationType: 'NODAL' | 'ELEMENTAL' | 'SURFACE' | 'VOLUME';
  domain: PhysicsDomain;
  source?: string;
  status: string;
}

export interface PhysicsRegion {
  regionId: string;
  geometryReference: GeometryReference;
  materialReference?: MaterialReference;
  fieldAssignments: string[]; // fieldIds
  boundaryAssignments: string[]; // boundaryConditionIds
}

export interface PhysicsInterface {
  interfaceId: string;
  domainA: PhysicsDomain;
  domainB: PhysicsDomain;
  regionA: string;
  regionB: string;
  couplingType: 'ONE_WAY' | 'TWO_WAY' | 'CONSERVATIVE';
}

export interface PhysicsDependency {
  id: string;
  type: 'CAD' | 'MESH' | 'MATERIAL' | 'BC' | 'IC' | 'SOLVER_CONTRACT' | 'PREVIOUS_RESULT';
  artifactHash: string;
  required: boolean;
}

export interface PhysicsModelMetadata {
  description?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface PhysicsEvidence {
  evidenceId: string;
  modelId: string;
  modelVersion: string;
  validatedAt: string;
  inputReferences: string[];
  validationResults: string[];
  canonicalHash: string;
  capabilities: Record<string, string>;
  tests: string[];
  adversarialTests: string[];
  verdict: 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID';
  limitations: string[];
}
