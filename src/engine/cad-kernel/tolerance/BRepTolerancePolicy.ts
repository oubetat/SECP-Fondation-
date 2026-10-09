/**
 * SECP CAD Kernel — Centralized Tolerance Management
 */

export enum ToleranceLevel {
  MICRON = 1e-6,
  SUB_MICRON = 1e-7,
  NANO = 1e-9,
  LOOSE = 1e-3,
  STANDARD = 1e-5
}

export interface TolerancePolicy {
  vertex: number;
  edge: number;
  face: number;
  intersection: number;
  healing: number;
  coincidence: number;
}

export class BRepTolerancePolicy {
  public static readonly DEFAULT: TolerancePolicy = {
    vertex: ToleranceLevel.SUB_MICRON,
    edge: ToleranceLevel.SUB_MICRON,
    face: ToleranceLevel.SUB_MICRON,
    intersection: ToleranceLevel.STANDARD,
    healing: ToleranceLevel.LOOSE,
    coincidence: ToleranceLevel.STANDARD
  };

  public static readonly HIGH_PRECISION: TolerancePolicy = {
    vertex: ToleranceLevel.NANO,
    edge: ToleranceLevel.NANO,
    face: ToleranceLevel.NANO,
    intersection: ToleranceLevel.SUB_MICRON,
    healing: ToleranceLevel.STANDARD,
    coincidence: ToleranceLevel.SUB_MICRON
  };
}
