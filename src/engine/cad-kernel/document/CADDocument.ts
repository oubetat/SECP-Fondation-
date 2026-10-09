import { Solid } from '../topology/TopologyContracts';

export type UnitSystemStandard = 'SI_MM' | 'SI_M' | 'US_INCH' | 'US_FOOT' | 'CGS';
export type LengthUnit = 'mm' | 'm' | 'cm' | 'inch' | 'in' | 'ft';
export type AngleUnit = 'deg' | 'rad';
export type MassUnit = 'kg' | 'g' | 'lbm' | 'slug';
export type ForceUnit = 'N' | 'kN' | 'lbf';
export type PressureUnit = 'MPa' | 'Pa' | 'kPa' | 'psi' | 'bar';

export interface UnitSystem {
  system?: UnitSystemStandard;
  length: LengthUnit;
  angle: AngleUnit;
  mass?: MassUnit;
  force?: ForceUnit;
  pressure?: PressureUnit;
  time?: 's' | 'ms';
  temperature?: 'C' | 'K' | 'F';
}

export const DEFAULT_UNIT_SYSTEM_MM: UnitSystem = {
  system: 'SI_MM',
  length: 'mm',
  angle: 'deg',
  mass: 'kg',
  force: 'N',
  pressure: 'MPa'
};

export type AssemblyTopologyEntityType = 'FACE' | 'EDGE' | 'VERTEX' | 'DATUM' | 'AXIS' | 'PLANE';

export interface AssemblyTopologyReference {
  occurrencePath: string;
  entityType: AssemblyTopologyEntityType;
  entityId: string;
}

export interface TopologyLineageEntry {
  topologyId: string;
  type?: string;
  predecessorTopologyIds?: string[];
  [key: string]: any;
}

export interface TopologyLineage {
  documentId?: string;
  version?: number;
  entries?: Record<string, TopologyLineageEntry> | Map<string, TopologyLineageEntry>;
  faceMap?: Record<string, any>;
  edgeMap?: Record<string, any>;
  vertexMap?: Record<string, any>;
}

export interface AssemblyInstance {
  id?: string;
  instanceId: string;
  name?: string;
  type?: string;
  documentId?: string;
  partId?: string;
  partDefinitionId?: string;
  parentAssemblyId?: string;
  parentId?: string;
  activeConfigurationId?: string;
  geometryReference?: string;
  geometryStatus?: 'MODELED' | 'UNMODELED' | 'IMPORTED' | 'PRIMITIVE' | string;
  visible?: boolean;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  transform?: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  } | any;
  matrix?: number[];
  colorHex?: string;
  color?: string;
  material?: string | { id?: string; name?: string; [key: string]: any };
  isSuppressed?: boolean;
  suppressed?: boolean;
  suppressionState?: 'ACTIVE' | 'SUPPRESSED';
  isGrounded?: boolean;
  grounded?: boolean;
  isFixed?: boolean;
  persistentTopologyPath?: string;
  subAssemblyDocumentId?: string;
  evaluatedSolid?: Solid;
  evaluatedMesh?: any;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export interface AssemblyMate {
  id?: string;
  mateId: string;
  name?: string;
  type: string;
  instanceAId?: string;
  instanceBId?: string;
  compAId?: string;
  compBId?: string;
  offset?: number;
  offsetMm?: number;
  angleDeg?: number;
  ratio?: number;
  isSuppressed?: boolean;
  suppressed?: boolean;
  suppressionState?: 'ACTIVE' | 'SUPPRESSED';
  parameters?: Record<string, any>;
  entityA?: any;
  entityB?: any;
  primaryRef?: any;
  secondaryRef?: any;
  [key: string]: any;
}

export interface AssemblyDefinition {
  id?: string;
  assemblyId?: string;
  name?: string;
  instances: AssemblyInstance[];
  mates?: AssemblyMate[];
  constraints?: any[];
  joints?: any[];
  [key: string]: any;
}

export interface Parameter {
  id?: string;
  name: string;
  expression?: string;
  value: number | string;
  unit?: string;
  description?: string;
  [key: string]: any;
}

export interface Sketch {
  id: string;
  name?: string;
  plane?: string;
  closedProfile?: boolean;
  entities?: any[];
  constraints?: any[];
  [key: string]: any;
}

export interface CADFeature {
  id: string;
  name?: string;
  type: string;
  parameters?: Record<string, any>;
  suppressed?: boolean;
  [key: string]: any;
}

export interface FEAModel {
  id?: string;
  name?: string;
  mesh?: any;
  boundaryConditions?: any[];
  loads?: any[];
  [key: string]: any;
}

export interface CFDModel {
  id?: string;
  name?: string;
  fluidDomain?: any;
  boundaryConditions?: any[];
  [key: string]: any;
}

export interface CAMModel {
  id?: string;
  name?: string;
  setups?: any[];
  operations?: any[];
  [key: string]: any;
}

export interface EvidenceRecord {
  id?: string;
  evidenceId?: string;
  recordId?: string;
  type?: string;
  stage?: string;
  sourceSystem?: string;
  documentId?: string;
  revision?: string | number;
  hash?: string;
  canonicalHash?: string;
  timestamp?: string | number;
  payload?: any;
  verdict?: 'PASS' | 'FAIL' | 'UNSUPPORTED' | string;
  [key: string]: any;
}

export interface EngineeringDocument {
  documentId: string;
  id?: string;
  name?: string;
  title?: string;
  projectId?: string;
  revision: string | number;
  type?: 'PART' | 'ASSEMBLY' | string;
  units?: UnitSystem;
  sketches?: Sketch[];
  constraints?: any[];
  features?: CADFeature[];
  parameters?: Parameter[];
  material?: any;
  materials?: any[];
  assembly?: AssemblyDefinition;
  topologyMap?: TopologyLineage | Record<string, any>;
  evaluatedShape?: Solid;
  evaluatedSolid?: Solid;
  documentHash?: string;
  derived?: {
    geometryHash?: string;
    bRepHash?: string;
    topologyHash?: string;
    mesh?: any;
    [key: string]: any;
  };
  metadata?: {
    name?: string;
    author?: string;
    organization?: string;
    timestamp?: string;
    description?: string;
    [key: string]: any;
  };
  evidence?: any[];
  [key: string]: any;
}

export type CADDocument = EngineeringDocument;
