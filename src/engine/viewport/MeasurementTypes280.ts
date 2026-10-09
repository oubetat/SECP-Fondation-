/**
 * PATCH-280: Engineering Measurement System Types
 */

import { PersistentEntityId } from './ViewportTypes276';

export type MeasurementType280 = 
  | 'COORDINATES'
  | 'DISTANCE'
  | 'LENGTH'
  | 'RADIUS'
  | 'DIAMETER'
  | 'ANGLE'
  | 'AREA'
  | 'VOLUME'
  | 'BOUNDING_BOX'
  | 'MASS_PROPERTIES';

export type MeasurementUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'deg' | 'rad' | 'mm2' | 'mm3' | 'kg';

export interface MeasurementResult280 {
  id: string;
  type: MeasurementType280;
  value: number | [number, number, number] | any;
  unit: MeasurementUnit;
  entities: PersistentEntityId[];
  revision: string;
  status: 'VALID' | 'STALE' | 'INVALID' | 'UNAVAILABLE';
  precision: number;
  timestamp: string;
}

export interface MeasurementState280 {
  activeMeasurements: MeasurementResult280[];
  selectedType: MeasurementType280;
  unitSystem: 'METRIC' | 'IMPERIAL';
  precision: number;
  modelRevision: string;
}

export interface MassProperties280 {
  mass: number;
  volume: number;
  centerOfMass: [number, number, number];
  momentsOfInertia: [number, number, number]; // Ixx, Iyy, Izz
}
