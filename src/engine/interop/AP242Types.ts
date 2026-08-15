/**
 * PATCH-SECP-080: STEP AP242 & Semantic PMI Data Model
 * 
 * Formal ISO 10303-242 (Managed Model-Based 3D Engineering) data structures
 * supporting B-Rep geometry, topological entities, dimensional tolerances,
 * geometric tolerances (GD&T), datum systems, surface finishes, and
 * bidirectional semantic associations.
 */

export type AP242DimensionType = 
  | 'LINEAR_DISTANCE'
  | 'DIAMETER'
  | 'RADIUS'
  | 'ANGULAR'
  | 'CURVE_LENGTH'
  | 'THICKNESS';

export type AP242ToleranceType = 
  | 'SYMMETRIC'
  | 'PLUS_MINUS'
  | 'LIMITS'
  | 'BASIC'
  | 'REFERENCE';

export type AP242GdtCharacteristic = 
  | 'FLATNESS'
  | 'STRAIGHTNESS'
  | 'CIRCULARITY'
  | 'CYLINDRICITY'
  | 'PROFILE_OF_A_LINE'
  | 'PROFILE_OF_A_SURFACE'
  | 'PARALLELISM'
  | 'PERPENDICULARITY'
  | 'ANGULARITY'
  | 'POSITION'
  | 'CONCENTRICITY'
  | 'COAXIALITY'
  | 'SYMMETRY'
  | 'CIRCULAR_RUNOUT'
  | 'TOTAL_RUNOUT';

export type AP242MaterialCondition = 'RFS' | 'MMC' | 'LMC';

export type AP242LengthUnit = 'MILLIMETRE' | 'INCH' | 'METRE';
export type AP242AngleUnit = 'RADIAN' | 'DEGREE';

export interface AP242Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface AP242BoundingBox {
  min: AP242Vector3D;
  max: AP242Vector3D;
}

export interface AP242Vertex {
  id: string;
  point: AP242Vector3D;
}

export interface AP242Edge {
  id: string;
  startVertexId: string;
  endVertexId: string;
  curveType: 'LINE' | 'CIRCLE' | 'B_SPLINE';
  lengthMm: number;
  midPoint?: AP242Vector3D;
}

export interface AP242Face {
  id: string;
  surfaceType: 'PLANE' | 'CYLINDER' | 'CONE' | 'SPHERE' | 'TORUS' | 'B_SPLINE_SURFACE';
  areaMm2: number;
  normal: AP242Vector3D;
  centerOfMass: AP242Vector3D;
  boundEdgeIds: string[];
  featureName?: string;
}

export interface AP242BRepSolid {
  solidId: string;
  name: string;
  volumeMm3: number;
  surfaceAreaMm2: number;
  centerOfGravity: AP242Vector3D;
  boundingBox: AP242BoundingBox;
  vertices: AP242Vertex[];
  edges: AP242Edge[];
  faces: AP242Face[];
}

export interface AP242DimensionTolerance {
  toleranceType: AP242ToleranceType;
  upperDeviationMm: number;
  lowerDeviationMm: number;
  decimalPlaces: number;
}

export interface AP242SemanticDimension {
  id: string;
  dimensionType: AP242DimensionType;
  nominalValue: number;
  unit: AP242LengthUnit | AP242AngleUnit;
  tolerance?: AP242DimensionTolerance;
  referencedGeometryIds: string[]; // Face/Edge/Vertex IDs
  annotationAnchor?: AP242Vector3D;
  description?: string;
  isCriticalToQuality: boolean;
}

export interface AP242DatumReference {
  datumLabel: string; // 'A', 'B', 'C'
  materialCondition: AP242MaterialCondition;
  order: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
}

export interface AP242DatumSystem {
  id: string;
  datumLabel: string; // e.g. "A", "B", "C"
  referencedFaceIds: string[];
  targetType: 'POINT' | 'LINE' | 'PLANE' | 'CYLINDER_AXIS';
  precedence?: number;
}

export interface AP242GeometricTolerance {
  id: string;
  characteristic: AP242GdtCharacteristic;
  toleranceValue: number;
  unit: AP242LengthUnit;
  hasDiameterModifier: boolean; // Ø zone
  materialCondition: AP242MaterialCondition;
  datumReferences: AP242DatumReference[];
  referencedGeometryIds: string[]; // Face/Edge/Vertex/Feature IDs
  projectedToleranceZoneMm?: number;
  compositeLowerToleranceValue?: number;
  description?: string;
  isCriticalToQuality: boolean;
}

export interface AP242SurfaceFinish {
  id: string;
  raMicrons: number;
  rzMicrons?: number;
  machiningAllowanceMm?: number;
  manufacturingProcess?: string;
  referencedFaceIds: string[];
}

export interface AP242UnitSystem {
  lengthUnit: AP242LengthUnit;
  angleUnit: AP242AngleUnit;
  lengthConversionToMm: number;
  angleConversionToRad: number;
}

export interface AP242Header {
  fileDescription: string;
  fileName: string;
  timestamp: string;
  author: string;
  organization: string;
  schemaVersion: 'AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF' | 'AP203' | 'AP214';
  originatingSystem: string;
}

export interface AP242SemanticModel {
  header: AP242Header;
  unitSystem: AP242UnitSystem;
  solids: AP242BRepSolid[];
  dimensions: AP242SemanticDimension[];
  geometricTolerances: AP242GeometricTolerance[];
  datums: AP242DatumSystem[];
  surfaceFinishes: AP242SurfaceFinish[];
  metadata: Record<string, string>;
  modelHash?: string;
}

export type SemanticEntityStatus = 
  | 'PRESERVED'
  | 'MODIFIED'
  | 'LOST'
  | 'UNSUPPORTED'
  | 'INVALID';

export interface SemanticRetentionItem {
  entityId: string;
  entityType: 'DIMENSION' | 'GDT' | 'DATUM' | 'SURFACE_FINISH' | 'GEOMETRY_ASSOCIATION';
  status: SemanticEntityStatus;
  nominalDelta?: number;
  toleranceDelta?: number;
  referenceValid: boolean;
  notes?: string;
}

export interface SemanticRetentionReport {
  totalExpectedEntities: number;
  preservedEntities: number;
  modifiedEntities: number;
  lostEntities: number;
  unsupportedEntities: number;
  invalidEntities: number;
  retentionRatio: number; // 0.0 to 1.0 (1.0 = 100%)
  details: SemanticRetentionItem[];
}
