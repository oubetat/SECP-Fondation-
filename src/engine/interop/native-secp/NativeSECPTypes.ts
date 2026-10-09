/**
 * SECP Industrial OS v2 — Phase 3: Industrial CAD Interoperability
 * PATCH-039: Native SECP Engineering File Format
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Canonical, versioned, integrity-aware native engineering representation.
 * 2. Preserves SECP's engineering model without loss caused by interchange formats.
 * 3. Integrates with:
 *    - PATCH-008 (Canonical Engineering Identity)
 *    - PATCH-009 (Canonical Serialization)
 *    - PATCH-010 (Engineering Hash Chain)
 *    - PATCH-011..014 (Evidence, Verification, Provenance, Tamper-Evidence)
 * 4. Explicit entity classification: SUPPORTED | PARTIAL | UNSUPPORTED | INVALID.
 * 5. Strict determinism: zero timestamp/clock injection into canonical content.
 */

import { EngineeringIdentity } from '../../identity/CanonicalEngineeringIdentity';
import { ProvenanceNode, ProvenanceEdge } from '../../provenance/ProvenanceGraphTypes';

export type NativeSECPFormatIdentifier = 'SECP-NATIVE';

export type EntityClassification =
  | 'SUPPORTED'
  | 'PARTIAL'
  | 'UNSUPPORTED'
  | 'INVALID';

export type NativeSECPDiagnosticSeverity =
  | 'INFO'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL';

export type NativeSECPDiagnosticCategory =
  | 'FORMAT'
  | 'HEADER'
  | 'IDENTITY'
  | 'GEOMETRY'
  | 'TOPOLOGY'
  | 'BREP'
  | 'NURBS'
  | 'FEATURE'
  | 'PARAMETRIC'
  | 'SKETCH'
  | 'ASSEMBLY'
  | 'MANUFACTURING'
  | 'PROVENANCE'
  | 'INTEGRITY'
  | 'COMPATIBILITY'
  | 'REVISION';

export interface NativeSECPDiagnostic {
  readonly code: string;
  readonly severity: NativeSECPDiagnosticSeverity;
  readonly category: NativeSECPDiagnosticCategory;
  readonly message: string;
  readonly entityId?: string;
  readonly entityType?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface NativeSECPUnitSystem {
  readonly length: 'MILLIMETRE' | 'METRE' | 'INCH' | 'MICRON';
  readonly angle: 'RADIAN' | 'DEGREE';
  readonly mass: 'KILOGRAM' | 'GRAM' | 'POUND';
  readonly time: 'SECOND' | 'MILLISECOND';
  readonly scaleFactorToMm: number;
}

export interface NativeSECPCoordinateConvention {
  readonly handedness: 'RIGHT_HANDED' | 'LEFT_HANDED';
  readonly upVector: readonly [number, number, number];
  readonly forwardVector: readonly [number, number, number];
}

export interface NativeSECPToleranceMetadata {
  readonly linear: number;
  readonly angular: number;
  readonly nurbsDeviation: number;
  readonly booleanTolerance: number;
}

export interface NativeSECPHeader {
  readonly formatId: NativeSECPFormatIdentifier;
  readonly formatVersion: string;
  readonly schemaVersion: string;
  readonly applicationVersion: string;
  readonly generator: string;
  readonly createdAt: string;
  readonly modifiedAt: string;
  readonly units: NativeSECPUnitSystem;
  readonly coordinateConvention: NativeSECPCoordinateConvention;
  readonly tolerance: NativeSECPToleranceMetadata;
  readonly customMetadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface NativeSECPEngineeringIdentity {
  readonly engineeringObjectId: string;
  readonly revisionId: string;
  readonly parentRevisionId?: string;
  readonly canonicalIdentity: EngineeringIdentity;
}

/* ---------------- GEOMETRY & TOPOLOGY ---------------- */

export interface NativePoint3D {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface NativeVector3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface NativeNurbsControlPoint extends NativePoint3D {
  readonly w: number; // weights MUST be explicitly represented
}

export interface NativeNurbsCurve {
  readonly id: string;
  readonly degree: number;
  readonly knots: readonly number[];
  readonly controlPoints: readonly NativeNurbsControlPoint[];
  readonly parameterRange: readonly [number, number];
  readonly isPeriodic: boolean;
  readonly isRational: boolean;
}

export interface NativeNurbsSurface {
  readonly id: string;
  readonly degreeU: number;
  readonly degreeV: number;
  readonly knotsU: readonly number[];
  readonly knotsV: readonly number[];
  readonly controlPoints: readonly (readonly NativeNurbsControlPoint[])[];
  readonly parameterRangeU: readonly [number, number];
  readonly parameterRangeV: readonly [number, number];
  readonly isRational: boolean;
}

export interface NativeAnalyticCurve {
  readonly id: string;
  readonly type: 'LINE' | 'CIRCLE' | 'ELLIPSE' | 'HYPERBOLA' | 'PARABOLA';
  readonly origin: NativePoint3D;
  readonly direction: NativeVector3D;
  readonly radius?: number;
  readonly minorRadius?: number;
}

export interface NativeAnalyticSurface {
  readonly id: string;
  readonly type: 'PLANE' | 'CYLINDER' | 'CONE' | 'SPHERE' | 'TORUS';
  readonly origin: NativePoint3D;
  readonly normal: NativeVector3D;
  readonly radius?: number;
  readonly minorRadius?: number;
  readonly semiAngleRad?: number;
}

export interface NativeVertex {
  readonly id: string;
  readonly pointId: string;
  readonly tolerance: number;
}

export interface NativeEdge {
  readonly id: string;
  readonly startVertexId: string;
  readonly endVertexId: string;
  readonly curveId: string;
  readonly parameterRange: readonly [number, number];
  readonly orientation: 'FORWARD' | 'REVERSED';
  readonly tolerance: number;
}

export interface NativeLoop {
  readonly id: string;
  readonly edgeIds: readonly string[];
  readonly isOuter: boolean;
}

export interface NativeFace {
  readonly id: string;
  readonly surfaceId: string;
  readonly outerLoopId: string;
  readonly innerLoopIds: readonly string[];
  readonly orientation: 'FORWARD' | 'REVERSED';
  readonly tolerance: number;
}

export interface NativeShell {
  readonly id: string;
  readonly faceIds: readonly string[];
  readonly isClosed: boolean;
}

export interface NativeBRepSolid {
  readonly id: string;
  readonly name: string;
  readonly outerShellId: string;
  readonly voidShellIds: readonly string[];
  readonly boundingBox: {
    readonly min: NativePoint3D;
    readonly max: NativePoint3D;
  };
  readonly volumeMm3?: number;
  readonly surfaceAreaMm2?: number;
  readonly centerOfGravity?: NativePoint3D;
}

export interface NativeModelGeometry {
  readonly points: readonly NativePoint3D[];
  readonly analyticCurves: readonly NativeAnalyticCurve[];
  readonly nurbsCurves: readonly NativeNurbsCurve[];
  readonly analyticSurfaces: readonly NativeAnalyticSurface[];
  readonly nurbsSurfaces: readonly NativeNurbsSurface[];
}

export interface NativeModelTopology {
  readonly vertices: readonly NativeVertex[];
  readonly edges: readonly NativeEdge[];
  readonly loops: readonly NativeLoop[];
  readonly faces: readonly NativeFace[];
  readonly shells: readonly NativeShell[];
  readonly solids: readonly NativeBRepSolid[];
}

/* ---------------- FEATURES & PARAMETRIC ---------------- */

export interface NativeFeatureInput {
  readonly name: string;
  readonly type: 'NUMBER' | 'STRING' | 'BOOLEAN' | 'VECTOR' | 'ENTITY_REF' | 'JSON';
  readonly value: string | number | boolean | readonly number[] | Readonly<Record<string, unknown>>;
}

export interface NativeFeatureOutput {
  readonly topologyId: string;
  readonly role: string;
}

export interface NativeFeatureDependency {
  readonly dependsOnFeatureId: string;
  readonly dependencyType: 'REFERENCE' | 'TOPOLOGICAL' | 'GEOMETRICAL' | 'TEMPORAL';
}

export interface NativeFeatureNode {
  readonly featureId: string;
  readonly name: string;
  readonly featureType: string;
  readonly creationOrder: number;
  readonly inputs: readonly NativeFeatureInput[];
  readonly outputs: readonly NativeFeatureOutput[];
  readonly dependencies: readonly NativeFeatureDependency[];
  readonly suppressionState: 'ACTIVE' | 'SUPPRESSED';
}

export interface NativeParametricGraph {
  readonly features: readonly NativeFeatureNode[];
  readonly executionOrder: readonly string[];
  readonly isValid: boolean;
}

/* ---------------- SKETCHES ---------------- */

export interface NativeSketchEntity {
  readonly id: string;
  readonly type: 'POINT' | 'LINE' | 'ARC' | 'CIRCLE' | 'SPLINE' | 'ELLIPSE';
  readonly construction: boolean;
  readonly parameters: Readonly<Record<string, number | readonly number[]>>;
}

export interface NativeSketchConstraint {
  readonly id: string;
  readonly type: string;
  readonly entityIds: readonly string[];
  readonly value?: number;
  readonly expression?: string;
}

export interface NativeSketch {
  readonly id: string;
  readonly name: string;
  readonly planeSurfaceId: string;
  readonly origin: NativePoint3D;
  readonly axisX: NativeVector3D;
  readonly axisY: NativeVector3D;
  readonly entities: readonly NativeSketchEntity[];
  readonly constraints: readonly NativeSketchConstraint[];
}

/* ---------------- ASSEMBLIES ---------------- */

export interface NativeTransform3D {
  readonly matrix: readonly [
    number, number, number, number,
    number, number, number, number,
    number, number, number, number,
    number, number, number, number
  ];
}

export interface NativeComponentInstance {
  readonly id: string;
  readonly name: string;
  readonly componentType: 'PART' | 'SUBASSEMBLY';
  readonly partDefinitionId: string;
  readonly parentAssemblyId: string;
  readonly transform: NativeTransform3D;
  readonly isFixed: boolean;
  readonly suppressionState: 'ACTIVE' | 'SUPPRESSED';
}

export interface NativeAssemblyMate {
  readonly id: string;
  readonly name: string;
  readonly mateType: string;
  readonly firstInstanceId: string;
  readonly firstTopologyPath: string;
  readonly secondInstanceId: string;
  readonly secondTopologyPath: string;
  readonly offset?: number;
  readonly angleRad?: number;
}

export interface NativeAssemblyNode {
  readonly id: string;
  readonly name: string;
  readonly isRoot: boolean;
  readonly childInstanceIds: readonly string[];
  readonly subassemblyIds: readonly string[];
  readonly revision: number;
}

export interface NativeAssemblyModel {
  readonly nodes: readonly NativeAssemblyNode[];
  readonly instances: readonly NativeComponentInstance[];
  readonly mates: readonly NativeAssemblyMate[];
}

/* ---------------- FULL MODEL ---------------- */

export interface NativeSECPModel {
  readonly geometry: NativeModelGeometry;
  readonly topology: NativeModelTopology;
  readonly features: NativeParametricGraph;
  readonly sketches: readonly NativeSketch[];
  readonly assemblies: NativeAssemblyModel;
}

/* ---------------- MANUFACTURING ---------------- */

export interface NativeManufacturingFeature {
  readonly id: string;
  readonly featureType: 'HOLE' | 'POCKET' | 'SLOT' | 'BOSS' | 'CHAMFER' | 'FILLET' | 'THREAD' | 'SURFACE_FINISH';
  readonly targetTopologyIds: readonly string[];
  readonly parameters: Readonly<Record<string, number | string | boolean>>;
}

export interface NativeToolpathReference {
  readonly id: string;
  readonly operationName: string;
  readonly toolId: string;
  readonly strategy: string;
  readonly targetFeatureIds: readonly string[];
  readonly toolpathHash?: string;
}

export interface NativeSECPManufacturing {
  readonly features: readonly NativeManufacturingFeature[];
  readonly toolpaths: readonly NativeToolpathReference[];
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
}

/* ---------------- PROVENANCE ---------------- */

export interface NativeProvenanceOperation {
  readonly operationId: string;
  readonly operationType: string;
  readonly timestamp: string;
  readonly author: string;
  readonly identityRef: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface NativeProvenanceRevision {
  readonly revisionId: string;
  readonly parentRevisionId?: string;
  readonly createdAt: string;
  readonly author: string;
  readonly changeSummary: string;
  readonly canonicalHash: string;
}

export interface NativeSECPProvenance {
  readonly source: string;
  readonly operations: readonly NativeProvenanceOperation[];
  readonly revisions: readonly NativeProvenanceRevision[];
  readonly graphNodes: readonly ProvenanceNode[];
  readonly graphEdges: readonly ProvenanceEdge[];
}

/* ---------------- INTEGRITY ---------------- */

export interface NativeSECPIntegrity {
  readonly canonicalHash: string;
  readonly artifactHash: string;
  readonly parentHash?: string;
  readonly canonicalizationVersion: string;
  readonly hashAlgorithm: 'SHA-256';
  readonly integrityStatus: 'UNVERIFIED' | 'VALID' | 'TAMPERED' | 'CORRUPTED';
  readonly evidenceReferences: readonly string[];
}

/* ---------------- COMPATIBILITY ---------------- */

export interface NativeSECPCompatibility {
  readonly stepAp242Mapping?: {
    readonly status: EntityClassification;
    readonly entityCount: number;
    readonly mappingDetails: Readonly<Record<string, string>>;
  };
  readonly igesMapping?: {
    readonly status: EntityClassification;
    readonly entityCount: number;
    readonly mappingDetails: Readonly<Record<string, string>>;
  };
  readonly jtMapping?: {
    readonly status: EntityClassification;
    readonly entityCount: number;
    readonly mappingDetails: Readonly<Record<string, string>>;
  };
  readonly diagnostics: readonly NativeSECPDiagnostic[];
}

/* ---------------- COMPLETE DOCUMENT ---------------- */

export interface NativeSECPDocument {
  readonly header: NativeSECPHeader;
  readonly identity: NativeSECPEngineeringIdentity;
  readonly model: NativeSECPModel;
  readonly manufacturing: NativeSECPManufacturing;
  readonly provenance: NativeSECPProvenance;
  readonly integrity: NativeSECPIntegrity;
  readonly compatibility: NativeSECPCompatibility;
}

export interface NativeSECPDocumentInput {
  readonly header: Omit<NativeSECPHeader, 'formatId' | 'formatVersion' | 'schemaVersion'> & {
    readonly formatId?: NativeSECPFormatIdentifier;
    readonly formatVersion?: string;
    readonly schemaVersion?: string;
  };
  readonly identity: NativeSECPEngineeringIdentity;
  readonly model: NativeSECPModel;
  readonly manufacturing?: NativeSECPManufacturing;
  readonly provenance?: NativeSECPProvenance;
  readonly integrity?: Partial<NativeSECPIntegrity>;
  readonly compatibility?: NativeSECPCompatibility;
}
