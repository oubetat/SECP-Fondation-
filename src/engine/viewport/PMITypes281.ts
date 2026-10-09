/**
 * PATCH-281: Product Manufacturing Information (PMI) Types
 */

import { PersistentEntityId } from './ViewportTypes276';

export type PMIAnnotationType = 
  | 'DIMENSION'
  | 'DATUM'
  | 'GEOMETRIC_TOLERANCE'
  | 'SURFACE_FINISH'
  | 'NOTE'
  | 'LEADER'
  | 'BALLOON'
  | 'FEATURE_CALLOUT';

export type PMIStatus = 'VALID' | 'STALE' | 'UNRESOLVED' | 'INVALID' | 'AMBIGUOUS';

export interface PMIAnnotation {
  id: string;
  type: PMIAnnotationType;
  semanticData: any; // Structured engineering data
  referencedEntities: PersistentEntityId[];
  coordinateSystem: string;
  placement: {
    position: [number, number, number];
    orientation: [number, number, number, number]; // Quaternion
  };
  visibility: boolean;
  revision: string;
  status: PMIStatus;
}

export interface DimensionPMIData {
  nominal: number;
  tolerancePlus: number;
  toleranceMinus: number;
  unit: string;
  isDriving: boolean;
}

export interface DatumPMIData {
  label: string; // e.g., 'A', 'B'
  featureReference: string;
}

export interface GDTData {
  symbol: string; // e.g., 'POSITION', 'FLATNESS'
  value: number;
  modifiers: string[]; // e.g., 'MMC', 'LMC'
  datums: string[]; // e.g., ['A', 'B', 'C']
}

export interface PMIState281 {
  annotations: PMIAnnotation[];
  activePMI: string | null;
  modelRevision: string;
}
