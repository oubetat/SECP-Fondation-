/**
 * PATCH-279: Engineering Section View Types
 * Defines section states, planes, and clipping configurations.
 */

import { SelectionType } from './ViewportTypes276';

export type SectionType279 = 'PLANE' | 'BOX' | 'CORNER' | 'CYLINDER';

export interface SectionPlane279 {
  id: string;
  name: string;
  origin: [number, number, number];
  normal: [number, number, number];
  offset: number; // mm
  flip: boolean;
  active: boolean;
  locked: boolean;
}

export interface SectionBox279 {
  min: [number, number, number];
  max: [number, number, number];
}

export interface SectionState279 {
  activeSections: SectionPlane279[];
  box: SectionBox279 | null;
  displayMode: 'CAP_SOLID' | 'OUTLINE_ONLY' | 'TRANSPARENT_UNCUT';
  scope: 'ENTIRE_MODEL' | 'SELECTED_ONLY';
  modelRevision: string;
  isStale: boolean;
}

export interface SectionDiagnostics279 {
  inputRevision: string;
  planeCount: number;
  intersectionStatus: 'OK' | 'DEGENERATE' | 'FAILED';
  renderingStatus: 'GPU_ACCELERATED' | 'CPU_FALLBACK';
  memoryUsageMb: number;
}
