/**
 * SECP Geometry Types
 * Defines the fundamental geometric types used by the SECP Geometry API.
 */

export enum ShapeType {
  VERTEX = 'VERTEX',
  EDGE = 'EDGE',
  WIRE = 'WIRE',
  FACE = 'FACE',
  SHELL = 'SHELL',
  SOLID = 'SOLID',
  COMPOUND = 'COMPOUND'
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Plane {
  origin: Vector3;
  normal: Vector3;
}

export interface BoundingBox {
  min: Vector3;
  max: Vector3;
}

/**
 * Context for deterministic geometry identity
 */
export interface IdentityContext {
  featureId: string;
  revision: number;
  operation: string;
  parameters: any;
  parentHash?: string;
  kernelVersion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  messages: string[];
  topologyErrors: string[];
  geometricErrors: string[];
}

export interface MeshResult {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  uvs?: Float32Array;
  faceIds?: Uint32Array;
}

export interface StepFidelityReport {
  ap203: 'VERIFIED' | 'NOT_VERIFIED';
  ap214: 'VERIFIED' | 'NOT_VERIFIED';
  ap242: 'VERIFIED' | 'NOT_VERIFIED';
  roundTrip: {
    volumeDelta: number;
    surfaceAreaDelta: number;
    centroidDelta: number;
    topologyMatch: boolean;
    validityMatch: boolean;
  };
}

export interface KernelManifest {
  kernel: string;
  binding: string;
  version: string;
  buildId: string;
  wasmChecksum: string;
  runtimeMode: 'WASM' | 'JS';
  mockFallback: boolean;
  capabilities: string[];
}

export interface ShapeIdentity {
  shapeId: string;
  featureId: string;
  revision: number;
  kernel: string;
  geometryHash: string;
  topologyHash: string;
}

export interface TopologyReference {
  entityType: ShapeType;
  persistentId: string;
  sourceFeatureId: string;
  geometrySignature: string;
  topologySignature: string;
}

export interface GeometryProvenance {
  featureId: string;
  revision: number;
  operation: string;
  parentShapeHash: string;
  outputShapeHash: string;
  kernel: string;
  kernelVersion: string;
  parametersHash: string;
  createdAt: string;
}

export interface GeometricProperties {
  volume?: number;
  surfaceArea?: number;
  centerOfMass?: Vector3;
  inertiaTensor?: number[][];
  vertexCount?: number;
  edgeCount?: number;
  faceCount?: number;
  shellCount?: number;
  solidCount?: number;
  isValid?: boolean;
  validationMessages?: string[];
}
