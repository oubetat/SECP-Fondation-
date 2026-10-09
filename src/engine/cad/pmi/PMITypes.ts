/**
 * SECP CAD Kernel — Canonical PMI (Product and Manufacturing Information) Types
 * PROMPT-044: PMI / GD&T Canonicalization
 */

import { Vector } from '../../cad-kernel/geometry/GeometryContracts';

export type GDNTCharacteristic = 
  | 'STRAIGHTNESS' | 'FLATNESS' | 'CIRCULARITY' | 'CYLINDRICITY'
  | 'LINE_PROFILE' | 'SURFACE_PROFILE'
  | 'ANGULARITY' | 'PERPENDICULARITY' | 'PARALLELISM'
  | 'POSITION' | 'CONCENTRICITY' | 'SYMMETRY'
  | 'CIRCULAR_RUNOUT' | 'TOTAL_RUNOUT';

export type MaterialModifier = 'MMC' | 'LMC' | 'RFS' | 'NONE';

export interface DatumReference {
  datumId: string;
  materialModifier: MaterialModifier;
  precedence: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
}

export interface DatumReferenceFrame {
  id: string;
  references: DatumReference[]; // Ordered: Primary, Secondary, Tertiary
}

export interface ToleranceDefinition {
  value: number;
  unit: string;
  characteristic: GDNTCharacteristic;
  modifier: MaterialModifier;
  datumReferenceFrameId?: string;
}

export interface FeatureReference {
  id: string;
  type: 'FACE' | 'EDGE' | 'VERTEX' | 'AXIS' | 'SURFACE' | 'DATUM' | 'PATTERN' | 'HOLE' | 'THREAD' | 'FEATURE';
  sourceId: string; // The canonical ID of the referenced geometry or feature
}

export type PMIType = 'DIMENSION' | 'GEOMETRIC_TOLERANCE' | 'DATUM' | 'SURFACE_FINISH' | 'WELD_SYMBOL' | 'NOTE';

export interface PMISemanticDefinition {
  pmiId: string;
  type: PMIType;
  sourceDocumentId: string;
  sourceModelRevision: string | number;
  featureReferences: FeatureReference[];
  tolerance?: ToleranceDefinition;
  datumDefinition?: {
    label: string; // e.g. "A"
    datumType: 'PLANE' | 'AXIS' | 'POINT';
  };
  dimension?: {
    type: 'LINEAR' | 'ANGULAR' | 'DIAMETER' | 'RADIUS';
    nominalValue: number;
    unit: string;
    precision: number;
  };
  surfaceFinish?: {
    roughnessValue: number;
    unit: string;
    method?: string;
  };
  notes?: string;
  isSemantic: boolean;
  revision: string | number;
  lineage: string;
}

export interface PMIAnnotationPresentation {
  annotationId: string;
  pmiId: string;
  placement: { x: number; y: number; z: number };
  normal: Vector;
  leaderPath?: { x: number; y: number; z: number }[];
  text: string; // Derived from semantic definition
}

export interface PMIModel {
  pmiList: PMISemanticDefinition[];
  datums: Record<string, string>; // label -> pmiId (datum definition)
  drfs: DatumReferenceFrame[];
}
