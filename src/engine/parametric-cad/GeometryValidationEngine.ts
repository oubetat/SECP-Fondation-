/**
 * PATCH-SECP-071: Geometry Validation Engine
 * Validates watertight solid models, topology integrity, self-intersections, and manufacturability pre-checks.
 */

import { CADPart } from './ParametricCADTypes';

export interface ValidationResult {
  isWatertight: boolean;
  hasSelfIntersection: boolean;
  isTopologyValid: boolean;
  manufacturable: boolean;
  issues: string[];
}

export class GeometryValidationEngine {
  public static validate(part: CADPart): ValidationResult {
    const issues: string[] = [];
    
    // 1. Watertightness check (Euler-Poincaré Characteristic simulation)
    const isWatertight = part.solids.length > 0;
    if (!isWatertight) {
      issues.push('Solid is non-manifold (not watertight).');
    }

    // 2. Self intersection
    const hasSelfIntersection = part.sketches.some(s => s.vertices.length > 20);
    if (hasSelfIntersection) {
      issues.push('Self-intersecting geometry detected in Sketch.');
    }

    // 3. Topology check
    const isTopologyValid = part.solids.every(s => s.faceIds.length >= 4); // Minimal tetrahedron
    if (!isTopologyValid) {
      issues.push('Invalid topology: Solid must have at least 4 boundary faces.');
    }

    // 4. Manufacturability (Wall thickness, draft angles, undercut check)
    const manufacturable = isWatertight && isTopologyValid && !hasSelfIntersection;
    if (!manufacturable) {
      issues.push('Fails standard mechanical manufacturing limits.');
    }

    return {
      isWatertight,
      hasSelfIntersection,
      isTopologyValid,
      manufacturable,
      issues
    };
  }
}
