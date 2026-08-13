/**
 * SECP Shape Handle
 * A kernel-agnostic handle to a geometric shape.
 */

import { ShapeType, GeometricProperties, BoundingBox } from './GeometryTypes';

export interface ShapeHandle {
  /**
   * Unique identifier for the shape in the current session
   */
  readonly id: string;

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
  tessellate(linearDeflection: number, angularDeflection: number): Promise<any>;

  /**
   * Get the underlying kernel-specific object (for internal use)
   */
  getNative(): any;
}
