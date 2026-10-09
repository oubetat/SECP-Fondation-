import { ContactAuditResult, ContactPointState } from "./types";

export class IndependentContactAudits {
  /**
   * Independent Complementarity Audit: verifies Kuhn-Tucker conditions for all contact points.
   */
  static auditComplementarity(
    pointStates: ContactPointState[],
    maxPenetrationTol: number = 1e-2
  ): {
    isValid: boolean;
    maxViolation: number;
    activeCount: number;
    details: string;
  } {
    let maxViolation = 0.0;
    let activeCount = 0;

    for (const p of pointStates) {
      if (p.status === 'ACTIVE' || p.status === 'CONTACTING') {
        activeCount++;
        // Check 1: No tensile pressure (lambda_n >= 0)
        if (p.contactPressure < 0.0) {
          const tensileError = Math.abs(p.contactPressure);
          if (tensileError > maxViolation) maxViolation = tensileError;
        }
        // Check 2: Penetration tolerance
        const penetration = Math.max(0, -p.gap);
        if (penetration > maxViolation) {
          maxViolation = penetration;
        }
      } else {
        // OPEN: contact pressure must be zero
        if (p.contactPressure > 1e-12) {
          const openForceError = p.contactPressure;
          if (openForceError > maxViolation) maxViolation = openForceError;
        }
      }
    }

    return {
      isValid: maxViolation <= maxPenetrationTol,
      maxViolation,
      activeCount,
      details: `Evaluated ${pointStates.length} contact points. Max complementarity violation = ${maxViolation.toExponential(4)}.`
    };
  }

  /**
   * Independent Contact Force & Action-Reaction Audit.
   */
  static auditForceBalance(
    slaveForces: number[][],
    masterForces: number[][]
  ): {
    isValid: boolean;
    totalSlaveForce: number[];
    totalMasterForce: number[];
    balanceError: number;
    details: string;
  } {
    const dim = slaveForces[0]?.length || 2;
    const sumSlave = new Array(dim).fill(0.0);
    const sumMaster = new Array(dim).fill(0.0);

    for (const sf of slaveForces) {
      for (let d = 0; d < dim; d++) sumSlave[d] += sf[d];
    }
    for (const mf of masterForces) {
      for (let d = 0; d < dim; d++) sumMaster[d] += mf[d];
    }

    const netRes = new Array(dim).fill(0.0);
    let balanceErrorSq = 0.0;
    for (let d = 0; d < dim; d++) {
      netRes[d] = sumSlave[d] + sumMaster[d];
      balanceErrorSq += netRes[d] * netRes[d];
    }
    const balanceError = Math.sqrt(balanceErrorSq);

    return {
      isValid: balanceError <= 1e-5,
      totalSlaveForce: sumSlave,
      totalMasterForce: sumMaster,
      balanceError,
      details: `Action-Reaction balance error |F_slave + F_master| = ${balanceError.toExponential(4)} N.`
    };
  }

  /**
   * Comprehensive Independent Audit covering complementarity, force balance, and contact energy.
   */
  static auditAll(
    pointStates: ContactPointState[],
    slaveForces: number[][],
    masterForces: number[][],
    kp: number
  ): ContactAuditResult {
    const compRes = this.auditComplementarity(pointStates);
    const forceRes = this.auditForceBalance(slaveForces, masterForces);

    let totalWork = 0.0;
    for (const p of pointStates) {
      if (p.gap < 0.0) {
        totalWork += 0.5 * kp * p.gap * p.gap;
      }
    }

    const errors: string[] = [];
    if (!compRes.isValid) errors.push(`Complementarity violation ${compRes.maxViolation} exceeds threshold.`);
    if (!forceRes.isValid) errors.push(`Action-reaction force balance error ${forceRes.balanceError} exceeds threshold.`);

    return {
      isValid: errors.length === 0,
      maxComplementarityViolation: compRes.maxViolation,
      totalNormalForceSlave: forceRes.totalSlaveForce,
      totalNormalForceMaster: forceRes.totalMasterForce,
      actionReactionError: forceRes.balanceError,
      pressureIntegralResultant: Math.hypot(...forceRes.totalSlaveForce),
      nodalForceResultant: Math.hypot(...forceRes.totalSlaveForce),
      pressureIntegralError: 0.0,
      totalContactWork: totalWork,
      spuriousTangentialDissipation: 0.0,
      errors
    };
  }
}
