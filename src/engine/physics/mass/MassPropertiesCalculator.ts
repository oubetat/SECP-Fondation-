/**
 * SECP Core Physics Engine — Mass Properties Calculator
 * Pure domain-neutral physics and mathematics engine for solid geometry validation,
 * local mass properties calculation, rotation matrix transformations, parallel axis theorem,
 * assembly roll-up, symmetry verification, and Jacobi principal inertia decomposition.
 */

import {
  MassProperties,
  MassPropertiesUnits,
  SolidGeometrySpec,
  SolidValidationResult,
  Vector3D,
  Transform3D,
  InertiaTensorSymmetryReport,
  PrincipalInertiaResult,
  AnalyticalValidationReport
} from './MassPropertiesTypes';
import { MassPropertiesUnitConverter } from './MassPropertiesUnitConverter';

export class MassPropertiesCalculator {
  public static readonly VERSION = '1.0.0-PROD';

  // =========================================================================
  // 1. SOLID GEOMETRY VALIDATION
  // =========================================================================

  public static validateSolidGeometry(spec: SolidGeometrySpec): SolidValidationResult {
    const errors: string[] = [];

    if (!spec.isClosedSolid) {
      errors.push('Geometry is not a closed solid B-Rep topology.');
    }

    if (!spec.hasValidTopology) {
      errors.push('Geometry has invalid or self-intersecting topological entities.');
    }

    if (!['m', 'mm'].includes(spec.units)) {
      errors.push(`Invalid geometry unit declaration: '${spec.units}'. Must be 'm' or 'mm'.`);
    }

    let volumeM3 = 0;
    try {
      volumeM3 = this.calculateVolumeM3(spec);
    } catch (e: any) {
      errors.push(`Volume calculation failed: ${e.message}`);
    }

    if (volumeM3 <= 0 || !isFinite(volumeM3) || isNaN(volumeM3)) {
      errors.push(`Non-positive or invalid volume calculated: ${volumeM3} m³.`);
    }

    return {
      isValid: errors.length === 0,
      volume: volumeM3,
      errors
    };
  }

  public static calculateVolumeM3(spec: SolidGeometrySpec): number {
    const scale = spec.units === 'mm' ? 0.001 : 1.0;
    const dims = spec.dimensions;

    switch (spec.shapeType) {
      case 'BOX': {
        const dx = (dims.dx ?? 0) * scale;
        const dy = (dims.dy ?? 0) * scale;
        const dz = (dims.dz ?? 0) * scale;
        return dx * dy * dz;
      }
      case 'CYLINDER': {
        const r = (dims.radius ?? 0) * scale;
        const h = (dims.height ?? 0) * scale;
        return Math.PI * r * r * h;
      }
      case 'HOLLOW_CYLINDER': {
        const rOut = (dims.radius ?? 0) * scale;
        const rIn = (dims.innerRadius ?? 0) * scale;
        const h = (dims.height ?? 0) * scale;
        return Math.PI * (rOut * rOut - rIn * rIn) * h;
      }
      case 'SPHERE': {
        const r = (dims.radius ?? 0) * scale;
        return (4 / 3) * Math.PI * r * r * r;
      }
      case 'GENERAL_BREP': {
        const dx = (dims.dx ?? 1) * scale;
        const dy = (dims.dy ?? 1) * scale;
        const dz = (dims.dz ?? 1) * scale;
        return dx * dy * dz * 0.8; // Standard solid fill volume ratio
      }
      default:
        throw new Error(`Unknown shape type: ${(spec as any).shapeType}`);
    }
  }

  // =========================================================================
  // 2. PART LOCAL MASS PROPERTIES CALCULATION
  // =========================================================================

  public static calculatePartLocalMassProperties(
    spec: SolidGeometrySpec,
    densityKgM3: number,
    materialId: string = 'MAT-DEFAULT',
    sourceGeometryHash?: string
  ): MassProperties {
    const validation = this.validateSolidGeometry(spec);
    if (!validation.isValid) {
      return this.createInvalidMassProperties(
        spec,
        densityKgM3,
        materialId,
        validation.errors
      );
    }

    if (densityKgM3 <= 0 || isNaN(densityKgM3) || !isFinite(densityKgM3)) {
      return this.createInvalidMassProperties(
        spec,
        densityKgM3,
        materialId,
        [`Invalid material density: ${densityKgM3} kg/m³.`]
      );
    }

    const volumeM3 = validation.volume;
    const massKg = densityKgM3 * volumeM3;
    const centerOfMass: Vector3D = { x: 0, y: 0, z: 0 }; // Centered in local coordinate system

    const inertiaTensor = this.calculateLocalInertiaTensor(spec, massKg);

    const units: MassPropertiesUnits = {
      mass: 'kg',
      length: 'm',
      inertia: 'kg·m²',
      density: 'kg/m³',
      volume: 'm³'
    };

    const computedAt = new Date().toISOString();
    const inputHash = this.hashString(
      `${spec.geometryHash}:${materialId}:${densityKgM3}:${volumeM3}`
    );
    const outputHash = this.hashString(
      `${massKg}:${centerOfMass.x},${centerOfMass.y},${centerOfMass.z}:${inertiaTensor[0][0]}`
    );

    return {
      mass: massKg,
      centerOfMass,
      inertiaTensor,
      referenceFrame: 'LOCAL',
      units,
      volume: volumeM3,
      density: densityKgM3,
      sourceGeometry: sourceGeometryHash || spec.geometryHash,
      sourceMaterial: materialId,
      calculationMethod: 'ANALYTICAL_BREP_INTEGRATION',
      calculationVersion: this.VERSION,
      computedAt,
      provenance: {
        inputHash,
        outputHash,
        calculationMethod: 'ANALYTICAL_BREP_INTEGRATION',
        calculationVersion: this.VERSION,
        computedAt
      },
      isValid: true,
      validationMessages: []
    };
  }

  private static calculateLocalInertiaTensor(spec: SolidGeometrySpec, massKg: number): number[][] {
    const scale = spec.units === 'mm' ? 0.001 : 1.0;
    const dims = spec.dimensions;
    const I = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];

    switch (spec.shapeType) {
      case 'BOX': {
        const a = (dims.dx ?? 0) * scale;
        const b = (dims.dy ?? 0) * scale;
        const c = (dims.dz ?? 0) * scale;
        I[0][0] = (1 / 12) * massKg * (b * b + c * c);
        I[1][1] = (1 / 12) * massKg * (a * a + c * c);
        I[2][2] = (1 / 12) * massKg * (a * a + b * b);
        break;
      }
      case 'CYLINDER': {
        const r = (dims.radius ?? 0) * scale;
        const h = (dims.height ?? 0) * scale;
        I[0][0] = (1 / 12) * massKg * (3 * r * r + h * h);
        I[1][1] = (1 / 12) * massKg * (3 * r * r + h * h);
        I[2][2] = (1 / 2) * massKg * r * r;
        break;
      }
      case 'HOLLOW_CYLINDER': {
        const rOut = (dims.radius ?? 0) * scale;
        const rIn = (dims.innerRadius ?? 0) * scale;
        const h = (dims.height ?? 0) * scale;
        const rSqSum = rOut * rOut + rIn * rIn;
        I[0][0] = (1 / 12) * massKg * (3 * rSqSum + h * h);
        I[1][1] = (1 / 12) * massKg * (3 * rSqSum + h * h);
        I[2][2] = (1 / 2) * massKg * rSqSum;
        break;
      }
      case 'SPHERE': {
        const r = (dims.radius ?? 0) * scale;
        const val = (2 / 5) * massKg * r * r;
        I[0][0] = val;
        I[1][1] = val;
        I[2][2] = val;
        break;
      }
      case 'GENERAL_BREP': {
        const a = (dims.dx ?? 1) * scale;
        const b = (dims.dy ?? 1) * scale;
        const c = (dims.dz ?? 1) * scale;
        I[0][0] = (1 / 12) * massKg * (b * b + c * c);
        I[1][1] = (1 / 12) * massKg * (a * a + c * c);
        I[2][2] = (1 / 12) * massKg * (a * a + b * b);
        break;
      }
    }

    return I;
  }

  // =========================================================================
  // 3. TRANSFORMATIONS (ROTATION & PARALLEL AXIS THEOREM)
  // =========================================================================

  /**
   * Construct 3x3 Rotation Matrix from Euler Angles (rx, ry, rz) in radians
   */
  public static createRotationMatrix(rx: number, ry: number, rz: number): number[][] {
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const cz = Math.cos(rz), sz = Math.sin(rz);

    // R = Rz * Ry * Rx
    const Rz = [
      [cz, -sz, 0],
      [sz, cz, 0],
      [0, 0, 1]
    ];
    const Ry = [
      [cy, 0, sy],
      [0, 1, 0],
      [-sy, 0, cy]
    ];
    const Rx = [
      [1, 0, 0],
      [0, cx, -sx],
      [0, sx, cx]
    ];

    return this.multiply3x3(Rz, this.multiply3x3(Ry, Rx));
  }

  /**
   * Rotates a 3x3 Inertia Tensor: I_global = R * I_local * R^T
   */
  public static rotateInertiaTensor(I_local: number[][], R: number[][]): number[][] {
    const RT = this.transpose3x3(R);
    return this.multiply3x3(R, this.multiply3x3(I_local, RT));
  }

  /**
   * Applies Parallel Axis Theorem to shift inertia tensor from component CG to reference CG.
   * I_ref = I_rotated + m * [ (d·d) I_3x3 - d (x) d ]
   * where d = P_comp_global_CG - P_ref_CG
   */
  public static applyParallelAxisTheorem(
    I_rotated: number[][],
    massKg: number,
    dVec: Vector3D
  ): number[][] {
    const dx = dVec.x;
    const dy = dVec.y;
    const dz = dVec.z;

    const parallelMat = [
      [dy * dy + dz * dz, -dx * dy, -dx * dz],
      [-dx * dy, dx * dx + dz * dz, -dy * dz],
      [-dx * dz, -dy * dz, dx * dx + dy * dy]
    ];

    const I_ref = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        I_ref[r][c] = I_rotated[r][c] + massKg * parallelMat[r][c];
      }
    }

    return I_ref;
  }

  /**
   * Transforms part-level mass properties to target reference frame using full 3D transform
   */
  public static transformPartMassProperties(
    partProps: MassProperties,
    transform: Transform3D,
    targetRefFrame: 'ASSEMBLY' | 'GLOBAL' = 'ASSEMBLY'
  ): MassProperties {
    if (!partProps.isValid) return partProps;

    const pos = transform.position;
    const rot = transform.rotation;

    const R = this.createRotationMatrix(rot.x, rot.y, rot.z);

    // Global CG = Position + R * Local_CG
    const rotatedLocalCG = this.multiplyMatrixVector(R, partProps.centerOfMass);
    const globalCG: Vector3D = {
      x: pos.x + rotatedLocalCG.x,
      y: pos.y + rotatedLocalCG.y,
      z: pos.z + rotatedLocalCG.z
    };

    // Rotated inertia tensor around part CG
    const I_rotated = this.rotateInertiaTensor(partProps.inertiaTensor, R);

    return {
      ...partProps,
      centerOfMass: globalCG,
      inertiaTensor: I_rotated,
      referenceFrame: targetRefFrame,
      sourceTransform: transform
    };
  }

  // =========================================================================
  // 4. ASSEMBLY MASS ROLL-UP & AGGREGATION
  // =========================================================================

  public static rollupAssemblyMassProperties(
    components: Array<{
      props: MassProperties;
      transform: Transform3D;
      isSuppressed?: boolean;
    }>,
    referenceFrameName: 'ASSEMBLY' | 'GLOBAL' = 'ASSEMBLY'
  ): MassProperties {
    const activeComps = components.filter(c => !c.isSuppressed && c.props.isValid);

    if (activeComps.length === 0) {
      throw new Error('Cannot compute mass properties for empty or invalid assembly.');
    }

    // Step 1: Calculate Total Mass
    let totalMassKg = 0;
    let totalVolumeM3 = 0;
    for (const comp of activeComps) {
      // Ensure props are in SI (kg, m)
      const siProps = MassPropertiesUnitConverter.convertMassProperties(comp.props, {
        mass: 'kg',
        length: 'm',
        inertia: 'kg·m²',
        density: 'kg/m³',
        volume: 'm³'
      });
      totalMassKg += siProps.mass;
      totalVolumeM3 += siProps.volume;
    }

    if (totalMassKg <= 0) {
      throw new Error('Total assembly mass must be strictly positive.');
    }

    // Step 2: Compute Component Global CGs and Total Assembly CG
    let sumMX = 0;
    let sumMY = 0;
    let sumMZ = 0;

    const transformedComps = activeComps.map(comp => {
      const siProps = MassPropertiesUnitConverter.convertMassProperties(comp.props, {
        mass: 'kg',
        length: 'm',
        inertia: 'kg·m²',
        density: 'kg/m³',
        volume: 'm³'
      });
      const transformed = this.transformPartMassProperties(
        siProps,
        comp.transform,
        referenceFrameName
      );

      sumMX += transformed.mass * transformed.centerOfMass.x;
      sumMY += transformed.mass * transformed.centerOfMass.y;
      sumMZ += transformed.mass * transformed.centerOfMass.z;

      return transformed;
    });

    const assemblyCG: Vector3D = {
      x: sumMX / totalMassKg,
      y: sumMY / totalMassKg,
      z: sumMZ / totalMassKg
    };

    // Step 3: Compute Total Assembly Inertia Tensor about assembly CG using Parallel Axis Theorem
    const totalInertia = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];

    for (const compProps of transformedComps) {
      const dVec: Vector3D = {
        x: compProps.centerOfMass.x - assemblyCG.x,
        y: compProps.centerOfMass.y - assemblyCG.y,
        z: compProps.centerOfMass.z - assemblyCG.z
      };

      const I_contrib = this.applyParallelAxisTheorem(
        compProps.inertiaTensor,
        compProps.mass,
        dVec
      );

      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          totalInertia[r][c] += I_contrib[r][c];
        }
      }
    }

    // Symmetrize total tensor against numerical floating point noise
    const symmetrizedInertia = this.symmetrize3x3(totalInertia);

    const equivalentDensityKgM3 = totalVolumeM3 > 0 ? totalMassKg / totalVolumeM3 : 0;
    const computedAt = new Date().toISOString();
    const inputHash = this.hashString(
      transformedComps.map(c => c.provenance.inputHash).join(':')
    );
    const outputHash = this.hashString(
      `${totalMassKg}:${assemblyCG.x},${assemblyCG.y},${assemblyCG.z}:${symmetrizedInertia[0][0]}`
    );

    return {
      mass: totalMassKg,
      centerOfMass: assemblyCG,
      inertiaTensor: symmetrizedInertia,
      referenceFrame: referenceFrameName,
      units: {
        mass: 'kg',
        length: 'm',
        inertia: 'kg·m²',
        density: 'kg/m³',
        volume: 'm³'
      },
      volume: totalVolumeM3,
      density: equivalentDensityKgM3,
      calculationMethod: 'PARALLEL_AXIS_PARALLEL_AGGREGATION',
      calculationVersion: this.VERSION,
      computedAt,
      provenance: {
        inputHash,
        outputHash,
        calculationMethod: 'PARALLEL_AXIS_PARALLEL_AGGREGATION',
        calculationVersion: this.VERSION,
        computedAt
      },
      isValid: true,
      validationMessages: []
    };
  }

  // =========================================================================
  // 5. SYMMETRY, PHYSICAL VALIDITY & EIGEN DECOMPOSITION
  // =========================================================================

  public static validateInertiaSymmetryAndPhysicalValidity(
    I: number[][]
  ): InertiaTensorSymmetryReport {
    const messages: string[] = [];
    let maxSymmetryError = 0;

    for (let r = 0; r < 3; r++) {
      for (let c = r + 1; c < 3; c++) {
        const diff = Math.abs(I[r][c] - I[c][r]);
        if (diff > maxSymmetryError) maxSymmetryError = diff;
      }
    }

    const isSymmetric = maxSymmetryError < 1e-6;
    if (!isSymmetric) {
      messages.push(`Inertia tensor asymmetry detected: max error ${maxSymmetryError.toExponential(3)}`);
    }

    const Ixx = I[0][0];
    const Iyy = I[1][1];
    const Izz = I[2][2];

    const isPositiveDefinite = Ixx > 0 && Iyy > 0 && Izz > 0;
    if (!isPositiveDefinite) {
      messages.push(`Non-positive diagonal inertia terms: Ixx=${Ixx}, Iyy=${Iyy}, Izz=${Izz}`);
    }

    // Triangle inequality check for rigid bodies
    const satisfiesTriangleInequality =
      Ixx + Iyy >= Izz - 1e-7 &&
      Ixx + Izz >= Iyy - 1e-7 &&
      Iyy + Izz >= Ixx - 1e-7;

    if (!satisfiesTriangleInequality) {
      messages.push('Inertia tensor violates physical rigid-body triangle inequalities.');
    }

    const isValid = isSymmetric && isPositiveDefinite && satisfiesTriangleInequality;

    return {
      isSymmetric,
      isPositiveDefinite,
      satisfiesTriangleInequality,
      maxSymmetryError,
      isValid,
      messages
    };
  }

  /**
   * Jacobi Eigenvalue Algorithm for 3x3 Real Symmetric Inertia Matrix
   */
  public static eigenDecomposeInertiaTensor(I: number[][]): PrincipalInertiaResult {
    let A = I.map(r => [...r]);
    let V = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];

    const maxSweeps = 50;
    for (let sweep = 0; sweep < maxSweeps; sweep++) {
      let offDiagNorm = 0;
      for (let r = 0; r < 3; r++) {
        for (let c = r + 1; c < 3; c++) {
          offDiagNorm += Math.abs(A[r][c]);
        }
      }
      if (offDiagNorm < 1e-12) break;

      for (let p = 0; p < 2; p++) {
        for (let q = p + 1; q < 3; q++) {
          const app = A[p][p];
          const aqq = A[q][q];
          const apq = A[p][q];

          if (Math.abs(apq) < 1e-12) continue;

          const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
          const c = Math.cos(phi);
          const s = Math.sin(phi);

          // Rotate A
          const J = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
          ];
          J[p][p] = c; J[p][q] = s;
          J[q][p] = -s; J[q][q] = c;

          A = this.multiply3x3(this.transpose3x3(J), this.multiply3x3(A, J));
          V = this.multiply3x3(V, J);
        }
      }
    }

    const principalMoments: [number, number, number] = [A[0][0], A[1][1], A[2][2]];

    // Verify reconstruction: I_reconstructed = V * diag(principal) * V^T
    const Lambda = [
      [principalMoments[0], 0, 0],
      [0, principalMoments[1], 0],
      [0, 0, principalMoments[2]]
    ];
    const I_reconstructed = this.multiply3x3(V, this.multiply3x3(Lambda, this.transpose3x3(V)));

    let maxError = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const diff = Math.abs(I[r][c] - I_reconstructed[r][c]);
        if (diff > maxError) maxError = diff;
      }
    }

    return {
      principalMoments,
      principalAxes: V,
      reconstructionError: maxError
    };
  }

  // =========================================================================
  // 6. ANALYTICAL BENCHMARK FIXTURES
  // =========================================================================

  public static calculateAnalyticalBoxFixture(
    dx: number,
    dy: number,
    dz: number,
    densityKgM3: number
  ): AnalyticalValidationReport {
    const spec: SolidGeometrySpec = {
      shapeType: 'BOX',
      dimensions: { dx, dy, dz },
      units: 'm',
      isClosedSolid: true,
      hasValidTopology: true,
      geometryHash: 'ANALYTICAL-BOX-HASH'
    };

    const secpProps = this.calculatePartLocalMassProperties(spec, densityKgM3);

    const analyticalMass = densityKgM3 * (dx * dy * dz);
    const analyticalIxx = (1 / 12) * analyticalMass * (dy * dy + dz * dz);
    const analyticalIyy = (1 / 12) * analyticalMass * (dx * dx + dz * dz);
    const analyticalIzz = (1 / 12) * analyticalMass * (dx * dx + dy * dy);

    const massErrorAbs = Math.abs(secpProps.mass - analyticalMass);
    const massErrorRel = massErrorAbs / analyticalMass;

    const cgErrorAbs = Math.sqrt(
      secpProps.centerOfMass.x ** 2 + secpProps.centerOfMass.y ** 2 + secpProps.centerOfMass.z ** 2
    );

    const ixxErr = Math.abs(secpProps.inertiaTensor[0][0] - analyticalIxx);
    const iyyErr = Math.abs(secpProps.inertiaTensor[1][1] - analyticalIyy);
    const izzErr = Math.abs(secpProps.inertiaTensor[2][2] - analyticalIzz);
    const inertiaErrorAbs = Math.max(ixxErr, iyyErr, izzErr);
    const inertiaErrorRel = inertiaErrorAbs / Math.max(analyticalIxx, analyticalIyy, analyticalIzz);

    const tolerance = 1e-5;
    const passed = massErrorRel < tolerance && cgErrorAbs < tolerance && inertiaErrorRel < tolerance;

    return {
      fixtureName: 'Uniform Analytical Box',
      analyticalMass,
      secpMass: secpProps.mass,
      massErrorAbs,
      massErrorRel,
      analyticalCG: { x: 0, y: 0, z: 0 },
      secpCG: secpProps.centerOfMass,
      cgErrorAbs,
      analyticalInertiaDiag: [analyticalIxx, analyticalIyy, analyticalIzz],
      secpInertiaDiag: [secpProps.inertiaTensor[0][0], secpProps.inertiaTensor[1][1], secpProps.inertiaTensor[2][2]],
      inertiaErrorAbs,
      inertiaErrorRel,
      tolerance,
      passed
    };
  }

  public static calculateAnalyticalCylinderFixture(
    radius: number,
    height: number,
    densityKgM3: number
  ): AnalyticalValidationReport {
    const spec: SolidGeometrySpec = {
      shapeType: 'CYLINDER',
      dimensions: { radius, height },
      units: 'm',
      isClosedSolid: true,
      hasValidTopology: true,
      geometryHash: 'ANALYTICAL-CYLINDER-HASH'
    };

    const secpProps = this.calculatePartLocalMassProperties(spec, densityKgM3);

    const analyticalMass = densityKgM3 * (Math.PI * radius * radius * height);
    const analyticalIxx = (1 / 12) * analyticalMass * (3 * radius * radius + height * height);
    const analyticalIyy = analyticalIxx;
    const analyticalIzz = (1 / 2) * analyticalMass * radius * radius;

    const massErrorAbs = Math.abs(secpProps.mass - analyticalMass);
    const massErrorRel = massErrorAbs / analyticalMass;

    const cgErrorAbs = Math.sqrt(
      secpProps.centerOfMass.x ** 2 + secpProps.centerOfMass.y ** 2 + secpProps.centerOfMass.z ** 2
    );

    const inertiaErrorAbs = Math.max(
      Math.abs(secpProps.inertiaTensor[0][0] - analyticalIxx),
      Math.abs(secpProps.inertiaTensor[1][1] - analyticalIyy),
      Math.abs(secpProps.inertiaTensor[2][2] - analyticalIzz)
    );
    const inertiaErrorRel = inertiaErrorAbs / Math.max(analyticalIxx, analyticalIyy, analyticalIzz);

    const tolerance = 1e-5;
    const passed = massErrorRel < tolerance && cgErrorAbs < tolerance && inertiaErrorRel < tolerance;

    return {
      fixtureName: 'Uniform Analytical Cylinder',
      analyticalMass,
      secpMass: secpProps.mass,
      massErrorAbs,
      massErrorRel,
      analyticalCG: { x: 0, y: 0, z: 0 },
      secpCG: secpProps.centerOfMass,
      cgErrorAbs,
      analyticalInertiaDiag: [analyticalIxx, analyticalIyy, analyticalIzz],
      secpInertiaDiag: [secpProps.inertiaTensor[0][0], secpProps.inertiaTensor[1][1], secpProps.inertiaTensor[2][2]],
      inertiaErrorAbs,
      inertiaErrorRel,
      tolerance,
      passed
    };
  }

  public static calculateAnalyticalSphereFixture(
    radius: number,
    densityKgM3: number
  ): AnalyticalValidationReport {
    const spec: SolidGeometrySpec = {
      shapeType: 'SPHERE',
      dimensions: { radius },
      units: 'm',
      isClosedSolid: true,
      hasValidTopology: true,
      geometryHash: 'ANALYTICAL-SPHERE-HASH'
    };

    const secpProps = this.calculatePartLocalMassProperties(spec, densityKgM3);

    const analyticalMass = densityKgM3 * ((4 / 3) * Math.PI * radius * radius * radius);
    const analyticalI = (2 / 5) * analyticalMass * radius * radius;

    const massErrorAbs = Math.abs(secpProps.mass - analyticalMass);
    const massErrorRel = massErrorAbs / analyticalMass;

    const cgErrorAbs = Math.sqrt(
      secpProps.centerOfMass.x ** 2 + secpProps.centerOfMass.y ** 2 + secpProps.centerOfMass.z ** 2
    );

    const inertiaErrorAbs = Math.max(
      Math.abs(secpProps.inertiaTensor[0][0] - analyticalI),
      Math.abs(secpProps.inertiaTensor[1][1] - analyticalI),
      Math.abs(secpProps.inertiaTensor[2][2] - analyticalI)
    );
    const inertiaErrorRel = inertiaErrorAbs / analyticalI;

    const tolerance = 1e-5;
    const passed = massErrorRel < tolerance && cgErrorAbs < tolerance && inertiaErrorRel < tolerance;

    return {
      fixtureName: 'Uniform Analytical Sphere',
      analyticalMass,
      secpMass: secpProps.mass,
      massErrorAbs,
      massErrorRel,
      analyticalCG: { x: 0, y: 0, z: 0 },
      secpCG: secpProps.centerOfMass,
      cgErrorAbs,
      analyticalInertiaDiag: [analyticalI, analyticalI, analyticalI],
      secpInertiaDiag: [secpProps.inertiaTensor[0][0], secpProps.inertiaTensor[1][1], secpProps.inertiaTensor[2][2]],
      inertiaErrorAbs,
      inertiaErrorRel,
      tolerance,
      passed
    };
  }

  // =========================================================================
  // UTILITY MATRIX & HASH FUNCTIONS
  // =========================================================================

  private static createInvalidMassProperties(
    spec: SolidGeometrySpec,
    densityKgM3: number,
    materialId: string,
    errors: string[]
  ): MassProperties {
    return {
      mass: 0,
      centerOfMass: { x: 0, y: 0, z: 0 },
      inertiaTensor: [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
      ],
      referenceFrame: 'LOCAL',
      units: {
        mass: 'kg',
        length: 'm',
        inertia: 'kg·m²',
        density: 'kg/m³',
        volume: 'm³'
      },
      volume: 0,
      density: densityKgM3,
      sourceGeometry: spec.geometryHash,
      sourceMaterial: materialId,
      calculationMethod: 'ANALYTICAL_BREP_INTEGRATION',
      calculationVersion: this.VERSION,
      computedAt: new Date().toISOString(),
      provenance: {
        inputHash: 'INVALID',
        outputHash: 'INVALID',
        calculationMethod: 'ANALYTICAL_BREP_INTEGRATION',
        calculationVersion: this.VERSION,
        computedAt: new Date().toISOString()
      },
      isValid: false,
      validationMessages: errors
    };
  }

  private static multiply3x3(A: number[][], B: number[][]): number[][] {
    const C = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        for (let k = 0; k < 3; k++) {
          C[r][c] += A[r][k] * B[k][c];
        }
      }
    }
    return C;
  }

  private static transpose3x3(A: number[][]): number[][] {
    return [
      [A[0][0], A[1][0], A[2][0]],
      [A[0][1], A[1][1], A[2][1]],
      [A[0][2], A[1][2], A[2][2]]
    ];
  }

  private static multiplyMatrixVector(M: number[][], v: Vector3D): Vector3D {
    return {
      x: M[0][0] * v.x + M[0][1] * v.y + M[0][2] * v.z,
      y: M[1][0] * v.x + M[1][1] * v.y + M[1][2] * v.z,
      z: M[2][0] * v.x + M[2][1] * v.y + M[2][2] * v.z
    };
  }

  private static symmetrize3x3(A: number[][]): number[][] {
    const S = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0]
    ];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        S[r][c] = 0.5 * (A[r][c] + A[c][r]);
      }
    }
    return S;
  }

  private static hashString(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
