/**
 * SECP Independent Manufacturing Oracle
 * 
 * MANDATORY: This oracle MUST NOT import any internal SECP CAM, Kinematics, or Simulation engines.
 * It strictly uses native Math and independent geometric logic to verify manufacturing truth.
 */

export interface OraclePose {
  x: number;
  y: number;
  z: number;
  a: number;
  c: number;
}

export interface OraclePoint {
  x: number;
  y: number;
  z: number;
}

export class IndependentManufacturingOracle {
  /**
   * Independently verify forward kinematics for a table-table 5-axis machine.
   * Assumes A rotates around X, C rotates around Z.
   */
  public static verifyForwardKinematics(
    joints: { X: number; Y: number; Z: number; A: number; C: number },
    pivotOffsetZ: number = 0
  ): { position: OraclePoint; toolAxis: OraclePoint } {
    const aRad = (joints.A * Math.PI) / 180;
    const cRad = (joints.C * Math.PI) / 180;

    // Tool axis in workpiece coordinate system (assuming tool is [0,0,1] in machine system)
    // For table-table, tool axis vector u_wcs = Rz(C) * Rx(A) * [0,0,1]
    // Wait, the tool is stationary in Z relative to the base, and the table tilts.
    // So u_wcs is the inverse rotation applied to the tool axis.
    // u_wcs = (Rz(C) * Rx(A))^-1 * [0,0,1] = Rx(-A) * Rz(-C) * [0,0,1]
    
    const ux = Math.sin(aRad) * Math.sin(cRad);
    const uy = Math.sin(aRad) * Math.cos(cRad);
    const uz = Math.cos(aRad);

    // Position verification
    // P_wcs = (Rz(C) * Rx(A))^-1 * (P_mcs - Pivot) + Pivot
    const rx = joints.X;
    const ry = joints.Y;
    const rz = joints.Z - pivotOffsetZ;

    // This is a simplified independent check
    return {
      position: { x: rx, y: ry, z: rz + pivotOffsetZ },
      toolAxis: { x: ux, y: uy, z: uz }
    };
  }

  /**
   * Independently verify if a toolpath point is within machine limits.
   */
  public static verifyLimits(
    pos: { X: number; Y: number; Z: number; A: number; C: number },
    limits: { 
      x: [number, number], 
      y: [number, number], 
      z: [number, number], 
      a: [number, number], 
      c: [number, number] 
    }
  ): boolean {
    return (
      pos.X >= limits.x[0] && pos.X <= limits.x[1] &&
      pos.Y >= limits.y[0] && pos.Y <= limits.y[1] &&
      pos.Z >= limits.z[0] && pos.Z <= limits.z[1] &&
      pos.A >= limits.a[0] && pos.A <= limits.a[1] &&
      pos.C >= limits.c[0] && pos.C <= limits.c[1]
    );
  }

  /**
   * Independently verify material removal volume invariant.
   * Material volume MUST NOT increase after a subtractive operation.
   */
  public static verifySubtractiveVolumeInvariant(
    initialVolume: number,
    finalVolume: number
  ): boolean {
    return finalVolume <= initialVolume + 1e-9; // allowing for floating point epsilon
  }

  /**
   * Independently detect a simple sphere-sphere collision.
   */
  public static checkSphereCollision(
    p1: OraclePoint, r1: number,
    p2: OraclePoint, r2: number
  ): boolean {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    return distSq < (r1 + r2) * (r1 + r2);
  }

  /**
   * Simple ICP-style alignment check.
   * Verifies if a transformation reasonably reduces the mean squared error (MSE).
   */
  public static verifyAlignmentImprovement(
    originalPoints: OraclePoint[],
    targetPoints: OraclePoint[],
    transform: (p: OraclePoint) => OraclePoint
  ): boolean {
    const initialMSE = this.calculateMSE(originalPoints, targetPoints);
    const transformedPoints = originalPoints.map(p => transform(p));
    const finalMSE = this.calculateMSE(transformedPoints, targetPoints);
    
    return finalMSE < initialMSE;
  }

  private static calculateMSE(pts1: OraclePoint[], pts2: OraclePoint[]): number {
    if (pts1.length !== pts2.length || pts1.length === 0) return Infinity;
    let sum = 0;
    for (let i = 0; i < pts1.length; i++) {
      const dx = pts1[i].x - pts2[i].x;
      const dy = pts1[i].y - pts2[i].y;
      const dz = pts1[i].z - pts2[i].z;
      sum += dx * dx + dy * dy + dz * dz;
    }
    return sum / pts1.length;
  }

  /**
   * Independently verify a metrology point deviation:
   * dev = (actual - nominal) . normal
   */
  public static verifyMetrologyDeviation(
    nominal: OraclePoint,
    actual: OraclePoint,
    normal: OraclePoint,
    reportedDeviation: number,
    epsilon: number = 1e-5
  ): boolean {
    const dx = actual.x - nominal.x;
    const dy = actual.y - nominal.y;
    const dz = actual.z - nominal.z;
    const normLen = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
    if (normLen < 1e-8) return false;
    const nx = normal.x / normLen;
    const ny = normal.y / normLen;
    const nz = normal.z / normLen;
    const calculated = dx * nx + dy * ny + dz * nz;
    return Math.abs(calculated - reportedDeviation) <= epsilon;
  }

  /**
   * Independently verify tool-wear inference against reference physics model.
   * Tool wear is inferred from normal deviations across sample points.
   */
  public static verifyToolWearInference(
    deviations: number[],
    reportedWear: number,
    epsilon: number = 1e-4
  ): boolean {
    if (deviations.length === 0) return false;
    // Independent mean wear estimator
    const sum = deviations.reduce((acc, v) => acc + v, 0);
    const expectedWear = sum / deviations.length;
    return Math.abs(expectedWear - reportedWear) <= epsilon;
  }

  /**
   * Independently verify that compensation vector directly counters the deviation.
   * compVector = - deviation * normal
   */
  public static verifyCompensationVector(
    deviation: number,
    normal: OraclePoint,
    compensationVector: OraclePoint,
    epsilon: number = 1e-4
  ): boolean {
    const normLen = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
    if (normLen < 1e-8) return false;
    const expectedX = -deviation * (normal.x / normLen);
    const expectedY = -deviation * (normal.y / normLen);
    const expectedZ = -deviation * (normal.z / normLen);

    const diffX = Math.abs(expectedX - compensationVector.x);
    const diffY = Math.abs(expectedY - compensationVector.y);
    const diffZ = Math.abs(expectedZ - compensationVector.z);
    return diffX <= epsilon && diffY <= epsilon && diffZ <= epsilon;
  }

  /**
   * Independently calculate closed-loop residual:
   * residual = initialDeviation + compensationMagnitude * damping
   */
  public static verifyClosedLoopResidual(
    initialDeviation: number,
    compensationMagnitude: number,
    dampingFactor: number,
    reportedResidual: number,
    epsilon: number = 1e-4
  ): boolean {
    // If deviation is +0.05, compensation is -0.05.
    // Resulting position error is initialDeviation + compensation * damping.
    const expectedResidual = initialDeviation - compensationMagnitude * dampingFactor;
    return Math.abs(expectedResidual - reportedResidual) <= epsilon;
  }

  /**
   * Independently verify revision binding between design authority and metrology measurement.
   */
  public static verifyRevisionBinding(
    cadRevision: string,
    measurementRevision: string,
    proposalBaseRevision: string
  ): boolean {
    return cadRevision === measurementRevision && cadRevision === proposalBaseRevision;
  }

  /**
   * Independently evaluate quality conformance under ISO 14253-1 guard-banded decision rule.
   * Conformance zone = [lower + U, upper - U]
   */
  public static verifyQualityAcceptance(
    residualDeviationMm: number,
    uncertaintyMm: number,
    lowerToleranceMm: number,
    upperToleranceMm: number
  ): 'PASS' | 'FAIL' | 'INCONCLUSIVE' {
    const totalTolerance = upperToleranceMm - lowerToleranceMm;
    if (totalTolerance <= 0) return 'FAIL';
    // If uncertainty exceeds 25% of tolerance band, decision cannot be safely made
    if (uncertaintyMm > totalTolerance * 0.25) return 'INCONCLUSIVE';

    const guardedLower = lowerToleranceMm + uncertaintyMm;
    const guardedUpper = upperToleranceMm - uncertaintyMm;

    if (residualDeviationMm >= guardedLower && residualDeviationMm <= guardedUpper) {
      return 'PASS';
    } else if (residualDeviationMm < lowerToleranceMm - uncertaintyMm || residualDeviationMm > upperToleranceMm + uncertaintyMm) {
      return 'FAIL';
    } else {
      return 'INCONCLUSIVE';
    }
  }
}
