/**
 * SECP CAD Kernel — GCS Constraint Residuals
 * Phase 2 (PATCH-025)
 */

import { Point2D } from '../SketchGeometry';

export class ConstraintResiduals {
  /**
   * COINCIDENT / POINT_ON_POINT
   * Residual is the Euclidean distance between two points.
   */
  public static coincident(p1: Point2D, p2: Point2D): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * HORIZONTAL
   * Residual is the difference in Y coordinates.
   * If line is degenerate (|p1 - p2| <= 1e-6), direction is undefined and cannot be horizontal.
   */
  public static horizontal(p1: Point2D, p2: Point2D): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    if (dx * dx + dy * dy < 1e-12) {
      return 1.0; // Degenerate entity cannot satisfy HORIZONTAL
    }
    return dy;
  }

  /**
   * VERTICAL
   * Residual is the difference in X coordinates.
   * If line is degenerate (|p1 - p2| <= 1e-6), direction is undefined and cannot be vertical.
   */
  public static vertical(p1: Point2D, p2: Point2D): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    if (dx * dx + dy * dy < 1e-12) {
      return 1.0; // Degenerate entity cannot satisfy VERTICAL
    }
    return dx;
  }

  /**
   * DISTANCE
   * Residual is the difference between actual distance and target distance.
   */
  public static distance(p1: Point2D, p2: Point2D, target: number): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const actual = Math.sqrt(dx * dx + dy * dy);
    return actual - target;
  }

  /**
   * DISTANCE_X
   */
  public static distanceX(p1: Point2D, p2: Point2D, target: number): number {
    return (p1.x - p2.x) - target;
  }

  /**
   * DISTANCE_Y
   */
  public static distanceY(p1: Point2D, p2: Point2D, target: number): number {
    return (p1.y - p2.y) - target;
  }

  /**
   * PARALLEL
   * Residual based on cross product of direction vectors.
   * Degenerate lines (|v| < 1e-6) cannot satisfy PARALLEL.
   */
  public static parallel(v1: Point2D, v2: Point2D): number {
    const len1 = Math.hypot(v1.x, v1.y);
    const len2 = Math.hypot(v2.x, v2.y);
    if (len1 < 1e-6 || len2 < 1e-6) {
      return 1.0;
    }
    return (v1.x * v2.y - v1.y * v2.x) / (len1 * len2);
  }

  /**
   * PERPENDICULAR
   * Residual based on dot product of direction vectors.
   * Degenerate lines (|v| < 1e-6) cannot satisfy PERPENDICULAR.
   */
  public static perpendicular(v1: Point2D, v2: Point2D): number {
    const len1 = Math.hypot(v1.x, v1.y);
    const len2 = Math.hypot(v2.x, v2.y);
    if (len1 < 1e-6 || len2 < 1e-6) {
      return 1.0;
    }
    return (v1.x * v2.x + v1.y * v2.y) / (len1 * len2);
  }

  /**
   * RADIUS
   */
  public static radius(radius: number, target: number): number {
    return radius - target;
  }

  /**
   * EQUAL
   */
  public static equal(val1: number, val2: number): number {
    return val1 - val2;
  }
}
