/**
 * SECP CAD Kernel — Orientation & Dimensionality Predicates
 * Phase 2 (PATCH-018)
 */
import { Point } from '../geometry/GeometryContracts';
import { GeometricTolerance, GeometricToleranceModel } from './GeometricTolerance';
import {
  GeometricPredicateResult,
  Orientation2DClassification,
  Orientation3DClassification,
  CollinearityClassification,
  CoplanarityClassification
} from './PredicateContracts';

export class OrientationPredicates {
  /**
   * Evaluates 2D orientation of 3 points: A -> B -> C.
   * Positive det => Counter-Clockwise (CCW / Left turn)
   * Negative det => Clockwise (CW / Right turn)
   * Zero det => Collinear
   */
  public static orientation2D(
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number },
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<Orientation2DClassification, number> {
    if (!a || !b || !c || !GeometricTolerance.isFiniteNumber(a.x, a.y, b.x, b.y, c.x, c.y)) {
      return {
        classification: 'INVALID',
        value: NaN,
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Points contain non-finite coordinates']
      };
    }

    const ux = b.x - a.x;
    const uy = b.y - a.y;
    const vx = c.x - a.x;
    const vy = c.y - a.y;

    const det = ux * vy - uy * vx;

    // Characteristic scale of triangle edges
    const lenU = Math.hypot(ux, uy);
    const lenV = Math.hypot(vx, vy);
    const maxCoord = Math.max(Math.abs(a.x), Math.abs(a.y), Math.abs(b.x), Math.abs(b.y), Math.abs(c.x), Math.abs(c.y));

    // If edges are degenerate (points coincident)
    if (lenU <= tolModel.absoluteLength || lenV <= tolModel.absoluteLength) {
      return {
        classification: 'COLLINEAR',
        value: det,
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Coincident points in 2D orientation']
      };
    }

    const detTol = GeometricTolerance.getScaleAwareDet2DTolerance(maxCoord, tolModel);
    // Condition check: if det is close to the error bound of floating point operations (2 * eps * lenU * lenV)
    const errBound = 4 * Number.EPSILON * lenU * lenV * (maxCoord + 1);

    if (Math.abs(det) < detTol) {
      return {
        classification: 'COLLINEAR',
        value: det,
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: [`Determinant within collinearity tolerance: det=${det}, tol=${detTol}`]
      };
    }

    if (Math.abs(det) < errBound) {
      return {
        classification: 'INDETERMINATE',
        value: det,
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: [`Determinant |${det}| below numerical conditioning limit ${errBound}`]
      };
    }

    return {
      classification: det > 0 ? 'COUNTERCLOCKWISE' : 'CLOCKWISE',
      value: det,
      semantics: 'ROBUST_NUMERICAL',
      diagnostics: [`det = ${det}`]
    };
  }

  /**
   * Evaluates 3D orientation (signed tetrahedral volume * 6) for 4 points: A, B, C, D.
   * det(B-A, C-A, D-A).
   */
  public static orientation3D(
    a: Point,
    b: Point,
    c: Point,
    d: Point,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<Orientation3DClassification, number> {
    if (!a || !b || !c || !d || !GeometricTolerance.isFiniteNumber(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z)) {
      return {
        classification: 'INVALID',
        value: NaN,
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Points contain non-finite coordinates']
      };
    }

    const ax = a.x, ay = a.y, az = a.z;
    const bx = b.x - ax, by = b.y - ay, bz = b.z - az;
    const cx = c.x - ax, cy = c.y - ay, cz = c.z - az;
    const dx = d.x - ax, dy = d.y - ay, dz = d.z - az;

    // Cross product (C-A) x (D-A)
    const crossX = cy * dz - cz * dy;
    const crossY = cz * dx - cx * dz;
    const crossZ = cx * dy - cy * dx;

    // Dot product (B-A) . ((C-A) x (D-A))
    const det = bx * crossX + by * crossY + bz * crossZ;

    const maxCoord = Math.max(
      Math.abs(a.x), Math.abs(a.y), Math.abs(a.z),
      Math.abs(b.x), Math.abs(b.y), Math.abs(b.z),
      Math.abs(c.x), Math.abs(c.y), Math.abs(c.z),
      Math.abs(d.x), Math.abs(d.y), Math.abs(d.z)
    );

    const detTol = GeometricTolerance.getScaleAwareDet3DTolerance(maxCoord, tolModel);

    if (Math.abs(det) <= detTol) {
      return {
        classification: 'COPLANAR',
        value: det,
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: [`Signed volume |${det}| within coplanarity tolerance ${detTol}`]
      };
    }

    return {
      classification: det > 0 ? 'POSITIVE' : 'NEGATIVE',
      value: det,
      semantics: 'ROBUST_NUMERICAL',
      diagnostics: [`Signed volume 6V = ${det}`]
    };
  }

  /**
   * Evaluates if 3 points in 3D are collinear.
   */
  public static areCollinear(
    a: Point,
    b: Point,
    c: Point,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<CollinearityClassification, number> {
    if (!a || !b || !c || !GeometricTolerance.isFiniteNumber(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)) {
      return {
        classification: 'INVALID',
        value: NaN,
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Points contain non-finite coordinates']
      };
    }

    const abX = b.x - a.x, abY = b.y - a.y, abZ = b.z - a.z;
    const acX = c.x - a.x, acY = c.y - a.y, acZ = c.z - a.z;

    const crossX = abY * acZ - abZ * acY;
    const crossY = abZ * acX - abX * acZ;
    const crossZ = abX * acY - abY * acX;

    const crossLen = Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ);
    const lenAB = Math.sqrt(abX * abX + abY * abY + abZ * abZ);
    const lenAC = Math.sqrt(acX * acX + acY * acY + acZ * acZ);

    const maxCoord = Math.max(Math.abs(a.x), Math.abs(b.x), Math.abs(c.x));
    const lenTol = GeometricTolerance.getScaleAwareLengthTolerance(maxCoord, tolModel);

    // If points are coincident, they are trivially collinear
    if (lenAB <= lenTol || lenAC <= lenTol) {
      return {
        classification: 'TRUE_COLLINEAR',
        value: 0,
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Points are coincident']
      };
    }

    // Distance from C to line AB = crossLen / lenAB
    const distanceToLine = crossLen / lenAB;
    const isCollinear = distanceToLine <= lenTol;

    return {
      classification: isCollinear ? 'TRUE_COLLINEAR' : 'NOT_COLLINEAR',
      value: distanceToLine,
      semantics: 'TOLERANCE_BASED',
      diagnostics: [`Distance from point C to line AB: ${distanceToLine}, tol: ${lenTol}`]
    };
  }

  /**
   * Evaluates if 4 points in 3D are coplanar.
   */
  public static areCoplanar(
    a: Point,
    b: Point,
    c: Point,
    d: Point,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<CoplanarityClassification, number> {
    const o3d = this.orientation3D(a, b, c, d, tolModel);
    if (o3d.classification === 'INVALID') {
      return {
        classification: 'INVALID',
        value: NaN,
        semantics: 'TOLERANCE_BASED',
        diagnostics: o3d.diagnostics
      };
    }

    // Check if triangle ABC is non-degenerate
    const coll = this.areCollinear(a, b, c, tolModel);
    if (coll.classification === 'TRUE_COLLINEAR') {
      // Degenerate base triangle ABC; check if ABD or BCD forms a plane
      const collABD = this.areCollinear(a, b, d, tolModel);
      if (collABD.classification === 'TRUE_COLLINEAR') {
        // All 4 points are collinear, therefore coplanar
        return {
          classification: 'COPLANAR',
          value: 0,
          semantics: 'TOLERANCE_BASED',
          diagnostics: ['All points are collinear, hence coplanar']
        };
      }
    }

    const isCoplanar = o3d.classification === 'COPLANAR';
    return {
      classification: isCoplanar ? 'COPLANAR' : 'NOT_COPLANAR',
      value: o3d.value,
      semantics: 'TOLERANCE_BASED',
      diagnostics: o3d.diagnostics
    };
  }
}
