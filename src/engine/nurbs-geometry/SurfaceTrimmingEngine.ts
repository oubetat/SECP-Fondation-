/**
 * SECP-102.2: Surface Trimming & Topological Boundary Engine
 * Rigorous geometric evaluation and topological validation of 2D UV trimming loops,
 * hole exclusion, Jordan curve ray-casting, closure residual enforcement,
 * and parameter domain confinement.
 */

import crypto from 'crypto';
import { NurbsSurface, TrimCurveUV } from './NurbsTypes';
import { GeometricToleranceEngine } from './GeometricToleranceEngine';

export interface TrimLoopValidationResult {
  isValid: boolean;
  loopId: string;
  closureResidual: number;
  segmentCount: number;
  isOuterLoop: boolean;
  isClosed: boolean;
  hasDegeneracies: boolean;
  domainViolations: number;
  errors: string[];
}

export interface SurfaceTrimmingReport {
  isValid: boolean;
  loopCount: number;
  outerLoopCount: number;
  innerLoopCount: number;
  totalSegments: number;
  maxClosureResidual: number;
  loopResults: TrimLoopValidationResult[];
  errors: string[];
  fingerprint: string;
}

export class SurfaceTrimmingEngine {
  /**
   * Determines if a given (u,v) point lies inside the active (untrimmed) region of the surface.
   * Uses an analytical 2D ray-casting winding algorithm on UV boundary polygon loops.
   */
  public static isPointInActiveRegion(surface: NurbsSurface, u: number, v: number): boolean {
    if (!surface) {
      throw new Error('SurfaceTrimmingEngine: surface is null or undefined');
    }

    if (!Number.isFinite(u) || !Number.isFinite(v)) {
      throw new Error(`SurfaceTrimmingEngine: coordinates (${u}, ${v}) must be finite numbers`);
    }

    // Determine parameter domain from surface knots
    const uDomain = this.getSurfaceUDomain(surface);
    const vDomain = this.getSurfaceVDomain(surface);

    if (u < uDomain.min - GeometricToleranceEngine.NUMERICAL_SOLVER_TOLERANCE ||
        u > uDomain.max + GeometricToleranceEngine.NUMERICAL_SOLVER_TOLERANCE ||
        v < vDomain.min - GeometricToleranceEngine.NUMERICAL_SOLVER_TOLERANCE ||
        v > vDomain.max + GeometricToleranceEngine.NUMERICAL_SOLVER_TOLERANCE) {
      return false; // Point lies outside surface UV domain
    }

    if (!surface.trimCurves || surface.trimCurves.length === 0) {
      return true; // No trim loops: entire UV parameter domain is active
    }

    let hasOuterLoops = false;
    let isInsideOuterBoundary = false;
    let isInsideHole = false;

    for (const trim of surface.trimCurves) {
      // Validate loop structural closure
      const polygon = this.extractUVPolygon(trim);
      if (polygon.length < 3) {
        // If an empty or uninitialized loop is passed, evaluate based on outer/inner intent
        if (trim.isOuterLoop) hasOuterLoops = true;
        continue;
      }

      const isInside = this.isPointInPolygon2D(u, v, polygon);

      if (trim.isOuterLoop) {
        hasOuterLoops = true;
        if (isInside) {
          isInsideOuterBoundary = true;
        }
      } else {
        if (isInside) {
          isInsideHole = true;
        }
      }
    }

    if (hasOuterLoops && !isInsideOuterBoundary) {
      return false;
    }

    return !isInsideHole;
  }

  /**
   * Validates an individual 2D UV trimming loop for closure, non-degeneracy, and domain bounds.
   */
  public static validateTrimLoop(
    trim: TrimCurveUV,
    surfaceUDomain: { min: number; max: number } = { min: 0, max: 1 },
    surfaceVDomain: { min: number; max: number } = { min: 0, max: 1 },
    tolerance: number = GeometricToleranceEngine.GEOMETRIC_COINCIDENCE_TOLERANCE
  ): TrimLoopValidationResult {
    const errors: string[] = [];

    if (!trim) {
      return {
        isValid: false,
        loopId: 'unknown',
        closureResidual: Infinity,
        segmentCount: 0,
        isOuterLoop: false,
        isClosed: false,
        hasDegeneracies: true,
        domainViolations: 0,
        errors: ['Trim curve definition is null or undefined']
      };
    }

    const polygon = this.extractUVPolygon(trim);

    if (polygon.length === 0) {
      return {
        isValid: true, // Empty loop represents unconstrained boundary
        loopId: trim.id,
        closureResidual: 0,
        segmentCount: 0,
        isOuterLoop: trim.isOuterLoop,
        isClosed: true,
        hasDegeneracies: false,
        domainViolations: 0,
        errors: []
      };
    }

    if (polygon.length < 3) {
      errors.push(`Trim loop ${trim.id} contains insufficient points (${polygon.length} < 3)`);
      return {
        isValid: false,
        loopId: trim.id,
        closureResidual: Infinity,
        segmentCount: polygon.length,
        isOuterLoop: trim.isOuterLoop,
        isClosed: false,
        hasDegeneracies: true,
        domainViolations: 0,
        errors
      };
    }

    // 1. Calculate closure residual: distance between first and last point
    const first = polygon[0];
    const last = polygon[polygon.length - 1];
    const du = last.u - first.u;
    const dv = last.v - first.v;
    const closureResidual = Math.sqrt(du * du + dv * dv);
    const isClosed = closureResidual <= tolerance;

    if (!isClosed) {
      errors.push(
        `Trim loop ${trim.id} is not closed: closure residual ${closureResidual.toExponential(4)} exceeds tolerance ${tolerance.toExponential(4)}`
      );
    }

    // 2. Check for degenerate zero-length segments and duplicate consecutive vertices
    let hasDegeneracies = false;
    let domainViolations = 0;

    for (let i = 0; i < polygon.length - 1; i++) {
      const p1 = polygon[i];
      const p2 = polygon[i + 1];

      if (!Number.isFinite(p1.u) || !Number.isFinite(p1.v)) {
        errors.push(`Non-finite UV coordinate at point ${i}: (${p1.u}, ${p1.v})`);
        hasDegeneracies = true;
      }

      // Check parameter domain
      if (p1.u < surfaceUDomain.min - tolerance || p1.u > surfaceUDomain.max + tolerance ||
          p1.v < surfaceVDomain.min - tolerance || p1.v > surfaceVDomain.max + tolerance) {
        domainViolations++;
      }

      const segDu = p2.u - p1.u;
      const segDv = p2.v - p1.v;
      const segLen = Math.sqrt(segDu * segDu + segDv * segDv);

      // Flag consecutive duplicates (unless it's the exact closing point)
      if (i < polygon.length - 2 && segLen < GeometricToleranceEngine.NUMERICAL_SOLVER_TOLERANCE) {
        hasDegeneracies = true;
        errors.push(`Degenerate zero-length segment detected between vertices ${i} and ${i + 1}`);
      }
    }

    if (domainViolations > 0) {
      errors.push(`Trim loop ${trim.id} contains ${domainViolations} vertices outside surface parameter domain`);
    }

    return {
      isValid: errors.length === 0,
      loopId: trim.id,
      closureResidual,
      segmentCount: polygon.length - 1,
      isOuterLoop: trim.isOuterLoop,
      isClosed,
      hasDegeneracies,
      domainViolations,
      errors
    };
  }

  /**
   * Validates all trimming curves associated with a NURBS surface and computes an integrity fingerprint.
   */
  public static validateSurfaceTrimming(surface: NurbsSurface): SurfaceTrimmingReport {
    const errors: string[] = [];

    if (!surface) {
      return {
        isValid: false,
        loopCount: 0,
        outerLoopCount: 0,
        innerLoopCount: 0,
        totalSegments: 0,
        maxClosureResidual: 0,
        loopResults: [],
        errors: ['Surface is null or undefined'],
        fingerprint: 'null'
      };
    }

    const uDomain = this.getSurfaceUDomain(surface);
    const vDomain = this.getSurfaceVDomain(surface);

    const loopResults: TrimLoopValidationResult[] = [];
    let outerLoopCount = 0;
    let innerLoopCount = 0;
    let totalSegments = 0;
    let maxClosureResidual = 0;

    if (surface.trimCurves && surface.trimCurves.length > 0) {
      for (const trim of surface.trimCurves) {
        if (trim.isOuterLoop) outerLoopCount++;
        else innerLoopCount++;

        const res = this.validateTrimLoop(trim, uDomain, vDomain);
        loopResults.push(res);
        totalSegments += res.segmentCount;
        if (Number.isFinite(res.closureResidual) && res.closureResidual > maxClosureResidual) {
          maxClosureResidual = res.closureResidual;
        }
        if (!res.isValid) {
          errors.push(...res.errors);
        }
      }
    }

    const canonicalData = {
      surfaceId: surface.id,
      loopCount: loopResults.length,
      outerLoopCount,
      innerLoopCount,
      totalSegments,
      maxClosureResidual,
      loops: loopResults.map(l => ({
        id: l.loopId,
        isOuter: l.isOuterLoop,
        closureResidual: l.closureResidual,
        segments: l.segmentCount
      }))
    };

    const fingerprint = crypto
      .createHash('sha256')
      .update(JSON.stringify(canonicalData))
      .digest('hex');

    return {
      isValid: errors.length === 0,
      loopCount: loopResults.length,
      outerLoopCount,
      innerLoopCount,
      totalSegments,
      maxClosureResidual,
      loopResults,
      errors,
      fingerprint
    };
  }

  /**
   * Evaluates point-in-polygon inclusion in 2D UV coordinates using the Jordan Curve theorem (ray-casting).
   */
  private static isPointInPolygon2D(u: number, v: number, polygon: { u: number; v: number }[]): boolean {
    let inside = false;
    const n = polygon.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const ui = polygon[i].u;
      const vi = polygon[i].v;
      const uj = polygon[j].u;
      const vj = polygon[j].v;

      const intersect = vi > v !== vj > v && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui;
      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Extracts or discretizes 2D UV coordinates from a TrimCurveUV definition.
   */
  private static extractUVPolygon(trim: TrimCurveUV): { u: number; v: number }[] {
    if (!trim || !trim.controlPointsUV || trim.controlPointsUV.length === 0) {
      return [];
    }

    return trim.controlPointsUV.map(cp => ({
      u: cp.u,
      v: cp.v
    }));
  }

  private static getSurfaceUDomain(surface: NurbsSurface): { min: number; max: number } {
    if (surface.knotsU && surface.knotsU.length > 0 && surface.degreeU !== undefined) {
      const p = surface.degreeU;
      const min = surface.knotsU[p] !== undefined ? surface.knotsU[p] : 0;
      const max = surface.knotsU[surface.knotsU.length - 1 - p] !== undefined
        ? surface.knotsU[surface.knotsU.length - 1 - p]
        : 1;
      return { min, max };
    }
    return { min: 0, max: 1 };
  }

  private static getSurfaceVDomain(surface: NurbsSurface): { min: number; max: number } {
    if (surface.knotsV && surface.knotsV.length > 0 && surface.degreeV !== undefined) {
      const q = surface.degreeV;
      const min = surface.knotsV[q] !== undefined ? surface.knotsV[q] : 0;
      const max = surface.knotsV[surface.knotsV.length - 1 - q] !== undefined
        ? surface.knotsV[surface.knotsV.length - 1 - q]
        : 1;
      return { min, max };
    }
    return { min: 0, max: 1 };
  }
}
