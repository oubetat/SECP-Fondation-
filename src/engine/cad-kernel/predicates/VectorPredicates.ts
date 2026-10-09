/**
 * SECP CAD Kernel — Vector Predicates & Primitives
 * Phase 2 (PATCH-018)
 */
import { Vector } from '../geometry/GeometryContracts';
import { GeometricTolerance, GeometricToleranceModel } from './GeometricTolerance';
import { GeometricPredicateResult, GeneralClassification } from './PredicateContracts';

export class VectorPredicates {
  /**
   * Validates whether a vector has valid finite components.
   */
  public static isValidVector(v: Vector): boolean {
    if (!v) return false;
    return GeometricTolerance.isFiniteNumber(v.x, v.y, v.z);
  }

  /**
   * Computes the dot product of two 3D vectors.
   */
  public static dotProduct(
    a: Vector,
    b: Vector
  ): GeometricPredicateResult<GeneralClassification, number> {
    if (!this.isValidVector(a) || !this.isValidVector(b)) {
      return {
        classification: 'INVALID',
        value: NaN,
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Vector components must be finite real numbers']
      };
    }
    const val = a.x * b.x + a.y * b.y + a.z * b.z;
    return {
      classification: 'TRUE',
      value: val,
      semantics: 'ROBUST_NUMERICAL',
      diagnostics: []
    };
  }

  /**
   * Computes the cross product of two 3D vectors: a x b.
   */
  public static crossProduct(
    a: Vector,
    b: Vector
  ): GeometricPredicateResult<GeneralClassification, Vector> {
    if (!this.isValidVector(a) || !this.isValidVector(b)) {
      return {
        classification: 'INVALID',
        value: { x: NaN, y: NaN, z: NaN },
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Vector components must be finite real numbers']
      };
    }
    const x = a.y * b.z - a.z * b.y;
    const y = a.z * b.x - a.x * b.z;
    const z = a.x * b.y - a.y * b.x;
    return {
      classification: 'TRUE',
      value: { x, y, z },
      semantics: 'ROBUST_NUMERICAL',
      diagnostics: []
    };
  }

  /**
   * Computes squared Euclidean length of vector.
   */
  public static squaredLength(
    v: Vector
  ): GeometricPredicateResult<GeneralClassification, number> {
    if (!this.isValidVector(v)) {
      return {
        classification: 'INVALID',
        value: NaN,
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Invalid vector coordinates']
      };
    }
    return {
      classification: 'TRUE',
      value: v.x * v.x + v.y * v.y + v.z * v.z,
      semantics: 'ROBUST_NUMERICAL',
      diagnostics: []
    };
  }

  /**
   * Computes Euclidean length of vector.
   */
  public static vectorLength(
    v: Vector
  ): GeometricPredicateResult<GeneralClassification, number> {
    if (!this.isValidVector(v)) {
      return {
        classification: 'INVALID',
        value: NaN,
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Invalid vector coordinates']
      };
    }
    return {
      classification: 'TRUE',
      value: Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),
      semantics: 'ROBUST_NUMERICAL',
      diagnostics: []
    };
  }

  /**
   * Normalizes a vector. Never produces NaN; returns INVALID if vector length is within zero-tolerance.
   */
  public static normalize(
    v: Vector,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<GeneralClassification, Vector> {
    if (!this.isValidVector(v)) {
      return {
        classification: 'INVALID',
        value: { x: NaN, y: NaN, z: NaN },
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Invalid vector coordinates']
      };
    }
    const lenSq = v.x * v.x + v.y * v.y + v.z * v.z;
    if (lenSq <= tolModel.absoluteLength * tolModel.absoluteLength) {
      return {
        classification: 'INVALID',
        value: { x: 0, y: 0, z: 0 },
        semantics: 'ROBUST_NUMERICAL',
        diagnostics: ['Cannot normalize zero-length or degenerate vector']
      };
    }
    const len = Math.sqrt(lenSq);
    return {
      classification: 'TRUE',
      value: { x: v.x / len, y: v.y / len, z: v.z / len },
      semantics: 'ROBUST_NUMERICAL',
      diagnostics: []
    };
  }

  /**
   * Predicate: Vector parallelism (a || b)
   * True if cross product magnitude is effectively zero relative to vector lengths.
   */
  public static parallel(
    a: Vector,
    b: Vector,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<GeneralClassification, boolean> {
    if (!this.isValidVector(a) || !this.isValidVector(b)) {
      return {
        classification: 'INVALID',
        value: false,
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Invalid vector inputs']
      };
    }
    const lenA = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    const lenB = Math.sqrt(b.x * b.x + b.y * b.y + b.z * b.z);
    if (lenA <= tolModel.absoluteLength || lenB <= tolModel.absoluteLength) {
      return {
        classification: 'INVALID',
        value: false,
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Parallelism undefined for zero-length vectors']
      };
    }
    const cross = this.crossProduct(a, b).value!;
    const crossLen = Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z);
    const sinAngle = crossLen / (lenA * lenB);

    const isPar = sinAngle <= tolModel.angularRad;
    return {
      classification: isPar ? 'TRUE' : 'FALSE',
      value: isPar,
      semantics: 'TOLERANCE_BASED',
      diagnostics: [`sin(theta) = ${sinAngle}`]
    };
  }

  /**
   * Predicate: Vector perpendicularity (a ⟂ b)
   * True if dot product relative to vector lengths is within angular tolerance.
   */
  public static perpendicular(
    a: Vector,
    b: Vector,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<GeneralClassification, boolean> {
    if (!this.isValidVector(a) || !this.isValidVector(b)) {
      return {
        classification: 'INVALID',
        value: false,
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Invalid vector inputs']
      };
    }
    const lenA = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    const lenB = Math.sqrt(b.x * b.x + b.y * b.y + b.z * b.z);
    if (lenA <= tolModel.absoluteLength || lenB <= tolModel.absoluteLength) {
      return {
        classification: 'INVALID',
        value: false,
        semantics: 'TOLERANCE_BASED',
        diagnostics: ['Perpendicularity undefined for zero-length vectors']
      };
    }
    const dot = a.x * b.x + a.y * b.y + a.z * b.z;
    const cosAngle = Math.abs(dot) / (lenA * lenB);
    const isPerp = cosAngle <= tolModel.angularRad;

    return {
      classification: isPerp ? 'TRUE' : 'FALSE',
      value: isPerp,
      semantics: 'TOLERANCE_BASED',
      diagnostics: [`cos(theta) = ${cosAngle}`]
    };
  }

  /**
   * Predicate: Vectors point in the same direction (parallel and dot product > 0).
   */
  public static sameDirection(
    a: Vector,
    b: Vector,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<GeneralClassification, boolean> {
    const parRes = this.parallel(a, b, tolModel);
    if (parRes.classification !== 'TRUE') {
      return parRes;
    }
    const dot = a.x * b.x + a.y * b.y + a.z * b.z;
    const same = dot > 0;
    return {
      classification: same ? 'TRUE' : 'FALSE',
      value: same,
      semantics: 'TOLERANCE_BASED',
      diagnostics: [`dotProduct = ${dot}`]
    };
  }

  /**
   * Predicate: Vectors point in opposite directions (parallel and dot product < 0).
   */
  public static oppositeDirection(
    a: Vector,
    b: Vector,
    tolModel: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): GeometricPredicateResult<GeneralClassification, boolean> {
    const parRes = this.parallel(a, b, tolModel);
    if (parRes.classification !== 'TRUE') {
      return parRes;
    }
    const dot = a.x * b.x + a.y * b.y + a.z * b.z;
    const opp = dot < 0;
    return {
      classification: opp ? 'TRUE' : 'FALSE',
      value: opp,
      semantics: 'TOLERANCE_BASED',
      diagnostics: [`dotProduct = ${dot}`]
    };
  }
}
