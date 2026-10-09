/**
 * SECP Industrial OS v2 — Boolean Adversarial Battery (PATCH-172)
 * Comprehensive Type System & Contracts
 */

import { TopoShape, Solid, Face, Edge, Vertex, TopoShapeEnum, Orientation } from '../../cad-kernel/topology/TopologyContracts';
import { BooleanOperation, ClassificationState } from '../../cad-kernel/boolean/BooleanTypes';
import { GeometricToleranceModel } from '../../cad-kernel/predicates/GeometricTolerance';

export type AdversarialVerdict =
  | 'PASS'
  | 'FAIL'
  | 'UNPROVEN'
  | 'INVALID_INPUT'
  | 'DEGENERATE_INPUT'
  | 'NUMERICAL_FAILURE'
  | 'TOPOLOGY_FAILURE'
  | 'NON_DETERMINISTIC'
  | 'TIMEOUT'
  | 'RESOURCE_EXHAUSTED'
  | 'UNSUPPORTED'
  | 'SKIPPED';

export type AdversarialCategory =
  | 'A_BASIC_BOOLEAN'
  | 'B_TANGENCY_CASES'
  | 'C_COINCIDENT_GEOMETRY'
  | 'D_NEAR_DEGENERATE_GEOMETRY'
  | 'E_NESTED_SOLIDS'
  | 'F_COMPLEX_CHAINS'
  | 'G_REPEATED_OPERATIONS'
  | 'H_RANDOMIZED_ADVERSARIAL';

export type StressScale = 'SMALL' | 'MEDIUM' | 'LARGE' | 'EXTREME';

export interface BoundingBox3D {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

export interface IndependentTopologyReport {
  isClosedShell: boolean;
  isManifold: boolean;
  eulerCharacteristic: number; // V - E + F (should be 2 for a single genus-0 solid)
  genus: number;
  faceOrientationConsistent: boolean;
  edgeConnectivityValid: boolean;
  vertexConsistencyValid: boolean;
  orphanVertexCount: number;
  orphanEdgeCount: number;
  orphanFaceCount: number;
  danglingTopologyCount: number;
  nonManifoldEdgeCount: number;
  invertedShellsCount: number;
  selfIntersectionsCount: number;
  duplicateFaceCount: number;
  connectedComponentsCount: number;
  issues: string[];
}

export interface GeometricInvariantsReport {
  expectedVolume: number | null;
  actualVolume: number | null;
  volumeError: number | null;
  relativeVolumeError: number | null;
  expectedSurfaceArea: number | null;
  actualSurfaceArea: number | null;
  invariantsSatisfied: boolean;
  satisfiesInclusionExclusion: boolean; // V(A u B) = V(A) + V(B) - V(A n B)
  satisfiesDifferenceBounds: boolean;   // 0 <= V(A - B) <= V(A)
  satisfiesIntersectionBounds: boolean; // 0 <= V(A n B) <= min(V(A), V(B))
  details: string[];
}

export interface AdversarialMetrics {
  wallTimeMs: number;
  heapMemoryBytesDelta: number;
  vertexCount: number;
  edgeCount: number;
  faceCount: number;
  shellCount: number;
  solidCount: number;
  iterationCount: number;
  measurementMethod: 'DIRECTLY_MEASURED';
  timestamp: string;
}

export interface BooleanEvidenceRecord {
  testId: string;
  seed: number;
  operation: BooleanOperation;
  category: AdversarialCategory;
  operandAIdentity: string;
  operandBIdentity: string;
  inputHash: string;
  kernelVersion: string;
  tolerance: GeometricToleranceModel;
  executionTimeMs: number;
  resultTopologyHash: string;
  resultGeometryHash: string;
  volume: number;
  surfaceArea: number;
  boundingBox: BoundingBox3D;
  invariants: GeometricInvariantsReport;
  topologyValidation: IndependentTopologyReport;
  determinismResult: {
    isDeterministic: boolean;
    passCount: number;
    driftCount: number;
    hashes: string[];
  };
  verdict: AdversarialVerdict;
  diagnostics: string[];
  ledgerTimestamp: string;
  attestationSignature: string;
}

export interface AdversarialTestCase {
  id: string;
  name: string;
  category: AdversarialCategory;
  description: string;
  operation: BooleanOperation;
  generator: (seed: number) => {
    operandA: TopoShape | any;
    operandB: TopoShape | any;
    expectedBehavior: {
      canSucceed: boolean;
      expectedVolume?: number;
      expectedSurfaceArea?: number;
      expectedTopology?: { vertices?: number; edges?: number; faces?: number };
      isDisjoint?: boolean;
      isCoincident?: boolean;
      isNested?: boolean;
      isTangent?: boolean;
      isNearDegenerate?: boolean;
    };
  };
  isAdversarial: boolean;
  threatModel: string;
  expectedVerdict: AdversarialVerdict | AdversarialVerdict[];
}

export interface AdversarialBatteryReport {
  batteryId: string;
  title: string;
  kernelVersion: string;
  timestamp: string;
  overallVerdict: AdversarialVerdict;
  totalCases: number;
  passedCount: number;
  failedCount: number;
  unprovenCount: number;
  invalidInputCount: number;
  degenerateInputCount: number;
  numericalFailureCount: number;
  topologyFailureCount: number;
  unsupportedCount: number;
  skippedCount: number;
  nonDeterministicCount: number;
  timeoutCount: number;
  passRatePercent: number;
  totalDurationMs: number;
  determinismScore: number;
  topologyIntegrityScore: number;
  geometricInvariantScore: number;
  antiFabricationScore: number;
  categoryBreakdown: Record<AdversarialCategory, {
    total: number;
    passed: number;
    failed: number;
    unproven: number;
    unsupported: number;
    skipped: number;
    invalid: number;
    avgDurationMs: number;
  }>;
  evidenceLedger: BooleanEvidenceRecord[];
  stressReport: {
    scale: StressScale;
    casesExecuted: number;
    avgLatencyMs: number;
    peakHeapMb: number;
    failureRate: number;
  }[];
  mutationReport: {
    mutationsInjected: number;
    mutationsDetected: number;
    detectionRatePercent: number;
    falseAcceptanceCount: number;
    details?: Array<{ mutationType: string; mutationDescription: string; detected: boolean; detectedIssues: string[] }>;
  };
}
