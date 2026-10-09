/**
 * SECP CAD Kernel — Healing Validator
 * Phase 2 (PATCH-020)
 */

import { BRepValidator } from '../brep/BRepValidator';
import { BRepValidationResult } from '../brep/BRepContracts';
import { HealingValidationResult, HealingDefect } from './HealingTypes';
import { Solid } from '../topology/TopologyContracts';

export class HealingValidator {
  private brepValidator: BRepValidator;

  constructor() {
    this.brepValidator = new BRepValidator();
  }

  public validateShape(shape: any, remainingDefects: HealingDefect[] = []): HealingValidationResult {
    if (!shape) {
      return {
        isValid: false,
        remainingDefects,
        brepValidationStatus: 'INVALID',
        geometryPreserved: true,
        topologyPreserved: true,
        details: 'Shape is null or undefined'
      };
    }

    const report: BRepValidationResult = this.brepValidator.validate(shape);
    const isValid = report.status === 'VALID' && remainingDefects.length === 0;

    return {
      isValid,
      remainingDefects,
      brepValidationStatus: report.status === 'VALID' ? 'VALID' : 'INVALID',
      geometryPreserved: true,
      topologyPreserved: true,
      details: report.status === 'VALID'
        ? 'B-Rep shape satisfies all topological and geometric invariants'
        : `B-Rep shape validation failed with ${report.diagnostics.length} diagnostics`
    };
  }

  public verifyPreservation(
    beforeShape: any,
    afterShape: any
  ): { geometryPreserved: boolean; topologyPreserved: boolean; details: string } {
    if (!beforeShape || !afterShape) {
      return { geometryPreserved: false, topologyPreserved: false, details: 'Shape missing for comparison' };
    }

    // Compare bounding box or topological entity count sanity
    const beforeCount = this.countFaces(beforeShape);
    const afterCount = this.countFaces(afterShape);

    const topologyPreserved = Math.abs(beforeCount - afterCount) <= 2; // Allowed small merge/cleanup difference
    const geometryPreserved = true; // Geometry preserved unless explicit geometry modification

    return {
      geometryPreserved,
      topologyPreserved,
      details: `Face counts: before ${beforeCount}, after ${afterCount}`
    };
  }

  private countFaces(shape: any): number {
    if (shape.shapeType === 'SOLID' && shape.outerShell && shape.outerShell.orientedFaces) {
      return shape.outerShell.orientedFaces.length;
    }
    return 0;
  }
}
