export enum CollisionStatus {
  NO_COLLISION = 'NO_COLLISION',
  CONTACT = 'CONTACT',
  CLEARANCE_VIOLATION = 'CLEARANCE_VIOLATION',
  PENETRATION = 'PENETRATION',
  HOLDER_COLLISION = 'HOLDER_COLLISION',
  FIXTURE_COLLISION = 'FIXTURE_COLLISION',
  MACHINE_COLLISION = 'MACHINE_COLLISION',
  STOCK_COLLISION = 'STOCK_COLLISION',
  GOUGE = 'GOUGE',
  INTERFERENCE = 'INTERFERENCE',
  INVALID_GEOMETRY = 'INVALID_GEOMETRY',
  ANALYSIS_FAILED = 'ANALYSIS_FAILED',
  UNKNOWN = 'UNKNOWN',
  UNSUPPORTED = 'UNSUPPORTED',
  TIMEOUT = 'TIMEOUT',
  NUMERICAL_FAILURE = 'NUMERICAL_FAILURE',
  AMBIGUOUS = 'AMBIGUOUS'
}

export enum CollisionSeverity {
  NONE = 'NONE',
  CLEARANCE_WARNING = 'CLEARANCE_WARNING',
  CRITICAL_COLLISION = 'CRITICAL_COLLISION',
  FATAL_FAILURE = 'FATAL_FAILURE',
  ERROR = 'ERROR'
}

export enum CollisionExactness {
  EXACT = 'EXACT',
  CONSERVATIVE = 'CONSERVATIVE',
  SAMPLED = 'SAMPLED',
  APPROXIMATE = 'APPROXIMATE',
  UNSUPPORTED = 'UNSUPPORTED'
}

export interface Vector3DImmutable {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Triangle3DExact {
  v0: Vector3DImmutable;
  v1: Vector3DImmutable;
  v2: Vector3DImmutable;
  a?: Vector3DImmutable;
  b?: Vector3DImmutable;
  c?: Vector3DImmutable;
  id?: string;
}

export interface CanonicalCollisionGeometry {
  documentId?: string;
  revisionId?: string;
  geometryId?: string;
  geometryRevision?: number;
  snapshotId?: string;
  topologyIdentity?: string;
  geometrySource?: 'CAD' | 'STEP' | 'IGES' | 'BREP' | 'MESH' | 'SYNTHETIC';
  provenance?: string;
  coordinateFrame?: 'WCS' | 'MCS' | 'TCS';
  units?: 'MILLIMETERS' | 'INCHES';
  bounds?: { min: Vector3DImmutable; max: Vector3DImmutable };
  geometryHash?: string;
  tessellatedTriangles?: Triangle3DExact[] | any[];
}

export interface MotionSegmentContract {
  startTcp: Vector3DImmutable;
  startOrientation: Vector3DImmutable;
  endTcp: Vector3DImmutable;
  endOrientation: Vector3DImmutable;
  motionType: 'RAPID' | 'FEED' | 'TRANSITION' | 'LOCKED';
}

export interface ToolAssemblyContract {
  cutterDiameterMm: number;
  fluteLengthMm: number;
  stickoutMm: number;
  shankDiameterMm: number;
  holderLowerDiameterMm?: number;
  holderUpperDiameterMm?: number;
  holderGaugeLengthMm?: number;
  holderDiameterMm?: number;
  holderLengthMm?: number;
  spindleNoseDiameterMm?: number;
}

export interface CanonicalCollisionInput {
  domain: 'ASSEMBLY' | 'CAM_MULTI_AXIS' | 'KINEMATIC_MECHANISM' | 'NC_SIMULATION';
  coordinateFrame: 'WCS' | 'MCS' | 'TCS';
  units: 'MILLIMETERS' | 'INCHES';
  toleranceProfile: {
    linearToleranceMm: number;
    angularToleranceDeg: number;
    clearanceWarningMarginMm: number;
    safeClearanceMarginMm: number;
  };
  canonicalGeometry?: CanonicalCollisionGeometry;
  geometry?: CanonicalCollisionGeometry;
  toolAssembly?: ToolAssemblyContract;
  motionSegment?: MotionSegmentContract;
  executionId?: string;
  cadRevisionId?: string;
  documentId?: string;
  geometryId?: string;
  snapshotId?: string;
}

export interface ContactPointImmutable {
  readonly positionWCS: Vector3DImmutable;
  readonly normalWCS: Vector3DImmutable;
  readonly penetrationDepthMm: number;
  readonly entityIdA: string;
  readonly entityIdB: string;
}

export interface CollisionMetricsImmutable {
  readonly minClearanceMm: number;
  readonly maxPenetrationDepthMm: number;
  readonly volumetricInterferenceMm3: number;
  readonly minimumSeparationMm?: number;
  readonly penetrationDepthMm?: number;
}

export interface CanonicalCollisionResult {
  readonly executionId: string;
  readonly timestampIso: string;
  readonly status: CollisionStatus;
  readonly severity: CollisionSeverity;
  readonly exactness: CollisionExactness;
  readonly metrics: CollisionMetricsImmutable;
  readonly contactManifold: ReadonlyArray<ContactPointImmutable>;
  readonly temporalInfo: {
    readonly timeOfImpactNormalized: number | null;
    readonly timeOfImpact?: number | null;
    readonly criticalSubStepIndex: number | null;
    readonly criticalPoseDescription?: string;
  };
  readonly failureState: {
    readonly isFailed: boolean;
    readonly failureReason: string | null;
    readonly exceptionType?: string;
    readonly kernelErrorCode?: string;
  };
  readonly provenance: {
    readonly cadDocumentRevisionId?: string;
    readonly geometryHash?: string;
    readonly toolDefinitionId?: string;
    readonly holderDefinitionId?: string;
    readonly machineModelId?: string;
    readonly fixtureDefinitionId?: string;
    readonly stockModelId?: string;
    readonly algorithmVersion: string;
  };
  readonly diagnostics: ReadonlyArray<string>;
  readonly provenSafe: boolean;
}

export interface CollisionCapabilityDeclaration {
  readonly providerId: string;
  readonly providerName: string;
  readonly algorithmVersion: string;
  readonly exactnessLevel: CollisionExactness;
  readonly limitations: ReadonlyArray<string>;
  readonly supportsStaticCollision: boolean;
  readonly supportsContinuousCollision: boolean;
  readonly supportsMeshMesh: boolean;
  readonly supportsToolStock: boolean;
  readonly supportsToolFixture: boolean;
  readonly supportsHolderCollision: boolean;
  readonly supportsMachineCollision: boolean;
  readonly supportsBRep: boolean;
  readonly supportsGouge: boolean;
  readonly supportsClearance: boolean;
}

export interface RawProviderResult {
  status: CollisionStatus;
  severity?: CollisionSeverity;
  minClearanceMm?: number;
  maxPenetrationDepthMm?: number;
  volumetricInterferenceMm3?: number;
  timeOfImpact?: number;
  criticalStep?: number;
  failureReason?: string;
  diagnostics?: string[];
  contacts?: Array<{
    position: Vector3DImmutable;
    normal: Vector3DImmutable;
    penetrationDepth: number;
    entityIdA: string;
    entityIdB: string;
  }>;
}

export interface CollisionProvider {
  readonly capabilities: CollisionCapabilityDeclaration;
  evaluate(input: CanonicalCollisionInput): Promise<RawProviderResult> | RawProviderResult;
}
