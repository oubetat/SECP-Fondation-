/**
 * SECP CAD Kernel — Sketch Validator
 * Phase 2 (PATCH-024)
 */

import { SketchModel } from './SketchModel';
import { SketchEntity } from './SketchEntity';
import { SketchGeometry } from './SketchGeometry';
import { ToleranceEngine } from '../cad-kernel/tolerance/ToleranceModel';
import { ToleranceOperation } from '../cad-kernel/tolerance/ToleranceContext';

export interface SketchDiagnostic {
  readonly severity: 'ERROR' | 'WARNING' | 'INFO';
  readonly code: string;
  readonly entityId?: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly SketchDiagnostic[];
}

export class SketchValidator {
  public static validate(model: SketchModel): ValidationResult {
    const diagnostics: SketchDiagnostic[] = [];

    for (const entity of model.entities) {
      const entityResult = this.validateEntity(entity, model);
      diagnostics.push(...entityResult.diagnostics);
    }

    // Check sketch-level consistency
    const entityIds = new Set<string>();
    for (const entity of model.entities) {
      const idStr = entity.id.projectId;
      if (entityIds.has(idStr)) {
        diagnostics.push({
          severity: 'ERROR',
          code: 'DUPLICATE_ENTITY_ID',
          entityId: idStr,
          message: `Duplicate entity ID detected: ${idStr}`,
        });
      }
      entityIds.add(idStr);

      if (entity.sketchId.projectId !== model.id.projectId) {
        diagnostics.push({
          severity: 'ERROR',
          code: 'SKECH_OWNERSHIP_MISMATCH',
          entityId: idStr,
          message: `Entity ${idStr} belongs to sketch ${entity.sketchId.projectId}, but is in sketch ${model.id.projectId}`,
        });
      }
    }

    return {
      valid: !diagnostics.some((d) => d.severity === 'ERROR'),
      diagnostics,
    };
  }

  public static validateEntity(entity: SketchEntity, model: SketchModel): ValidationResult {
    const diagnostics: SketchDiagnostic[] = [];
    const geom = entity.geometry;
    const tol = model.tolerance.coincidence; // Use coincidence tolerance for geometric checks
    const ctx = {
      operation: ToleranceOperation.COINCIDENCE,
      geometryScale: 1.0,
      unitSystem: model.units,
      requestedTolerance: tol,
    };

    switch (geom.type) {
      case 'POINT':
        if (!Number.isFinite(geom.x) || !Number.isFinite(geom.y)) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'INVALID_COORDINATES',
            entityId: entity.id.projectId,
            message: 'Point contains non-finite coordinates',
          });
        }
        break;

      case 'LINE':
        if (!Number.isFinite(geom.start.x) || !Number.isFinite(geom.start.y) ||
            !Number.isFinite(geom.end.x) || !Number.isFinite(geom.end.y)) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'INVALID_COORDINATES',
            entityId: entity.id.projectId,
            message: 'Line contains non-finite coordinates',
          });
        } else {
          const dx = geom.start.x - geom.end.x;
          const dy = geom.start.y - geom.end.y;
          const lengthSq = dx * dx + dy * dy;
          if (lengthSq <= tol * tol) {
            diagnostics.push({
              severity: 'ERROR',
              code: 'ZERO_LENGTH_LINE',
              entityId: entity.id.projectId,
              message: 'Line length is below tolerance',
            });
          }
        }
        break;

      case 'CIRCLE':
        if (!Number.isFinite(geom.center.x) || !Number.isFinite(geom.center.y) || !Number.isFinite(geom.radius)) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'INVALID_GEOMETRY',
            entityId: entity.id.projectId,
            message: 'Circle contains non-finite values',
          });
        } else if (geom.radius <= tol) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'INVALID_RADIUS',
            entityId: entity.id.projectId,
            message: 'Circle radius is below tolerance',
          });
        }
        break;

      case 'ARC':
        if (!Number.isFinite(geom.center.x) || !Number.isFinite(geom.center.y) || 
            !Number.isFinite(geom.radius) || !Number.isFinite(geom.startAngle) || !Number.isFinite(geom.endAngle)) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'INVALID_GEOMETRY',
            entityId: entity.id.projectId,
            message: 'Arc contains non-finite values',
          });
        } else if (geom.radius <= tol) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'INVALID_RADIUS',
            entityId: entity.id.projectId,
            message: 'Arc radius is below tolerance',
          });
        }
        break;

      case 'ELLIPSE':
        if (!Number.isFinite(geom.center.x) || !Number.isFinite(geom.center.y) || 
            !Number.isFinite(geom.majorRadius) || !Number.isFinite(geom.minorRadius) || !Number.isFinite(geom.rotation)) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'INVALID_GEOMETRY',
            entityId: entity.id.projectId,
            message: 'Ellipse contains non-finite values',
          });
        } else {
          if (geom.majorRadius <= tol || geom.minorRadius <= tol) {
             diagnostics.push({
              severity: 'ERROR',
              code: 'INVALID_RADIUS',
              entityId: entity.id.projectId,
              message: 'Ellipse radii must be above tolerance',
            });
          }
          if (geom.minorRadius > geom.majorRadius + tol) {
            diagnostics.push({
              severity: 'ERROR',
              code: 'INVALID_ELLIPSE_RATIO',
              entityId: entity.id.projectId,
              message: 'Minor radius cannot be greater than major radius',
            });
          }
        }
        break;

      case 'POLYLINE':
        if (geom.points.length < 2) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'INSUFFICIENT_POINTS',
            entityId: entity.id.projectId,
            message: 'Polyline must have at least 2 points',
          });
        }
        for (const p of geom.points) {
          if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
            diagnostics.push({
              severity: 'ERROR',
              code: 'INVALID_COORDINATES',
              entityId: entity.id.projectId,
              message: 'Polyline contains non-finite coordinates',
            });
            break;
          }
        }
        break;

      case 'SPLINE':
        if (geom.degree < 1) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'INVALID_DEGREE',
            entityId: entity.id.projectId,
            message: 'Spline degree must be at least 1',
          });
        }
        if (geom.controlPoints.length < geom.degree + 1) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'INSUFFICIENT_CONTROL_POINTS',
            entityId: entity.id.projectId,
            message: `Spline of degree ${geom.degree} requires at least ${geom.degree + 1} control points`,
          });
        }
        // Basic knot vector validation: m = n + p + 1
        const n = geom.controlPoints.length - 1;
        const p = geom.degree;
        const expectedKnotCount = n + p + 2; // (n+1) + (p+1)
        if (geom.knots.length !== expectedKnotCount) {
           diagnostics.push({
            severity: 'ERROR',
            code: 'INVALID_KNOT_COUNT',
            entityId: entity.id.projectId,
            message: `Spline requires exactly ${expectedKnotCount} knots, found ${geom.knots.length}`,
          });
        }
        // Non-decreasing knots
        for (let i = 1; i < geom.knots.length; i++) {
          if (geom.knots[i] < geom.knots[i-1]) {
            diagnostics.push({
              severity: 'ERROR',
              code: 'INVALID_KNOT_SEQUENCE',
              entityId: entity.id.projectId,
              message: 'Spline knots must be non-decreasing',
            });
            break;
          }
        }
        if (geom.weights && geom.weights.length !== geom.controlPoints.length) {
          diagnostics.push({
            severity: 'ERROR',
            code: 'INVALID_WEIGHT_COUNT',
            entityId: entity.id.projectId,
            message: 'Spline weights count must match control points count',
          });
        }
        break;
    }

    return {
      valid: !diagnostics.some((d) => d.severity === 'ERROR'),
      diagnostics,
    };
  }
}
