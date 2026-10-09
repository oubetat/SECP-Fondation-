/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Physical Wall Boundary Object
 */

import {
  WallMotionType,
  VelocityBehaviorType,
  ThermalBehaviorType,
  Vector3D,
  BoundaryDiagnosticCode
} from './BoundaryConditionTypes';

export interface WallBCValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly string[];
  readonly code?: BoundaryDiagnosticCode;
}

export class WallBoundaryCondition {
  public readonly wallId: string;
  public readonly patchId: string;
  public readonly motionType: WallMotionType;
  public readonly velocityBehavior: VelocityBehaviorType;
  public readonly thermalBehavior: ThermalBehaviorType;
  public readonly translationalVelocity: Vector3D;
  public readonly rotationalVelocity: Vector3D;
  public readonly centerOfRotation: Vector3D;
  public readonly temperature?: number;
  public readonly heatFlux?: number;
  public readonly roughnessHeight: number;

  constructor(
    wallId: string,
    patchId: string,
    motionType: WallMotionType = WallMotionType.STATIC,
    velocityBehavior: VelocityBehaviorType = VelocityBehaviorType.NO_SLIP,
    thermalBehavior: ThermalBehaviorType = ThermalBehaviorType.ADIABATIC,
    options: {
      translationalVelocity?: Vector3D;
      rotationalVelocity?: Vector3D;
      centerOfRotation?: Vector3D;
      temperature?: number;
      heatFlux?: number;
      roughnessHeight?: number;
    } = {}
  ) {
    this.wallId = wallId;
    this.patchId = patchId;
    this.motionType = motionType;
    this.velocityBehavior = velocityBehavior;
    this.thermalBehavior = thermalBehavior;
    this.translationalVelocity = Object.freeze([...(options.translationalVelocity || [0, 0, 0])]) as Vector3D;
    this.rotationalVelocity = Object.freeze([...(options.rotationalVelocity || [0, 0, 0])]) as Vector3D;
    this.centerOfRotation = Object.freeze([...(options.centerOfRotation || [0, 0, 0])]) as Vector3D;
    this.temperature = options.temperature;
    this.heatFlux = options.heatFlux;
    this.roughnessHeight = options.roughnessHeight ?? 0;
  }

  public validate(): WallBCValidationResult {
    const diagnostics: string[] = [];

    if (this.motionType === WallMotionType.MOVING_TRANSLATIONAL) {
      const [u, v, w] = this.translationalVelocity;
      if (!Number.isFinite(u) || !Number.isFinite(v) || !Number.isFinite(w)) {
        diagnostics.push(`Moving wall translational velocity contains non-finite values.`);
        return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_CONDITION };
      }
    }

    if (this.thermalBehavior === ThermalBehaviorType.FIXED_TEMPERATURE) {
      if (this.temperature === undefined || this.temperature <= 0 || !Number.isFinite(this.temperature)) {
        diagnostics.push(`Fixed temperature wall requires positive temperature in Kelvin.`);
        return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_PHYSICAL_DIMENSIONS };
      }
    }

    if (this.roughnessHeight < 0 || !Number.isFinite(this.roughnessHeight)) {
      diagnostics.push(`Wall roughness height must be non-negative.`);
      return { valid: false, diagnostics, code: BoundaryDiagnosticCode.INVALID_BOUNDARY_CONDITION };
    }

    return { valid: true, diagnostics: Object.freeze(diagnostics) };
  }

  public getWallVelocityAtPoint(point: Vector3D): Vector3D {
    if (this.motionType === WallMotionType.STATIC) {
      return [0, 0, 0];
    }
    if (this.motionType === WallMotionType.MOVING_TRANSLATIONAL) {
      return [...this.translationalVelocity];
    }
    // Rotational: v = v_trans + omega x (r - r_center)
    const rx = point[0] - this.centerOfRotation[0];
    const ry = point[1] - this.centerOfRotation[1];
    const rz = point[2] - this.centerOfRotation[2];

    const [wx, wy, wz] = this.rotationalVelocity;
    const vx = wy * rz - wz * ry + this.translationalVelocity[0];
    const vy = wz * rx - wx * rz + this.translationalVelocity[1];
    const vz = wx * ry - wy * rx + this.translationalVelocity[2];

    return [vx, vy, vz];
  }
}
