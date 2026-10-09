/**
 * SECP Industrial OS v2 — GCS Benchmark Case Registry
 * Phase 15 (PATCH-173)
 *
 * Ground-truth test suite covering basic sketches, DOF qualification,
 * under/over-constrained systems, contradictory constraints, numerical stability,
 * graph propagation, parametric regeneration, and adversarial chains.
 */

import { GCSBenchmarkCase } from './types';
import { IndustrialSketchDefinition, IndustrialSketchConstraint, SketchPoint2D, SketchLine2D, SketchCircle2D } from '../../sketch/IndustrialConstraintTypes';

export class GCSBenchmarkCaseRegistry {
  private static cases: GCSBenchmarkCase[] = [
    // ------------------------------------------------------------------------
    // CATEGORY A: BASIC SOLVER REFERENCE SKETCHES
    // ------------------------------------------------------------------------
    {
      id: 'GCS-A01-HORIZ-LINE',
      title: 'Sketch 1: Horizontal Line with Fixed Length',
      category: 'A_BASIC_SOLVER',
      description: 'Single line with fixed start point, horizontal constraint, and explicit length constraint (100mm).',
      expectedState: 'FULLY_CONSTRAINED',
      expectedFinalDOF: 0,
      generator: () => {
        const sketch: IndustrialSketchDefinition = {
          id: 'sketch-a01',
          name: 'Horizontal Line',
          plane: 'XY',
          revision: 1,
          entities: {
            'p1': { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true } as SketchPoint2D,
            'p2': { id: 'p2', type: 'POINT', x: 80, y: 20 } as SketchPoint2D,
            'l1': { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' } as SketchLine2D
          },
          constraints: {
            'c-horiz': { id: 'c-horiz', type: 'HORIZONTAL', entityIds: ['l1'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-dist': { id: 'c-dist', type: 'DISTANCE', entityIds: ['p1', 'p2'], value: 100, suppressionState: 'ACTIVE' } as IndustrialSketchConstraint
          }
        };
        return { sketch, targetConstraints: Object.values(sketch.constraints) };
      }
    },
    {
      id: 'GCS-A02-VERT-LINE',
      title: 'Sketch 2: Vertical Line with Fixed Length',
      category: 'A_BASIC_SOLVER',
      description: 'Single line with fixed start point, vertical constraint, and explicit length constraint (80mm).',
      expectedState: 'FULLY_CONSTRAINED',
      expectedFinalDOF: 0,
      generator: () => {
        const sketch: IndustrialSketchDefinition = {
          id: 'sketch-a02',
          name: 'Vertical Line',
          plane: 'XY',
          revision: 1,
          entities: {
            'p1': { id: 'p1', type: 'POINT', x: 10, y: 10, isFixed: true } as SketchPoint2D,
            'p2': { id: 'p2', type: 'POINT', x: 30, y: 60 } as SketchPoint2D,
            'l1': { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' } as SketchLine2D
          },
          constraints: {
            'c-vert': { id: 'c-vert', type: 'VERTICAL', entityIds: ['l1'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-dist': { id: 'c-dist', type: 'DISTANCE', entityIds: ['p1', 'p2'], value: 80, suppressionState: 'ACTIVE' } as IndustrialSketchConstraint
          }
        };
        return { sketch, targetConstraints: Object.values(sketch.constraints) };
      }
    },
    {
      id: 'GCS-A03-RECTANGLE',
      title: 'Sketch 3: Fully Constrained Rectangle',
      category: 'A_BASIC_SOLVER',
      description: '4-sided rectangle with fixed bottom-left corner, horizontal/vertical edges, and width (60mm) / height (40mm).',
      expectedState: 'FULLY_CONSTRAINED',
      expectedFinalDOF: 0,
      generator: () => {
        const sketch: IndustrialSketchDefinition = {
          id: 'sketch-a03',
          name: 'Rectangle',
          plane: 'XY',
          revision: 1,
          entities: {
            'p1': { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true } as SketchPoint2D,
            'p2': { id: 'p2', type: 'POINT', x: 50, y: 5 } as SketchPoint2D,
            'p3': { id: 'p3', type: 'POINT', x: 55, y: 35 } as SketchPoint2D,
            'p4': { id: 'p4', type: 'POINT', x: 5, y: 40 } as SketchPoint2D,
            'l1': { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' } as SketchLine2D,
            'l2': { id: 'l2', type: 'LINE', startPointId: 'p2', endPointId: 'p3' } as SketchLine2D,
            'l3': { id: 'l3', type: 'LINE', startPointId: 'p3', endPointId: 'p4' } as SketchLine2D,
            'l4': { id: 'l4', type: 'LINE', startPointId: 'p4', endPointId: 'p1' } as SketchLine2D,
          },
          constraints: {
            'c-h1': { id: 'c-h1', type: 'HORIZONTAL', entityIds: ['l1'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-v1': { id: 'c-v1', type: 'VERTICAL', entityIds: ['l2'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-h2': { id: 'c-h2', type: 'HORIZONTAL', entityIds: ['l3'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-v2': { id: 'c-v2', type: 'VERTICAL', entityIds: ['l4'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-w': { id: 'c-w', type: 'DISTANCE', entityIds: ['p1', 'p2'], value: 60, suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-h': { id: 'c-h', type: 'DISTANCE', entityIds: ['p1', 'p4'], value: 40, suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
          }
        };
        return { sketch, targetConstraints: Object.values(sketch.constraints) };
      }
    },
    {
      id: 'GCS-A04-CIRCLES-TANGENCY',
      title: 'Sketch 4: Two Circles with Equal, Distance & Tangency',
      category: 'A_BASIC_SOLVER',
      description: 'Two circles with equal radii, fixed center spacing, and a common tangent line.',
      expectedState: 'UNDER_CONSTRAINED',
      expectedFinalDOF: 2,
      generator: () => {
        const sketch: IndustrialSketchDefinition = {
          id: 'sketch-a04',
          name: 'Two Circles Tangent',
          plane: 'XY',
          revision: 1,
          entities: {
            'cp1': { id: 'cp1', type: 'POINT', x: 0, y: 0, isFixed: true } as SketchPoint2D,
            'cp2': { id: 'cp2', type: 'POINT', x: 50, y: 0, isFixed: true } as SketchPoint2D,
            'c1': { id: 'c1', type: 'CIRCLE', centerPointId: 'cp1', radius: 15 } as SketchCircle2D,
            'c2': { id: 'c2', type: 'CIRCLE', centerPointId: 'cp2', radius: 10 } as SketchCircle2D,
            'tp1': { id: 'tp1', type: 'POINT', x: 0, y: 15 } as SketchPoint2D,
            'tp2': { id: 'tp2', type: 'POINT', x: 50, y: 15 } as SketchPoint2D,
            'tl': { id: 'tl', type: 'LINE', startPointId: 'tp1', endPointId: 'tp2' } as SketchLine2D
          },
          constraints: {
            'c-r1': { id: 'c-r1', type: 'RADIUS', entityIds: ['c1'], value: 20, suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-eq': { id: 'c-eq', type: 'EQUAL', entityIds: ['c1', 'c2'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-tan': { id: 'c-tan', type: 'TANGENT', entityIds: ['tl', 'c1'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-tan2': { id: 'c-tan2', type: 'TANGENT', entityIds: ['tl', 'c2'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint
          }
        };
        return { sketch, targetConstraints: Object.values(sketch.constraints) };
      }
    },
    {
      id: 'GCS-A05-TRIANGLE-ANGLES',
      title: 'Sketch 5: Triangle with Constrained Lengths & Angles',
      category: 'A_BASIC_SOLVER',
      description: 'Right triangle with base 50mm, height 50mm, fixed origin, and 90 deg corner angle.',
      expectedState: 'FULLY_CONSTRAINED',
      expectedFinalDOF: 0,
      generator: () => {
        const sketch: IndustrialSketchDefinition = {
          id: 'sketch-a05',
          name: 'Constrained Triangle',
          plane: 'XY',
          revision: 1,
          entities: {
            'p1': { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true } as SketchPoint2D,
            'p2': { id: 'p2', type: 'POINT', x: 45, y: 5 } as SketchPoint2D,
            'p3': { id: 'p3', type: 'POINT', x: 5, y: 45 } as SketchPoint2D,
            'l1': { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' } as SketchLine2D,
            'l2': { id: 'l2', type: 'LINE', startPointId: 'p1', endPointId: 'p3' } as SketchLine2D,
            'l3': { id: 'l3', type: 'LINE', startPointId: 'p2', endPointId: 'p3' } as SketchLine2D,
          },
          constraints: {
            'c-h': { id: 'c-h', type: 'HORIZONTAL', entityIds: ['l1'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-v': { id: 'c-v', type: 'VERTICAL', entityIds: ['l2'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-d1': { id: 'c-d1', type: 'DISTANCE', entityIds: ['p1', 'p2'], value: 50, suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-d2': { id: 'c-d2', type: 'DISTANCE', entityIds: ['p1', 'p3'], value: 50, suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
          }
        };
        return { sketch, targetConstraints: Object.values(sketch.constraints) };
      }
    },

    // ------------------------------------------------------------------------
    // CATEGORY B: DOF QUALIFICATION (UNDER / FULLY CONSTRAINED)
    // ------------------------------------------------------------------------
    {
      id: 'GCS-B01-FREE-POINT',
      title: 'DOF: Single Free Point (2 DOF)',
      category: 'B_DOF_QUALIFICATION',
      description: 'Single unconstrained point in 2D space.',
      expectedState: 'UNDER_CONSTRAINED',
      expectedFinalDOF: 2,
      generator: () => {
        const sketch: IndustrialSketchDefinition = {
          id: 'sketch-b01',
          name: 'Free Point',
          plane: 'XY',
          revision: 1,
          entities: {
            'p1': { id: 'p1', type: 'POINT', x: 15, y: 25 } as SketchPoint2D
          },
          constraints: {}
        };
        return { sketch, targetConstraints: [] };
      }
    },
    {
      id: 'GCS-B02-FREE-LINE',
      title: 'DOF: Free Line (4 DOF)',
      category: 'B_DOF_QUALIFICATION',
      description: 'Line with 2 unconstrained endpoints in 2D space.',
      expectedState: 'UNDER_CONSTRAINED',
      expectedFinalDOF: 4,
      generator: () => {
        const sketch: IndustrialSketchDefinition = {
          id: 'sketch-b02',
          name: 'Free Line',
          plane: 'XY',
          revision: 1,
          entities: {
            'p1': { id: 'p1', type: 'POINT', x: 0, y: 0 } as SketchPoint2D,
            'p2': { id: 'p2', type: 'POINT', x: 30, y: 40 } as SketchPoint2D,
            'l1': { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' } as SketchLine2D
          },
          constraints: {}
        };
        return { sketch, targetConstraints: [] };
      }
    },
    {
      id: 'GCS-B03-FLOATING-RECTANGLE',
      title: 'DOF: Sized Floating Rectangle (2 Remaining DOF)',
      category: 'B_DOF_QUALIFICATION',
      description: 'Rectangle with fixed dimensions (W=50, H=30) but unfixed origin position.',
      expectedState: 'UNDER_CONSTRAINED',
      expectedFinalDOF: 2,
      generator: () => {
        const sketch: IndustrialSketchDefinition = {
          id: 'sketch-b03',
          name: 'Floating Rectangle',
          plane: 'XY',
          revision: 1,
          entities: {
            'p1': { id: 'p1', type: 'POINT', x: 10, y: 10 } as SketchPoint2D,
            'p2': { id: 'p2', type: 'POINT', x: 60, y: 10 } as SketchPoint2D,
            'p3': { id: 'p3', type: 'POINT', x: 60, y: 40 } as SketchPoint2D,
            'p4': { id: 'p4', type: 'POINT', x: 10, y: 40 } as SketchPoint2D,
            'l1': { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' } as SketchLine2D,
            'l2': { id: 'l2', type: 'LINE', startPointId: 'p2', endPointId: 'p3' } as SketchLine2D,
            'l3': { id: 'l3', type: 'LINE', startPointId: 'p3', endPointId: 'p4' } as SketchLine2D,
            'l4': { id: 'l4', type: 'LINE', startPointId: 'p4', endPointId: 'p1' } as SketchLine2D,
          },
          constraints: {
            'c-h1': { id: 'c-h1', type: 'HORIZONTAL', entityIds: ['l1'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-v1': { id: 'c-v1', type: 'VERTICAL', entityIds: ['l2'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-h2': { id: 'c-h2', type: 'HORIZONTAL', entityIds: ['l3'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-v2': { id: 'c-v2', type: 'VERTICAL', entityIds: ['l4'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-w': { id: 'c-w', type: 'DISTANCE', entityIds: ['p1', 'p2'], value: 50, suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-h': { id: 'c-h', type: 'DISTANCE', entityIds: ['p1', 'p4'], value: 30, suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
          }
        };
        return { sketch, targetConstraints: Object.values(sketch.constraints) };
      }
    },

    // ------------------------------------------------------------------------
    // CATEGORY C: OVER-CONSTRAINED & INCONSISTENT
    // ------------------------------------------------------------------------
    {
      id: 'GCS-C01-HORIZ-AND-VERT',
      title: 'Over-Constrained: Line Both Horizontal & Vertical',
      category: 'C_OVER_CONSTRAINED',
      description: 'Single line forced to be both Horizontal and Vertical simultaneously.',
      expectedState: 'INCONSISTENT',
      expectedFinalDOF: 0,
      generator: () => {
        const sketch: IndustrialSketchDefinition = {
          id: 'sketch-c01',
          name: 'Contradictory Orientation',
          plane: 'XY',
          revision: 1,
          entities: {
            'p1': { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true } as SketchPoint2D,
            'p2': { id: 'p2', type: 'POINT', x: 50, y: 50 } as SketchPoint2D,
            'l1': { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' } as SketchLine2D
          },
          constraints: {
            'c-h': { id: 'c-h', type: 'HORIZONTAL', entityIds: ['l1'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-v': { id: 'c-v', type: 'VERTICAL', entityIds: ['l1'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint
          }
        };
        return { sketch, targetConstraints: Object.values(sketch.constraints) };
      }
    },
    {
      id: 'GCS-C02-CONFLICTING-DISTANCES',
      title: 'Over-Constrained: Line with Conflicting Lengths (50 vs 100)',
      category: 'C_OVER_CONSTRAINED',
      description: 'Single line with two contradictory distance constraints (50mm and 100mm).',
      expectedState: 'INCONSISTENT',
      expectedFinalDOF: 0,
      generator: () => {
        const sketch: IndustrialSketchDefinition = {
          id: 'sketch-c02',
          name: 'Conflicting Lengths',
          plane: 'XY',
          revision: 1,
          entities: {
            'p1': { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true } as SketchPoint2D,
            'p2': { id: 'p2', type: 'POINT', x: 60, y: 0 } as SketchPoint2D,
            'l1': { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' } as SketchLine2D
          },
          constraints: {
            'c-d1': { id: 'c-d1', type: 'DISTANCE', entityIds: ['p1', 'p2'], value: 50, suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-d2': { id: 'c-d2', type: 'DISTANCE', entityIds: ['p1', 'p2'], value: 100, suppressionState: 'ACTIVE' } as IndustrialSketchConstraint
          }
        };
        return { sketch, targetConstraints: Object.values(sketch.constraints) };
      }
    },

    // ------------------------------------------------------------------------
    // CATEGORY D: CONTRADICTORY CONSTRAINTS
    // ------------------------------------------------------------------------
    {
      id: 'GCS-D01-COINCIDENT-VS-DISTANCE',
      title: 'Contradiction: Coincident & Non-Zero Distance (25mm)',
      category: 'D_CONTRADICTORY_CONSTRAINTS',
      description: 'Two points defined as coincident while also constrained to distance = 25mm.',
      expectedState: 'INCONSISTENT',
      expectedFinalDOF: 0,
      generator: () => {
        const sketch: IndustrialSketchDefinition = {
          id: 'sketch-d01',
          name: 'Coincident vs Distance',
          plane: 'XY',
          revision: 1,
          entities: {
            'p1': { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true } as SketchPoint2D,
            'p2': { id: 'p2', type: 'POINT', x: 20, y: 10 } as SketchPoint2D,
          },
          constraints: {
            'c-coin': { id: 'c-coin', type: 'COINCIDENT', entityIds: ['p1', 'p2'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-dist': { id: 'c-dist', type: 'DISTANCE', entityIds: ['p1', 'p2'], value: 25, suppressionState: 'ACTIVE' } as IndustrialSketchConstraint
          }
        };
        return { sketch, targetConstraints: Object.values(sketch.constraints) };
      }
    },
    {
      id: 'GCS-D02-PARALLEL-VS-PERPENDICULAR',
      title: 'Contradiction: Lines Parallel & Perpendicular Simultaneously',
      category: 'D_CONTRADICTORY_CONSTRAINTS',
      description: 'Two lines constrained to be parallel and perpendicular at the same time.',
      expectedState: 'INCONSISTENT',
      expectedFinalDOF: 0,
      generator: () => {
        const sketch: IndustrialSketchDefinition = {
          id: 'sketch-d02',
          name: 'Parallel vs Perpendicular',
          plane: 'XY',
          revision: 1,
          entities: {
            'p1': { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true } as SketchPoint2D,
            'p2': { id: 'p2', type: 'POINT', x: 50, y: 0 } as SketchPoint2D,
            'p3': { id: 'p3', type: 'POINT', x: 0, y: 10, isFixed: true } as SketchPoint2D,
            'p4': { id: 'p4', type: 'POINT', x: 50, y: 10 } as SketchPoint2D,
            'l1': { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' } as SketchLine2D,
            'l2': { id: 'l2', type: 'LINE', startPointId: 'p3', endPointId: 'p4' } as SketchLine2D,
          },
          constraints: {
            'c-par': { id: 'c-par', type: 'PARALLEL', entityIds: ['l1', 'l2'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-perp': { id: 'c-perp', type: 'PERPENDICULAR', entityIds: ['l1', 'l2'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint
          }
        };
        return { sketch, targetConstraints: Object.values(sketch.constraints) };
      }
    },

    // ------------------------------------------------------------------------
    // CATEGORY E: REDUNDANT CONSTRAINTS
    // ------------------------------------------------------------------------
    {
      id: 'GCS-E01-DUPLICATE-HORIZONTAL',
      title: 'Redundancy: Duplicate Horizontal Constraints on Single Line',
      category: 'E_REDUNDANT_CONSTRAINTS',
      description: 'Two identical horizontal constraints applied to the same line without contradiction.',
      expectedState: 'REDUNDANT',
      expectedFinalDOF: 0,
      generator: () => {
        const sketch: IndustrialSketchDefinition = {
          id: 'sketch-e01',
          name: 'Duplicate Horizontal',
          plane: 'XY',
          revision: 1,
          entities: {
            'p1': { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true } as SketchPoint2D,
            'p2': { id: 'p2', type: 'POINT', x: 40, y: 10 } as SketchPoint2D,
            'l1': { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' } as SketchLine2D
          },
          constraints: {
            'c-h1': { id: 'c-h1', type: 'HORIZONTAL', entityIds: ['l1'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-h2': { id: 'c-h2', type: 'HORIZONTAL', entityIds: ['l1'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-d': { id: 'c-d', type: 'DISTANCE', entityIds: ['p1', 'p2'], value: 60, suppressionState: 'ACTIVE' } as IndustrialSketchConstraint
          }
        };
        return { sketch, targetConstraints: Object.values(sketch.constraints) };
      }
    },

    // ------------------------------------------------------------------------
    // CATEGORY F: NUMERICAL STABILITY & MULTI-SCALE
    // ------------------------------------------------------------------------
    {
      id: 'GCS-F01-MICRO-SCALE',
      title: 'Stability: Micro-Scale Geometry (1e-6 mm)',
      category: 'F_NUMERICAL_STABILITY',
      description: 'Rectangle with micro dimensions (1e-6 mm width, 0.5e-6 mm height).',
      expectedState: 'FULLY_CONSTRAINED',
      expectedFinalDOF: 0,
      generator: () => {
        const scale = 1e-6;
        const sketch: IndustrialSketchDefinition = {
          id: 'sketch-f01',
          name: 'Micro Rectangle',
          plane: 'XY',
          revision: 1,
          entities: {
            'p1': { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true } as SketchPoint2D,
            'p2': { id: 'p2', type: 'POINT', x: scale, y: 0 } as SketchPoint2D,
            'p3': { id: 'p3', type: 'POINT', x: scale, y: scale * 0.5 } as SketchPoint2D,
            'p4': { id: 'p4', type: 'POINT', x: 0, y: scale * 0.5 } as SketchPoint2D,
            'l1': { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' } as SketchLine2D,
            'l2': { id: 'l2', type: 'LINE', startPointId: 'p2', endPointId: 'p3' } as SketchLine2D,
            'l3': { id: 'l3', type: 'LINE', startPointId: 'p3', endPointId: 'p4' } as SketchLine2D,
            'l4': { id: 'l4', type: 'LINE', startPointId: 'p4', endPointId: 'p1' } as SketchLine2D,
          },
          constraints: {
            'c-h1': { id: 'c-h1', type: 'HORIZONTAL', entityIds: ['l1'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-v1': { id: 'c-v1', type: 'VERTICAL', entityIds: ['l2'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-h2': { id: 'c-h2', type: 'HORIZONTAL', entityIds: ['l3'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-v2': { id: 'c-v2', type: 'VERTICAL', entityIds: ['l4'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-w': { id: 'c-w', type: 'DISTANCE', entityIds: ['p1', 'p2'], value: scale, suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-h': { id: 'c-h', type: 'DISTANCE', entityIds: ['p1', 'p4'], value: scale * 0.5, suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
          }
        };
        return { sketch, targetConstraints: Object.values(sketch.constraints) };
      }
    },
    {
      id: 'GCS-F02-MACRO-SCALE',
      title: 'Stability: Macro-Scale Geometry (1e6 mm = 1 km)',
      category: 'F_NUMERICAL_STABILITY',
      description: 'Macro bridge truss with 1,000,000mm base and 200,000mm height.',
      expectedState: 'FULLY_CONSTRAINED',
      expectedFinalDOF: 0,
      generator: () => {
        const scale = 1e6;
        const sketch: IndustrialSketchDefinition = {
          id: 'sketch-f02',
          name: 'Macro Structure',
          plane: 'XY',
          revision: 1,
          entities: {
            'p1': { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true } as SketchPoint2D,
            'p2': { id: 'p2', type: 'POINT', x: scale * 0.9, y: 1000 } as SketchPoint2D,
            'l1': { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' } as SketchLine2D
          },
          constraints: {
            'c-h': { id: 'c-h', type: 'HORIZONTAL', entityIds: ['l1'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-d': { id: 'c-d', type: 'DISTANCE', entityIds: ['p1', 'p2'], value: scale, suppressionState: 'ACTIVE' } as IndustrialSketchConstraint
          }
        };
        return { sketch, targetConstraints: Object.values(sketch.constraints) };
      }
    },

    // ------------------------------------------------------------------------
    // CATEGORY G: CONSTRAINT GRAPH PROPAGATION & INCREMENTAL
    // ------------------------------------------------------------------------
    {
      id: 'GCS-G01-5-LINK-CHAIN',
      title: 'Graph: 5-Link Serial Kinematic Chain',
      category: 'G_CONSTRAINT_GRAPH_PROPAGATION',
      description: '5 serial lines chained endpoint-to-startpoint with distance and angle constraints.',
      expectedState: 'FULLY_CONSTRAINED',
      expectedFinalDOF: 0,
      generator: () => {
        const entities: Record<string, any> = {
          'p0': { id: 'p0', type: 'POINT', x: 0, y: 0, isFixed: true } as SketchPoint2D
        };
        const constraints: Record<string, IndustrialSketchConstraint> = {};

        for (let i = 1; i <= 5; i++) {
          const prevP = `p${i - 1}`;
          const currP = `p${i}`;
          const currL = `l${i}`;
          entities[currP] = { id: currP, type: 'POINT', x: i * 20, y: i * 5 } as SketchPoint2D;
          entities[currL] = { id: currL, type: 'LINE', startPointId: prevP, endPointId: currP } as SketchLine2D;

          constraints[`c-dist-${i}`] = {
            id: `c-dist-${i}`,
            type: 'DISTANCE',
            entityIds: [prevP, currP],
            value: 30,
            suppressionState: 'ACTIVE'
          } as IndustrialSketchConstraint;

          constraints[`c-horiz-${i}`] = {
            id: `c-horiz-${i}`,
            type: 'HORIZONTAL',
            entityIds: [currL],
            suppressionState: 'ACTIVE'
          } as IndustrialSketchConstraint;
        }

        const sketch: IndustrialSketchDefinition = {
          id: 'sketch-g01',
          name: '5-Link Chain',
          plane: 'XY',
          revision: 1,
          entities,
          constraints
        };
        return { sketch, targetConstraints: Object.values(constraints) };
      }
    },

    // ------------------------------------------------------------------------
    // CATEGORY H: PARAMETRIC REGENERATION
    // ------------------------------------------------------------------------
    {
      id: 'GCS-H01-PARAMETRIC-SCALING',
      title: 'Parametric: Dynamic Dimension Parameter Update',
      category: 'H_PARAMETRIC_REGENERATION',
      description: 'Solve rectangle -> mutate width parameter (50 -> 120) and height (30 -> 75) -> re-solve.',
      expectedState: 'FULLY_CONSTRAINED',
      expectedFinalDOF: 0,
      generator: () => {
        const sketch: IndustrialSketchDefinition = {
          id: 'sketch-h01',
          name: 'Parametric Rectangle',
          plane: 'XY',
          revision: 1,
          entities: {
            'p1': { id: 'p1', type: 'POINT', x: 0, y: 0, isFixed: true } as SketchPoint2D,
            'p2': { id: 'p2', type: 'POINT', x: 50, y: 0 } as SketchPoint2D,
            'p3': { id: 'p3', type: 'POINT', x: 50, y: 30 } as SketchPoint2D,
            'p4': { id: 'p4', type: 'POINT', x: 0, y: 30 } as SketchPoint2D,
            'l1': { id: 'l1', type: 'LINE', startPointId: 'p1', endPointId: 'p2' } as SketchLine2D,
            'l2': { id: 'l2', type: 'LINE', startPointId: 'p2', endPointId: 'p3' } as SketchLine2D,
            'l3': { id: 'l3', type: 'LINE', startPointId: 'p3', endPointId: 'p4' } as SketchLine2D,
            'l4': { id: 'l4', type: 'LINE', startPointId: 'p4', endPointId: 'p1' } as SketchLine2D,
          },
          constraints: {
            'c-h1': { id: 'c-h1', type: 'HORIZONTAL', entityIds: ['l1'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-v1': { id: 'c-v1', type: 'VERTICAL', entityIds: ['l2'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-h2': { id: 'c-h2', type: 'HORIZONTAL', entityIds: ['l3'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-v2': { id: 'c-v2', type: 'VERTICAL', entityIds: ['l4'], suppressionState: 'ACTIVE' } as IndustrialSketchConstraint,
            'c-w': { id: 'c-w', type: 'DISTANCE', entityIds: ['p1', 'p2'], value: 120, suppressionState: 'ACTIVE', parameterBinding: 'RECT_W' } as IndustrialSketchConstraint,
            'c-h': { id: 'c-h', type: 'DISTANCE', entityIds: ['p1', 'p4'], value: 75, suppressionState: 'ACTIVE', parameterBinding: 'RECT_H' } as IndustrialSketchConstraint,
          }
        };
        return { sketch, targetConstraints: Object.values(sketch.constraints) };
      }
    },

    // ------------------------------------------------------------------------
    // CATEGORY I: ADVERSARIAL CHAINS & ORDER INVARIANCE
    // ------------------------------------------------------------------------
    {
      id: 'GCS-I01-20-NODE-CHAIN',
      title: 'Adversarial: 20-Node Serial Coordinate Propagation',
      category: 'I_ADVERSARIAL_CHAINS',
      description: '20 consecutive constrained segments testing propagation depth and cumulative error.',
      expectedState: 'FULLY_CONSTRAINED',
      expectedFinalDOF: 0,
      generator: () => {
        const entities: Record<string, any> = {
          'p0': { id: 'p0', type: 'POINT', x: 0, y: 0, isFixed: true } as SketchPoint2D
        };
        const constraints: Record<string, IndustrialSketchConstraint> = {};

        for (let i = 1; i <= 20; i++) {
          const prevP = `p${i - 1}`;
          const currP = `p${i}`;
          const currL = `l${i}`;
          entities[currP] = { id: currP, type: 'POINT', x: i * 9.5, y: (i % 2 === 0 ? 1.5 : -1.5) } as SketchPoint2D;
          entities[currL] = { id: currL, type: 'LINE', startPointId: prevP, endPointId: currP } as SketchLine2D;

          constraints[`c-dist-${i}`] = {
            id: `c-dist-${i}`,
            type: 'DISTANCE',
            entityIds: [prevP, currP],
            value: 10,
            suppressionState: 'ACTIVE'
          } as IndustrialSketchConstraint;

          constraints[`c-horiz-${i}`] = {
            id: `c-horiz-${i}`,
            type: 'HORIZONTAL',
            entityIds: [currL],
            suppressionState: 'ACTIVE'
          } as IndustrialSketchConstraint;
        }

        const sketch: IndustrialSketchDefinition = {
          id: 'sketch-i01',
          name: '20-Node Adversarial Chain',
          plane: 'XY',
          revision: 1,
          entities,
          constraints
        };
        return { sketch, targetConstraints: Object.values(constraints) };
      }
    }
  ];

  public static getAllCases(): GCSBenchmarkCase[] {
    return [...this.cases];
  }

  public static getCasesByCategory(category: string): GCSBenchmarkCase[] {
    return this.cases.filter(c => c.category === category);
  }
}
