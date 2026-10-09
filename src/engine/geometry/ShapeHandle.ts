/**
 * SECP Shape Handle
 * A kernel-agnostic handle to a geometric shape.
 */

import { ShapeType, GeometricProperties, BoundingBox, MeshResult, ShapeIdentity } from './GeometryTypes';

export interface ShapeHandle {
  /**
   * Unique identifier for the shape in the current session
   */
  readonly id: string;

  /**
   * Deterministic structural identity
   */
  readonly identity: ShapeIdentity;

  /**
   * Deterministic hash representing the construction identity
   */
  readonly identityHash?: string;

  /**
   * Optional metadata about the feature construction
   */
  readonly metadata?: any;

  /**
   * The type of topological entity
   */
  readonly type: ShapeType;

  /**
   * Calculate physical properties of the shape
   */
  getProperties(): Promise<GeometricProperties>;

  /**
   * Get the bounding box of the shape
   */
  getBoundingBox(): Promise<BoundingBox>;

  /**
   * Export to mesh for visualization
   */
  tessellate(linearDeflection: number, angularDeflection: number): Promise<MeshResult>;

  /**
   * Get the underlying kernel-specific object (for internal use)
   */
  getNative(): any;
}
