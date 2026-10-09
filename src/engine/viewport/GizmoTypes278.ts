/**
 * PATCH-278: Engineering Gizmo System Types
 * Defines transform modes, coordinate systems, and gizmo states.
 */

import { PersistentEntityId } from './ViewportTypes276';

export type TransformMode = 'TRANSLATE' | 'ROTATE' | 'TRANSFORM' | 'NONE';
export type CoordinateSystem = 'GLOBAL' | 'LOCAL' | 'ASSEMBLY' | 'CUSTOM';

export interface SnapConfiguration {
  enabled: boolean;
  gridSize: number; // mm
  angleStep: number; // degrees
  increment: number; // mm
  snapToEntities: boolean;
}

export interface GizmoState278 {
  activeEntity: PersistentEntityId | null;
  mode: TransformMode;
  coordinateSystem: CoordinateSystem;
  origin: [number, number, number];
  orientation: [number, number, number, number]; // Quaternion [x, y, z, w]
  activeHandle: string | null; // e.g., 'X', 'XY_PLANE', 'Z_ROT'
  snap: SnapConfiguration;
  previewTransform: {
    translation: [number, number, number];
    rotation: [number, number, number, number];
    scale: [number, number, number];
  };
  isDragging: boolean;
}

export interface TransformTransaction {
  transactionId: string;
  entityId: string;
  before: TransformState;
  after: TransformState;
  revision: string;
  timestamp: string;
}

export interface TransformState {
  position: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
}

export interface GizmoHandle {
  id: string;
  type: 'AXIS' | 'PLANE' | 'RING';
  axis: 'X' | 'Y' | 'Z' | 'FREE';
  color: string;
  highlightColor: string;
}
