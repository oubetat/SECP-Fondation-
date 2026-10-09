import { JacobianEngine } from "./JacobianEngine";
import { ShapeFunctions } from "./ShapeFunctions";
import { ElementQualityMetrics } from "./types";

export class ElementQualityEvaluator {
  static evaluate(elementTypeId: string, nodeCoords: number[][]): ElementQualityMetrics {
    const failureReasons: string[] = [];

    // 1. Basic coordinate validation (NaN / Inf)
    for (let i = 0; i < nodeCoords.length; i++) {
      for (let j = 0; j < nodeCoords[i].length; j++) {
        const val = nodeCoords[i][j];
        if (Number.isNaN(val) || !Number.isFinite(val)) {
          return {
            isValid: false,
            isDegenerate: true,
            minJacobian: 0,
            maxJacobian: 0,
            jacobianRatio: 0,
            aspectRatio: Infinity,
            skewness: 1,
            volumeOrArea: 0,
            qualityRating: 'INVALID',
            failureReasons: [`Node ${i} has non-finite coordinate component: ${val}`]
          };
        }
      }
    }

    // 2. Family-specific evaluation
    switch (elementTypeId) {
      case 'BAR2':
      case 'BEAM':
        return this.evaluateBAR2(nodeCoords);
      case 'TRI3':
        return this.evaluateTRI3(nodeCoords);
      case 'QUAD4':
      case 'SHELL':
        return this.evaluateQUAD4(nodeCoords);
      case 'TET4':
        return this.evaluateTET4(nodeCoords);
      case 'HEX8':
      case 'SOLID':
        if (nodeCoords.length === 4) {
          return this.evaluateTET4(nodeCoords);
        }
        return this.evaluateHEX8(nodeCoords);
      default:
        throw new Error(`Unsupported element type for quality evaluation: ${elementTypeId}`);
    }
  }

  private static evaluateBAR2(coords: number[][]): ElementQualityMetrics {
    if (coords.length !== 2) {
      return this.createInvalid(0, 0, ['BAR2 requires exactly 2 nodes']);
    }
    const p1 = coords[0], p2 = coords[1];
    const dx = p2[0] - p1[0];
    const dy = (p2[1] ?? 0) - (p1[1] ?? 0);
    const dz = (p2[2] ?? 0) - (p1[2] ?? 0);
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (L < 1e-12) {
      return this.createInvalid(0, 0, [`Zero length bar L=${L}`]);
    }

    return {
      isValid: true,
      isDegenerate: false,
      minJacobian: L / 2,
      maxJacobian: L / 2,
      jacobianRatio: 1.0,
      aspectRatio: 1.0,
      skewness: 0.0,
      volumeOrArea: L,
      qualityRating: 'EXCELLENT',
      failureReasons: []
    };
  }

  private static evaluateTRI3(coords: number[][]): ElementQualityMetrics {
    if (coords.length !== 3) {
      return this.createInvalid(0, 0, ['TRI3 requires exactly 3 nodes']);
    }
    const sf = ShapeFunctions.tri3(1 / 3, 1 / 3);
    const jac = JacobianEngine.compute2D(sf.dN_dxi, sf.dN_deta!, coords);

    if (!jac.isValid || jac.det <= 1e-14) {
      return this.createInvalid(jac.det, 0, [`Non-positive area/Jacobian: det(J)=${jac.det}`]);
    }

    const area = 0.5 * jac.det;

    // Edge lengths
    const d12 = Math.hypot(coords[1][0] - coords[0][0], coords[1][1] - coords[0][1]);
    const d23 = Math.hypot(coords[2][0] - coords[1][0], coords[2][1] - coords[1][1]);
    const d31 = Math.hypot(coords[0][0] - coords[2][0], coords[0][1] - coords[2][1]);

    const maxEdge = Math.max(d12, d23, d31);
    const minEdge = Math.min(d12, d23, d31);
    const aspectRatio = minEdge > 1e-12 ? maxEdge / minEdge : Infinity;

    const qualityRating = aspectRatio < 2.0 ? 'EXCELLENT' : (aspectRatio < 5.0 ? 'GOOD' : 'POOR');

    return {
      isValid: true,
      isDegenerate: false,
      minJacobian: jac.det,
      maxJacobian: jac.det,
      jacobianRatio: 1.0,
      aspectRatio,
      skewness: 1.0 - 1.0 / aspectRatio,
      volumeOrArea: area,
      qualityRating,
      failureReasons: []
    };
  }

  private static evaluateQUAD4(coords: number[][]): ElementQualityMetrics {
    if (coords.length !== 4) {
      return this.createInvalid(0, 0, ['QUAD4 requires exactly 4 nodes']);
    }

    const checkPoints = [
      [-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]
    ];

    let minJ = Infinity;
    let maxJ = -Infinity;
    let hasNegative = false;

    for (const [xi, eta] of checkPoints) {
      const sf = ShapeFunctions.quad4(xi, eta);
      const jac = JacobianEngine.compute2D(sf.dN_dxi, sf.dN_deta!, coords);
      if (jac.det < minJ) minJ = jac.det;
      if (jac.det > maxJ) maxJ = jac.det;
      if (jac.det <= 1e-14) {
        hasNegative = true;
      }
    }

    if (hasNegative || minJ <= 1e-14) {
      return this.createInvalid(minJ, maxJ, [`Negative or zero Jacobian in QUAD4: minDet(J)=${minJ}`]);
    }

    const jacobianRatio = maxJ > 0 ? minJ / maxJ : 0;
    const qualityRating = jacobianRatio > 0.6 ? 'EXCELLENT' : (jacobianRatio > 0.2 ? 'GOOD' : 'POOR');

    return {
      isValid: true,
      isDegenerate: false,
      minJacobian: minJ,
      maxJacobian: maxJ,
      jacobianRatio,
      aspectRatio: 1.0 / (jacobianRatio || 0.001),
      skewness: 1.0 - jacobianRatio,
      volumeOrArea: ShapeFunctions.quad4(0, 0).N.reduce((sum, _, i) => sum + 1, 0) * minJ,
      qualityRating,
      failureReasons: []
    };
  }

  private static evaluateTET4(coords: number[][]): ElementQualityMetrics {
    if (coords.length !== 4) {
      return this.createInvalid(0, 0, ['TET4 requires exactly 4 nodes']);
    }

    const sf = ShapeFunctions.tet4(0.25, 0.25, 0.25);
    const jac = JacobianEngine.compute3D(sf.dN_dxi, sf.dN_deta!, sf.dN_dzeta!, coords);

    if (!jac.isValid || jac.det <= 1e-14) {
      return this.createInvalid(jac.det, 0, [`Non-positive volume/Jacobian in TET4: det(J)=${jac.det}`]);
    }

    const volume = jac.det / 6.0;

    return {
      isValid: true,
      isDegenerate: false,
      minJacobian: jac.det,
      maxJacobian: jac.det,
      jacobianRatio: 1.0,
      aspectRatio: 1.0,
      skewness: 0.0,
      volumeOrArea: volume,
      qualityRating: 'EXCELLENT',
      failureReasons: []
    };
  }

  private static evaluateHEX8(coords: number[][]): ElementQualityMetrics {
    if (coords.length !== 8) {
      return this.createInvalid(0, 0, ['HEX8 requires exactly 8 nodes']);
    }

    const checkPoints = [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1,  1], [1, -1,  1], [1, 1,  1], [-1, 1,  1],
      [0, 0, 0]
    ];

    let minJ = Infinity;
    let maxJ = -Infinity;
    let hasNegative = false;

    for (const [xi, eta, zeta] of checkPoints) {
      const sf = ShapeFunctions.hex8(xi, eta, zeta);
      const jac = JacobianEngine.compute3D(sf.dN_dxi, sf.dN_deta!, sf.dN_dzeta!, coords);
      if (jac.det < minJ) minJ = jac.det;
      if (jac.det > maxJ) maxJ = jac.det;
      if (jac.det <= 1e-14) hasNegative = true;
    }

    if (hasNegative || minJ <= 1e-14) {
      return this.createInvalid(minJ, maxJ, [`Negative or zero Jacobian in HEX8: minDet(J)=${minJ}`]);
    }

    const jacobianRatio = maxJ > 0 ? minJ / maxJ : 0;
    const qualityRating = jacobianRatio > 0.6 ? 'EXCELLENT' : (jacobianRatio > 0.2 ? 'GOOD' : 'POOR');

    return {
      isValid: true,
      isDegenerate: false,
      minJacobian: minJ,
      maxJacobian: maxJ,
      jacobianRatio,
      aspectRatio: 1.0 / (jacobianRatio || 0.001),
      skewness: 1.0 - jacobianRatio,
      volumeOrArea: minJ * 8.0,
      qualityRating,
      failureReasons: []
    };
  }

  private static createInvalid(minJ: number, maxJ: number, failureReasons: string[]): ElementQualityMetrics {
    return {
      isValid: false,
      isDegenerate: true,
      minJacobian: minJ,
      maxJacobian: maxJ,
      jacobianRatio: 0,
      aspectRatio: Infinity,
      skewness: 1.0,
      volumeOrArea: 0,
      qualityRating: 'INVALID',
      failureReasons
    };
  }
}
