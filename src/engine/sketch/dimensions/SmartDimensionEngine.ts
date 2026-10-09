/**
 * SECP CAD Kernel — Smart Dimension Engine
 * PATCH-193: Parametric Sketch Editing & Dimensioning
 */

import {
  IndustrialSketchDefinition,
  IndustrialSketchConstraint,
  SketchPoint2D,
  SketchLine2D,
  SketchCircle2D,
  SketchArc2D,
  Vector2D,
  IndustrialConstraintType
} from '../IndustrialConstraintTypes';
import {
  SketchDimension,
  DimensionType,
  DimensionUnit,
  DimensionCreateSpec,
  DimensionProvenanceEntry
} from './SketchDimensionTypes';
import { IndustrialVariationalSolver, SolveResult } from '../IndustrialVariationalSolver';

export class SmartDimensionEngine {
  private static randomId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  // ============================================================================
  // 1. SMART UNIT HANDLING & CONVERSIONS
  // ============================================================================

  public static convertToStandardUnit(value: number, unit: DimensionUnit): number {
    switch (unit) {
      case 'mm': return value;
      case 'cm': return value * 10;
      case 'm': return value * 1000;
      case 'in': return value * 25.4;
      case 'deg': return value;
      case 'rad': return value * (180 / Math.PI);
      default: return value;
    }
  }

  public static convertFromStandardUnit(value: number, unit: DimensionUnit): number {
    switch (unit) {
      case 'mm': return value;
      case 'cm': return value / 10;
      case 'm': return value / 1000;
      case 'in': return value / 25.4;
      case 'deg': return value;
      case 'rad': return value * (Math.PI / 180);
      default: return value;
    }
  }

  public static parseUnitInput(
    input: string | number,
    defaultUnit: DimensionUnit = 'mm'
  ): { value: number; standardValue: number; unit: DimensionUnit } {
    if (typeof input === 'number') {
      const standard = this.convertToStandardUnit(input, defaultUnit);
      return { value: input, standardValue: standard, unit: defaultUnit };
    }

    const trimmed = input.trim();
    const match = trimmed.match(/^([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*([a-zA-Z°]*)$/);
    if (!match) {
      const num = parseFloat(trimmed);
      const val = isNaN(num) ? 0 : num;
      return { value: val, standardValue: this.convertToStandardUnit(val, defaultUnit), unit: defaultUnit };
    }

    const num = parseFloat(match[1]);
    const rawUnit = match[2].toLowerCase();
    let unit: DimensionUnit = defaultUnit;

    if (rawUnit === 'mm') unit = 'mm';
    else if (rawUnit === 'cm') unit = 'cm';
    else if (rawUnit === 'm') unit = 'm';
    else if (rawUnit === 'in' || rawUnit === 'inch' || rawUnit === '"') unit = 'in';
    else if (rawUnit === 'deg' || rawUnit === '°') unit = 'deg';
    else if (rawUnit === 'rad') unit = 'rad';

    const standardValue = this.convertToStandardUnit(num, unit);
    return { value: num, standardValue, unit };
  }

  public static formatDimension(dim: SketchDimension): string {
    const displayVal = this.convertFromStandardUnit(dim.value, dim.unit);
    const formattedNum = Number(displayVal.toFixed(3)).toString();
    const refSuffix = dim.isDriving ? '' : ' (REF)';

    switch (dim.type) {
      case 'DIAMETER':
        return `Ø${formattedNum} ${dim.unit}${refSuffix}`;
      case 'RADIUS':
        return `R${formattedNum} ${dim.unit}${refSuffix}`;
      case 'ANGLE':
        return `${formattedNum}${dim.unit === 'deg' ? '°' : ' rad'}${refSuffix}`;
      case 'ARC_LENGTH':
        return `⌒${formattedNum} ${dim.unit}${refSuffix}`;
      case 'HORIZONTAL_DISTANCE':
        return `H ${formattedNum} ${dim.unit}${refSuffix}`;
      case 'VERTICAL_DISTANCE':
        return `V ${formattedNum} ${dim.unit}${refSuffix}`;
      default:
        return `${formattedNum} ${dim.unit}${refSuffix}`;
    }
  }

  // ============================================================================
  // 2. SMART DIMENSION INFERENCE
  // ============================================================================

  public static inferDimensionType(
    selectedEntityIds: string[],
    sketch: IndustrialSketchDefinition,
    cursorPosition?: Vector2D
  ): {
    type: DimensionType;
    defaultName: string;
    initialValue: number;
    placement: Vector2D;
    constraintType: IndustrialConstraintType;
  } | null {
    if (!selectedEntityIds || selectedEntityIds.length === 0) return null;

    const entities = sketch.entities;

    // A. Single Entity Selected
    if (selectedEntityIds.length === 1) {
      const ent = entities[selectedEntityIds[0]];
      if (!ent) return null;

      if (ent.type === 'LINE') {
        const line = ent as SketchLine2D;
        const p1 = entities[line.startPointId] as SketchPoint2D;
        const p2 = entities[line.endPointId] as SketchPoint2D;
        if (!p1 || !p2) return null;

        const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const mid: Vector2D = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

        // Determine if horizontal or vertical or aligned
        const dx = Math.abs(p2.x - p1.x);
        const dy = Math.abs(p2.y - p1.y);

        if (cursorPosition) {
          const cDx = Math.abs(cursorPosition.x - mid.x);
          const cDy = Math.abs(cursorPosition.y - mid.y);
          if (cDy > cDx * 1.5 && dy < 1e-3) {
            return {
              type: 'HORIZONTAL_DISTANCE',
              defaultName: `HDist_${line.id}`,
              initialValue: dx,
              placement: { x: mid.x, y: cursorPosition.y },
              constraintType: 'DISTANCE'
            };
          } else if (cDx > cDy * 1.5 && dx < 1e-3) {
            return {
              type: 'VERTICAL_DISTANCE',
              defaultName: `VDist_${line.id}`,
              initialValue: dy,
              placement: { x: cursorPosition.x, y: mid.y },
              constraintType: 'DISTANCE'
            };
          }
        }

        return {
          type: 'LINE_LENGTH',
          defaultName: `Len_${line.id}`,
          initialValue: len,
          placement: cursorPosition || { x: mid.x, y: mid.y - 15 },
          constraintType: 'DISTANCE'
        };
      }

      if (ent.type === 'CIRCLE') {
        const circ = ent as SketchCircle2D;
        const center = entities[circ.centerPointId] as SketchPoint2D;
        const centerPt = center ? { x: center.x, y: center.y } : { x: 0, y: 0 };
        return {
          type: 'DIAMETER',
          defaultName: `Dia_${circ.id}`,
          initialValue: circ.radius * 2,
          placement: cursorPosition || { x: centerPt.x + circ.radius + 20, y: centerPt.y - 10 },
          constraintType: 'DIAMETER'
        };
      }

      if (ent.type === 'ARC') {
        const arc = ent as SketchArc2D;
        const center = entities[arc.centerPointId] as SketchPoint2D;
        const centerPt = center ? { x: center.x, y: center.y } : { x: 0, y: 0 };
        return {
          type: 'RADIUS',
          defaultName: `Rad_${arc.id}`,
          initialValue: arc.radius,
          placement: cursorPosition || { x: centerPt.x + arc.radius + 15, y: centerPt.y + 15 },
          constraintType: 'RADIUS'
        };
      }

      if (ent.type === 'POINT') {
        const pt = ent as SketchPoint2D;
        // Distance to Origin (0,0) by default for single point
        const dist = Math.hypot(pt.x, pt.y);
        return {
          type: 'DISTANCE',
          defaultName: `Pos_${pt.id}`,
          initialValue: dist,
          placement: cursorPosition || { x: pt.x + 15, y: pt.y + 15 },
          constraintType: 'DISTANCE'
        };
      }
    }

    // B. Two Entities Selected
    if (selectedEntityIds.length === 2) {
      const e1 = entities[selectedEntityIds[0]];
      const e2 = entities[selectedEntityIds[1]];
      if (!e1 || !e2) return null;

      // 1. Point ↔ Point
      if (e1.type === 'POINT' && e2.type === 'POINT') {
        const p1 = e1 as SketchPoint2D;
        const p2 = e2 as SketchPoint2D;
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

        if (cursorPosition) {
          const dx = Math.abs(p2.x - p1.x);
          const dy = Math.abs(p2.y - p1.y);
          // If cursor dragged vertically away -> measure horizontal distance
          if (Math.abs(cursorPosition.y - mid.y) > Math.abs(cursorPosition.x - mid.x) * 1.3) {
            return {
              type: 'HORIZONTAL_DISTANCE',
              defaultName: `HDist_${p1.id}_${p2.id}`,
              initialValue: dx,
              placement: { x: mid.x, y: cursorPosition.y },
              constraintType: 'DISTANCE'
            };
          }
          // If cursor dragged horizontally away -> measure vertical distance
          if (Math.abs(cursorPosition.x - mid.x) > Math.abs(cursorPosition.y - mid.y) * 1.3) {
            return {
              type: 'VERTICAL_DISTANCE',
              defaultName: `VDist_${p1.id}_${p2.id}`,
              initialValue: dy,
              placement: { x: cursorPosition.x, y: mid.y },
              constraintType: 'DISTANCE'
            };
          }
        }

        return {
          type: 'DISTANCE',
          defaultName: `Dist_${p1.id}_${p2.id}`,
          initialValue: dist,
          placement: cursorPosition || { x: mid.x, y: mid.y - 15 },
          constraintType: 'DISTANCE'
        };
      }

      // 2. Line ↔ Line
      if (e1.type === 'LINE' && e2.type === 'LINE') {
        const l1 = e1 as SketchLine2D;
        const l2 = e2 as SketchLine2D;
        const p1a = entities[l1.startPointId] as SketchPoint2D;
        const p1b = entities[l1.endPointId] as SketchPoint2D;
        const p2a = entities[l2.startPointId] as SketchPoint2D;
        const p2b = entities[l2.endPointId] as SketchPoint2D;

        if (p1a && p1b && p2a && p2b) {
          const v1 = { x: p1b.x - p1a.x, y: p1b.y - p1a.y };
          const v2 = { x: p2b.x - p2a.x, y: p2b.y - p2a.y };
          const len1 = Math.hypot(v1.x, v1.y);
          const len2 = Math.hypot(v2.x, v2.y);

          if (len1 > 0 && len2 > 0) {
            const dot = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2);
            const clampedDot = Math.max(-1, Math.min(1, dot));
            const angleRad = Math.acos(clampedDot);
            const angleDeg = angleRad * (180 / Math.PI);

            // If parallel or anti-parallel (angle ~ 0 or 180) -> Distance
            if (angleDeg < 2 || angleDeg > 178) {
              const mid1 = { x: (p1a.x + p1b.x) / 2, y: (p1a.y + p1b.y) / 2 };
              const mid2 = { x: (p2a.x + p2b.x) / 2, y: (p2a.y + p2b.y) / 2 };
              const dist = Math.hypot(mid2.x - mid1.x, mid2.y - mid1.y);
              return {
                type: 'DISTANCE',
                defaultName: `Dist_${l1.id}_${l2.id}`,
                initialValue: dist,
                placement: cursorPosition || { x: (mid1.x + mid2.x) / 2, y: (mid1.y + mid2.y) / 2 },
                constraintType: 'DISTANCE'
              };
            }

            // Non-parallel -> Angle
            const mid = { x: (p1a.x + p2a.x) / 2, y: (p1a.y + p2a.y) / 2 };
            return {
              type: 'ANGLE',
              defaultName: `Ang_${l1.id}_${l2.id}`,
              initialValue: angleDeg,
              placement: cursorPosition || { x: mid.x + 20, y: mid.y + 20 },
              constraintType: 'ANGLE'
            };
          }
        }
      }

      // 3. Point ↔ Line
      if ((e1.type === 'POINT' && e2.type === 'LINE') || (e1.type === 'LINE' && e2.type === 'POINT')) {
        const ptEnt = (e1.type === 'POINT' ? e1 : e2) as SketchPoint2D;
        const lineEnt = (e1.type === 'LINE' ? e1 : e2) as SketchLine2D;
        const lp1 = entities[lineEnt.startPointId] as SketchPoint2D;
        const lp2 = entities[lineEnt.endPointId] as SketchPoint2D;

        if (ptEnt && lp1 && lp2) {
          const ldx = lp2.x - lp1.x;
          const ldy = lp2.y - lp1.y;
          const len = Math.hypot(ldx, ldy);
          let dist = 0;
          if (len > 0) {
            dist = Math.abs(ldy * ptEnt.x - ldx * ptEnt.y + lp2.x * lp1.y - lp2.y * lp1.x) / len;
          }
          return {
            type: 'PERPENDICULAR_DISTANCE',
            defaultName: `PerpDist_${ptEnt.id}_${lineEnt.id}`,
            initialValue: dist,
            placement: cursorPosition || { x: (ptEnt.x + lp1.x) / 2, y: (ptEnt.y + lp1.y) / 2 },
            constraintType: 'DISTANCE'
          };
        }
      }

      // 4. Circle ↔ Circle
      if (e1.type === 'CIRCLE' && e2.type === 'CIRCLE') {
        const c1 = e1 as SketchCircle2D;
        const c2 = e2 as SketchCircle2D;
        const cp1 = entities[c1.centerPointId] as SketchPoint2D;
        const cp2 = entities[c2.centerPointId] as SketchPoint2D;
        if (cp1 && cp2) {
          const dist = Math.hypot(cp2.x - cp1.x, cp2.y - cp1.y);
          return {
            type: 'DISTANCE',
            defaultName: `Dist_${c1.id}_${c2.id}`,
            initialValue: dist,
            placement: cursorPosition || { x: (cp1.x + cp2.x) / 2, y: (cp1.y + cp2.y) / 2 },
            constraintType: 'DISTANCE'
          };
        }
      }
    }

    return null;
  }

  // ============================================================================
  // 3. DIMENSION CREATION & GCS INTEGRATION
  // ============================================================================

  public static createDimension(
    spec: DimensionCreateSpec,
    sketch: IndustrialSketchDefinition
  ): {
    dimension: SketchDimension;
    updatedSketch: IndustrialSketchDefinition;
    constraint?: IndustrialSketchConstraint;
  } {
    const updatedSketch: IndustrialSketchDefinition = JSON.parse(JSON.stringify(sketch));
    if (!updatedSketch.dimensions) {
      updatedSketch.dimensions = {};
    }

    const dimId = spec.id || `dim-${this.randomId()}`;
    const unit: DimensionUnit = spec.unit || 'mm';
    const isDriving = spec.isDriving !== undefined ? spec.isDriving : true;

    // Calculate inferred type & initial value if not explicitly given
    const inferred = this.inferDimensionType(spec.entityIds, updatedSketch, spec.position);
    const dimType: DimensionType = spec.type || (inferred ? inferred.type : 'DISTANCE');
    const rawVal = spec.value !== undefined ? spec.value : (inferred ? inferred.initialValue : 50);
    const standardVal = this.convertToStandardUnit(rawVal, unit);
    const displayVal = this.convertFromStandardUnit(standardVal, unit);
    const placement = spec.position || (inferred ? inferred.placement : { x: 0, y: 0 });

    const constraintId = `c-dim-${dimId}`;
    let constraint: IndustrialSketchConstraint | undefined;

    // If Driving, create and link underlying GCS constraint
    if (isDriving) {
      let gcsType: IndustrialConstraintType = 'DISTANCE';
      let cEntityIds: string[] = [...spec.entityIds];

      if (dimType === 'RADIUS') {
        gcsType = 'RADIUS';
      } else if (dimType === 'DIAMETER') {
        gcsType = 'DIAMETER';
      } else if (dimType === 'ANGLE') {
        gcsType = 'ANGLE';
      } else if (dimType === 'HORIZONTAL_DISTANCE') {
        gcsType = 'DISTANCE';
      } else if (dimType === 'VERTICAL_DISTANCE') {
        gcsType = 'DISTANCE';
      } else {
        gcsType = 'DISTANCE';
      }

      constraint = {
        id: constraintId,
        type: gcsType,
        entityIds: cEntityIds,
        value: standardVal,
        unit: unit,
        isDriving: true,
        expression: spec.expression
      };

      updatedSketch.constraints[constraintId] = constraint;
    }

    const provenanceEntry: DimensionProvenanceEntry = {
      timestamp: new Date().toISOString(),
      action: 'CREATED',
      newValue: standardVal,
      isDriving: isDriving,
      authorId: spec.authorId || 'CAD_ENGINEER',
      transactionId: `TX-${this.randomId()}`
    };

    const dimension: SketchDimension = {
      id: dimId,
      name: spec.name || (inferred ? inferred.defaultName : `Dim_${dimId}`),
      type: dimType,
      entityIds: spec.entityIds,
      constraintId: isDriving ? constraintId : '',
      value: standardVal,
      displayValue: displayVal,
      unit: unit,
      isDriving: isDriving,
      position: placement,
      expression: spec.expression,
      tolerance: spec.tolerance,
      provenance: {
        creator: spec.authorId || 'CAD_ENGINEER',
        createdAt: new Date().toISOString(),
        modificationHistory: [provenanceEntry]
      }
    };

    updatedSketch.dimensions[dimId] = dimension;

    return {
      dimension,
      updatedSketch,
      constraint
    };
  }

  // ============================================================================
  // 4. DIMENSION EDITING & GCS RE-SOLVING
  // ============================================================================

  public static editDimensionValue(
    dimensionId: string,
    newValueInput: number | string,
    sketch: IndustrialSketchDefinition,
    solver?: IndustrialVariationalSolver,
    authorId = 'CAD_ENGINEER'
  ): {
    updatedSketch: IndustrialSketchDefinition;
    dimension: SketchDimension;
    solveResult?: SolveResult;
  } {
    const updatedSketch: IndustrialSketchDefinition = JSON.parse(JSON.stringify(sketch));
    if (!updatedSketch.dimensions || !updatedSketch.dimensions[dimensionId]) {
      throw new Error(`Dimension with ID '${dimensionId}' not found in sketch.`);
    }

    const dim = updatedSketch.dimensions[dimensionId];
    const prevValue = dim.value;
    const parsed = this.parseUnitInput(newValueInput, dim.unit);

    dim.value = parsed.standardValue;
    dim.unit = parsed.unit;
    dim.displayValue = this.convertFromStandardUnit(dim.value, dim.unit);

    const historyEntry: DimensionProvenanceEntry = {
      timestamp: new Date().toISOString(),
      action: 'EDITED',
      previousValue: prevValue,
      newValue: dim.value,
      isDriving: dim.isDriving,
      authorId,
      transactionId: `TX-${this.randomId()}`
    };
    dim.provenance.modificationHistory.push(historyEntry);

    let solveResult: SolveResult | undefined;

    if (dim.isDriving && dim.constraintId && updatedSketch.constraints[dim.constraintId]) {
      const constraint = updatedSketch.constraints[dim.constraintId];
      constraint.value = dim.value;
      constraint.unit = dim.unit;

      const gcsSolver = solver || new IndustrialVariationalSolver();
      solveResult = gcsSolver.solve(updatedSketch, dim.constraintId);
      // Synchronize back geometry from solveResult
      if (solveResult) {
        updatedSketch.entities = solveResult.sketch.entities;
        updatedSketch.constraints = solveResult.sketch.constraints;
      }
    }

    // Refresh all reference dimensions
    this.updateReferenceDimensions(updatedSketch);

    return {
      updatedSketch,
      dimension: dim,
      solveResult
    };
  }

  // ============================================================================
  // 5. DRIVING ↔ REFERENCE CONVERSION
  // ============================================================================

  public static convertDrivingToReference(
    dimensionId: string,
    sketch: IndustrialSketchDefinition
  ): {
    updatedSketch: IndustrialSketchDefinition;
    dimension: SketchDimension;
  } {
    const updatedSketch: IndustrialSketchDefinition = JSON.parse(JSON.stringify(sketch));
    if (!updatedSketch.dimensions || !updatedSketch.dimensions[dimensionId]) {
      throw new Error(`Dimension with ID '${dimensionId}' not found.`);
    }

    const dim = updatedSketch.dimensions[dimensionId];
    if (!dim.isDriving) return { updatedSketch, dimension: dim };

    // Remove or suppress GCS constraint
    if (dim.constraintId && updatedSketch.constraints[dim.constraintId]) {
      delete updatedSketch.constraints[dim.constraintId];
    }

    dim.isDriving = false;
    dim.constraintId = '';

    dim.provenance.modificationHistory.push({
      timestamp: new Date().toISOString(),
      action: 'CONVERTED_TO_REFERENCE',
      previousValue: dim.value,
      newValue: dim.value,
      isDriving: false,
      authorId: 'CAD_ENGINEER',
      transactionId: `TX-${this.randomId()}`
    });

    // Re-measure from current geometry
    this.updateSingleDimensionMeasurement(dim, updatedSketch);

    return { updatedSketch, dimension: dim };
  }

  public static convertReferenceToDriving(
    dimensionId: string,
    sketch: IndustrialSketchDefinition,
    solver?: IndustrialVariationalSolver
  ): {
    success: boolean;
    updatedSketch: IndustrialSketchDefinition;
    dimension: SketchDimension;
    error?: string;
    conflictReport?: any;
  } {
    const updatedSketch: IndustrialSketchDefinition = JSON.parse(JSON.stringify(sketch));
    if (!updatedSketch.dimensions || !updatedSketch.dimensions[dimensionId]) {
      return { success: false, updatedSketch: sketch, dimension: null as any, error: 'Dimension not found' };
    }

    const dim = updatedSketch.dimensions[dimensionId];
    if (dim.isDriving) {
      return { success: true, updatedSketch, dimension: dim };
    }

    // Pre-flight test: Create GCS constraint and solve test
    const constraintId = `c-dim-${dim.id}`;
    let gcsType: IndustrialConstraintType = 'DISTANCE';
    if (dim.type === 'RADIUS') gcsType = 'RADIUS';
    else if (dim.type === 'DIAMETER') gcsType = 'DIAMETER';
    else if (dim.type === 'ANGLE') gcsType = 'ANGLE';

    const testConstraint: IndustrialSketchConstraint = {
      id: constraintId,
      type: gcsType,
      entityIds: [...dim.entityIds],
      value: dim.value,
      unit: dim.unit,
      isDriving: true
    };

    const testSketch: IndustrialSketchDefinition = JSON.parse(JSON.stringify(updatedSketch));
    testSketch.constraints[constraintId] = testConstraint;

    const gcsSolver = solver || new IndustrialVariationalSolver();
    const testResult = gcsSolver.solve(testSketch, constraintId);

    if (
      testResult.solutionState === 'OVER_CONSTRAINED' ||
      testResult.solutionState === 'INCONSISTENT' ||
      testResult.dofReport.state === 'OVER_CONSTRAINED' ||
      testResult.dofReport.state === 'INCONSISTENT'
    ) {
      return {
        success: false,
        updatedSketch: sketch, // Reject changes
        dimension: dim,
        error: `Cannot convert reference dimension to driving: creates over-constrained or conflicting system (${testResult.causalityReport.explanation})`,
        conflictReport: testResult.causalityReport
      };
    }

    // Commit changes
    updatedSketch.constraints[constraintId] = testConstraint;
    dim.isDriving = true;
    dim.constraintId = constraintId;
    updatedSketch.entities = testResult.sketch.entities;

    dim.provenance.modificationHistory.push({
      timestamp: new Date().toISOString(),
      action: 'CONVERTED_TO_DRIVING',
      previousValue: dim.value,
      newValue: dim.value,
      isDriving: true,
      authorId: 'CAD_ENGINEER',
      transactionId: `TX-${this.randomId()}`
    });

    return {
      success: true,
      updatedSketch,
      dimension: dim
    };
  }

  // ============================================================================
  // 6. REFERENCE MEASUREMENT UPDATES
  // ============================================================================

  public static updateReferenceDimensions(sketch: IndustrialSketchDefinition): void {
    if (!sketch.dimensions) return;
    for (const dim of Object.values(sketch.dimensions)) {
      if (!dim.isDriving) {
        this.updateSingleDimensionMeasurement(dim, sketch);
      }
    }
  }

  public static measureDimensionValue(
    dim: SketchDimension,
    sketch: IndustrialSketchDefinition
  ): number {
    const entities = sketch.entities;
    if (!dim.entityIds || dim.entityIds.length === 0) return dim.value;

    if (dim.entityIds.length === 1) {
      const ent = entities[dim.entityIds[0]];
      if (!ent) return dim.value;
      if (ent.type === 'LINE') {
        const l = ent as SketchLine2D;
        const p1 = entities[l.startPointId] as SketchPoint2D;
        const p2 = entities[l.endPointId] as SketchPoint2D;
        if (p1 && p2) {
          if (dim.type === 'HORIZONTAL_DISTANCE') return Math.abs(p2.x - p1.x);
          if (dim.type === 'VERTICAL_DISTANCE') return Math.abs(p2.y - p1.y);
          return Math.hypot(p2.x - p1.x, p2.y - p1.y);
        }
      } else if (ent.type === 'CIRCLE') {
        const c = ent as SketchCircle2D;
        if (dim.type === 'RADIUS') return c.radius;
        return c.radius * 2;
      } else if (ent.type === 'ARC') {
        const a = ent as SketchArc2D;
        return a.radius;
      } else if (ent.type === 'POINT') {
        const p = ent as SketchPoint2D;
        return Math.hypot(p.x, p.y);
      }
    } else if (dim.entityIds.length === 2) {
      const e1 = entities[dim.entityIds[0]];
      const e2 = entities[dim.entityIds[1]];
      if (!e1 || !e2) return dim.value;

      if (e1.type === 'POINT' && e2.type === 'POINT') {
        const p1 = e1 as SketchPoint2D;
        const p2 = e2 as SketchPoint2D;
        if (dim.type === 'HORIZONTAL_DISTANCE') return Math.abs(p2.x - p1.x);
        if (dim.type === 'VERTICAL_DISTANCE') return Math.abs(p2.y - p1.y);
        return Math.hypot(p2.x - p1.x, p2.y - p1.y);
      }

      if (e1.type === 'LINE' && e2.type === 'LINE') {
        const l1 = e1 as SketchLine2D;
        const l2 = e2 as SketchLine2D;
        const p1a = entities[l1.startPointId] as SketchPoint2D;
        const p1b = entities[l1.endPointId] as SketchPoint2D;
        const p2a = entities[l2.startPointId] as SketchPoint2D;
        const p2b = entities[l2.endPointId] as SketchPoint2D;
        if (p1a && p1b && p2a && p2b) {
          const v1 = { x: p1b.x - p1a.x, y: p1b.y - p1a.y };
          const v2 = { x: p2b.x - p2a.x, y: p2b.y - p2a.y };
          const len1 = Math.hypot(v1.x, v1.y);
          const len2 = Math.hypot(v2.x, v2.y);
          if (len1 > 0 && len2 > 0) {
            const dot = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (len1 * len2)));
            return Math.acos(dot) * (180 / Math.PI);
          }
        }
      }

      if (e1.type === 'CIRCLE' && e2.type === 'CIRCLE') {
        const c1 = e1 as SketchCircle2D;
        const c2 = e2 as SketchCircle2D;
        const cp1 = entities[c1.centerPointId] as SketchPoint2D;
        const cp2 = entities[c2.centerPointId] as SketchPoint2D;
        if (cp1 && cp2) {
          return Math.hypot(cp2.x - cp1.x, cp2.y - cp1.y);
        }
      }
    }

    return dim.value;
  }

  private static updateSingleDimensionMeasurement(
    dim: SketchDimension,
    sketch: IndustrialSketchDefinition
  ): void {
    const val = this.measureDimensionValue(dim, sketch);
    dim.value = val;
    dim.displayValue = this.convertFromStandardUnit(dim.value, dim.unit);
  }
}
