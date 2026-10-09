/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-075: Verdict Engine & Canonical Decision Logic
 */

import {
  CFDVerdict,
  ConvergencePolicy,
  ConservationPolicy,
  ValidityPolicy,
  VerdictExplanation,
  VerdictEvidence
} from './AdversarialTypes';
import { PhysicalValidityAnalyzer } from './PhysicalValidityAnalyzer';
import { IndependentConvergenceAnalyzer } from './IndependentConvergenceAnalyzer';
import { IndependentConservationAnalyzer } from './IndependentConservationAnalyzer';

export class VerdictEngine {
  public static defaultConvergencePolicy(): ConvergencePolicy {
    return {
      residualThreshold: 1e-5,
      minIterations: 10,
      maxIterations: 1000,
      stagnationWindow: 15,
      stagnationTolerance: 0.001,
      allowedOscillationCount: 5,
      policyVersion: '1.0.0'
    };
  }

  public static defaultConservationPolicy(): ConservationPolicy {
    return {
      maxMassImbalance: 1e-4,
      maxMomentumImbalance: 1e-3,
      maxEnergyImbalance: 1e-3,
      policyVersion: '1.0.0'
    };
  }

  public static defaultValidityPolicy(): ValidityPolicy {
    return {
      allowNegativePressure: false,
      allowNegativeDensity: false,
      allowNegativeViscosity: false,
      strictMeshOrthogonality: true,
      policyVersion: '1.0.0'
    };
  }

  public static computeCFDVerdict(params: {
    readonly fields: Readonly<Record<string, readonly number[]>>;
    readonly meshVolumes: readonly number[];
    readonly invertedCellFlags?: readonly boolean[];
    readonly residualHistory: readonly number[];
    readonly fluxes: {
      readonly massIn: number;
      readonly massOut: number;
      readonly momentumIn?: number;
      readonly momentumOut?: number;
      readonly energyIn?: number;
      readonly energyOut?: number;
    };
    readonly solverClaimedStatus?: string;
    readonly solverExitCode?: number;
    readonly convergencePolicy?: ConvergencePolicy;
    readonly conservationPolicy?: ConservationPolicy;
    readonly validityPolicy?: ValidityPolicy;
  }): {
    readonly verdict: CFDVerdict;
    readonly explanation: VerdictExplanation;
    readonly evidence: VerdictEvidence;
  } {
    const convPolicy = params.convergencePolicy ?? this.defaultConvergencePolicy();
    const consPolicy = params.conservationPolicy ?? this.defaultConservationPolicy();
    const valPolicy = params.validityPolicy ?? this.defaultValidityPolicy();

    const triggeredRules: string[] = [];
    const failedRules: string[] = [];
    const details: string[] = [];

    // STEP 1: Audit Fields for NaN / Inf / Negative Unphysical Values
    let anyFieldInvalid = false;
    let hasNaNOrInf = false;
    for (const fieldName of Object.keys(params.fields)) {
      const fieldAudit = PhysicalValidityAnalyzer.auditField(
        fieldName,
        params.fields[fieldName],
        valPolicy
      );
      if (!fieldAudit.isValid) {
        anyFieldInvalid = true;
        if (fieldAudit.hasNaN || fieldAudit.hasInf) hasNaNOrInf = true;
        details.push(...fieldAudit.reasons);
      }
    }

    // STEP 2: Audit Mesh
    const meshAudit = PhysicalValidityAnalyzer.auditMesh(
      params.meshVolumes,
      params.invertedCellFlags ?? []
    );
    const meshValid = meshAudit.isValid;
    if (!meshValid) {
      details.push(...meshAudit.reasons);
    }

    // STEP 3: Audit Conservation
    const consAudit = IndependentConservationAnalyzer.auditBalances(params.fluxes, consPolicy);
    if (!consAudit.isConserved) {
      details.push(...consAudit.reasons);
    }

    // STEP 4: Audit Convergence
    const convAudit = IndependentConvergenceAnalyzer.auditResidualHistory(
      params.residualHistory,
      convPolicy,
      params.solverClaimedStatus === 'CONVERGED'
    );
    if (!convAudit.isConverged) {
      details.push(...convAudit.reasons);
    }

    // STEP 5: Evaluate Canonical Verdict based on Strict Priority
    let verdict: CFDVerdict = 'CONVERGED';
    let primaryReason = 'All validity, conservation, and convergence criteria satisfied.';

    if (anyFieldInvalid || !meshValid) {
      verdict = 'INVALID';
      primaryReason = 'Numerical solution contains invalid fields, unphysical values, or corrupted mesh topology.';
      triggeredRules.push('RULE_VALIDITY_CHECK');
      failedRules.push('RULE_VALIDITY_CHECK');
    } else if (!consAudit.isConserved) {
      verdict = 'CONSERVATION_FAILURE';
      primaryReason = `Global flux balance violated (mass imbalance: ${consAudit.massImbalance.toExponential(3)}).`;
      triggeredRules.push('RULE_CONSERVATION_CHECK');
      failedRules.push('RULE_CONSERVATION_CHECK');
    } else if (!convAudit.isConverged) {
      verdict = 'NOT_CONVERGED';
      primaryReason = `Numerical convergence not achieved (final residual: ${convAudit.finalResidual.toExponential(3)}).`;
      triggeredRules.push('RULE_CONVERGENCE_CHECK');
      failedRules.push('RULE_CONVERGENCE_CHECK');
    } else {
      triggeredRules.push('RULE_FULL_CONVERGENCE_AND_CONSERVATION');
    }

    const explanation: VerdictExplanation = {
      verdict,
      primaryReason,
      details,
      triggeredRules,
      failedRules
    };

    const evidence: VerdictEvidence = {
      caseId: 'computed-case',
      runId: 'computed-run',
      timestamp: new Date().toISOString(),
      hasNaNOrInf,
      meshValid,
      bcValid: true,
      residualValid: !convAudit.hasResidualReset && !convAudit.isDiverging,
      finalResidual: convAudit.finalResidual,
      convergenceAchieved: convAudit.isConverged,
      massImbalance: consAudit.massImbalance,
      conservationAchieved: consAudit.isConserved,
      solverReportedStatus: params.solverClaimedStatus ?? 'UNKNOWN',
      solverExitCode: params.solverExitCode ?? 0,
      evidenceRootHash: 'evidence-root-computed'
    };

    return { verdict, explanation, evidence };
  }
}
