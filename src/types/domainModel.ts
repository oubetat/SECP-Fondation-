/**
 * PATCH-SECP-001 — Engineering Domain Model
 * Core entities for SECP Platform.
 * ARCHITECTURE RULE: Metadata is stored in PostgreSQL; 3D Geometry is stored in Object Storage via `geometryRef`.
 */

export interface Parameter {
  id: string;
  name: string;
  value: number;
  unit: string; // e.g. 'mm', 'N', 'MPa'
  expression?: string; // e.g. 'Width * 0.5'
  description?: string;
}

export interface Constraint {
  id: string;
  type: 'DIMENSIONAL' | 'GEOMETRIC' | 'ASSEMBLY_MATE';
  name: string;
  kind:
    | 'HORIZONTAL'
    | 'VERTICAL'
    | 'PARALLEL'
    | 'PERPENDICULAR'
    | 'COINCIDENT'
    | 'TANGENT'
    | 'EQUAL'
    | 'DISTANCE'
    | 'ANGLE'
    | 'RADIUS'
    | 'DIAMETER'
    | 'CONCENTRIC'
    | 'FIXED';
  targetEntityIds: string[];
  value?: number;
  unit?: string;
  satisfied: boolean;
}

export interface Feature {
  id: string;
  name: string;
  type: 'SKETCH' | 'PAD_EXTRUDE' | 'REVOLVE' | 'FILLET' | 'CHAMFER' | 'HOLE' | 'POCKET' | 'BOOLEAN_CUT' | 'BOOLEAN_FUSE';
  parameters: Parameter[];
  dependencies: string[]; // Parent Feature IDs in Parametric DAG
  inputGeometryRef?: string;
  outputGeometryRef?: string; // Geometry stored in Object Storage
  revisionNumber: number;
  suppressed: boolean;
}

export interface Material {
  id: string;
  name: string;
  category: 'STEEL' | 'ALUMINUM' | 'TITANIUM' | 'PLASTIC' | 'COMPOSITE' | 'COPPER_BRASS' | 'IRON';
  densityKgM3: number;          // Density (kg/m³)
  youngModulusGPa: number;      // Young Modulus / Elastic Modulus (GPa)
  poissonsRatio: number;        // Poisson Ratio
  yieldStrengthMPa: number;     // Yield Strength (MPa)
  thermalConductivityWMK: number; // Thermal Conductivity (W/m·K)
  specificHeatJKgK: number;     // Specific Heat Capacity (J/kg·K)
  expansionCoefficient1K: number; // Thermal Expansion Coefficient (1/K e.g. 12e-6)
  colorHex: string;
  description?: string;
}

export interface Part {
  id: string;
  name: string;
  revisionId: string;
  geometryRef?: string; // Stored in S3/Object Vault (NOT in Postgres!)
  materialId?: string;
  parameters: Parameter[];
  features: Feature[];
  massKg?: number;
  volumeM3?: number;
  surfaceAreaM2?: number;
}

export interface Component {
  id: string;
  name: string;
  partId?: string;
  subAssemblyId?: string;
  transformMatrix: number[]; // 4x4 matrix
  mates: Constraint[];
  colorHex?: string;
  visible: boolean;
}

export interface Assembly {
  id: string;
  name: string;
  revisionId: string;
  components: Component[];
  assemblyConstraints: Constraint[];
  totalMassKg: number;
  interferencesDetected: number;
}

export interface Product {
  id: string;
  name: string;
  code: string;
  rootAssemblyId: string;
  version: string;
}

export interface Document {
  id: string;
  title: string;
  type: 'CAD_STEP' | 'CAD_IGES' | 'DRAWING_PDF' | 'FEA_REPORT' | 'GCODE_NC';
  fileRef: string; // Object Storage URI
  byteSize: number;
  uploadedAt: string;
}

export interface Revision {
  id: string;
  entityType: 'PART' | 'ASSEMBLY' | 'PRODUCT';
  entityId: string;
  revisionCode: string; // e.g. "REV-A.1"
  author: string;
  timestamp: string;
  changeLog: string;
  checksum: string;
}

export interface Simulation {
  id: string;
  name: string;
  partOrAssemblyId: string;
  type: 'STATIC_STRUCTURAL' | 'MODAL_FREQUENCY' | 'THERMAL' | 'FLUID_CFD';
  meshNodeCount: number;
  meshElementCount: number;
  maxVonMisesStressMPa?: number;
  maxDisplacementMm?: number;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
}

export interface ManufacturingProcess {
  id: string;
  name: string;
  partId: string;
  type: 'CNC_MILLING_5AXIS' | 'LATHE_TURNING' | 'SLS_3D_PRINTING' | 'INJECTION_MOLDING';
  estimatedCycleTimeMin: number;
  gcodeDocumentRef?: string;
  toolList: string[];
  status: 'READY' | 'OPTIMIZING' | 'APPROVED';
}

export interface Project {
  id: string;
  name: string;
  code: string;
  description: string;
  products: Product[];
  documents: Document[];
  revisions: Revision[];
  createdAt: string;
  updatedAt: string;
}
