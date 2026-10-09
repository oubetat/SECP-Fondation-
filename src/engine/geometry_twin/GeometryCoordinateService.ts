// SECP Industrial OS v2 — Geometry Coordinate & Unit Service
import { GeometryCoordinateSystem, LengthUnit, Vector3D } from './types';

export class GeometryCoordinateService {
  private static readonly UNIT_CONVERSIONS_TO_MM: Record<LengthUnit, number> = {
    mm: 1.0,
    cm: 10.0,
    m: 1000.0,
    inch: 25.4,
    micron: 0.001
  };

  public static dot(a: Vector3D, b: Vector3D): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  public static cross(a: Vector3D, b: Vector3D): Vector3D {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  public static magnitude(v: Vector3D): number {
    return Math.sqrt(this.dot(v, v));
  }

  public static normalize(v: Vector3D): Vector3D {
    const mag = this.magnitude(v);
    if (mag < 1e-12) {
      throw new Error('Cannot normalize zero vector');
    }
    return {
      x: v.x / mag,
      y: v.y / mag,
      z: v.z / mag
    };
  }

  public static validateCoordinateSystem(cs: GeometryCoordinateSystem): {
    valid: boolean;
    error?: string;
  } {
    const eps = 1e-5;

    // Check normalization
    const magX = this.magnitude(cs.basisX);
    const magY = this.magnitude(cs.basisY);
    const magZ = this.magnitude(cs.basisZ);

    if (Math.abs(magX - 1.0) > eps || Math.abs(magY - 1.0) > eps || Math.abs(magZ - 1.0) > eps) {
      return { valid: false, error: 'INVALID_COORDINATE_SYSTEM: Basis vectors are not normalized' };
    }

    // Check orthogonality
    const dotXY = Math.abs(this.dot(cs.basisX, cs.basisY));
    const dotYZ = Math.abs(this.dot(cs.basisY, cs.basisZ));
    const dotZX = Math.abs(this.dot(cs.basisZ, cs.basisX));

    if (dotXY > eps || dotYZ > eps || dotZX > eps) {
      return { valid: false, error: 'INVALID_COORDINATE_SYSTEM: Basis vectors are not orthogonal' };
    }

    // Check handedness
    const computedZ = this.cross(cs.basisX, cs.basisY);
    const handednessDot = this.dot(computedZ, cs.basisZ);

    if (cs.handedness === 'RIGHT_HANDED' && handednessDot < 0.99) {
      return { valid: false, error: 'INVALID_COORDINATE_SYSTEM: Handedness mismatch for right-handed system' };
    }
    if (cs.handedness === 'LEFT_HANDED' && handednessDot > -0.99) {
      return { valid: false, error: 'INVALID_COORDINATE_SYSTEM: Handedness mismatch for left-handed system' };
    }

    return { valid: true };
  }

  public static convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
    const mmVal = value * this.UNIT_CONVERSIONS_TO_MM[from];
    return mmVal / this.UNIT_CONVERSIONS_TO_MM[to];
  }

  public static getConversionFactor(from: LengthUnit, to: LengthUnit = 'mm'): number {
    return this.UNIT_CONVERSIONS_TO_MM[from] / this.UNIT_CONVERSIONS_TO_MM[to];
  }
}
