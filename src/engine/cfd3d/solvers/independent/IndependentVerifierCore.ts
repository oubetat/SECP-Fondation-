/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-072: Independent CFD Verifier Core Engine and Audits
 */

import { CFDCaseManifest, IndependentCheckConfig, IndependentVerifierVerdict, VerifierDisagreementRecord } from './IndependentTypes';

export class InputIntegrityVerifier {
  public static verifyHashes(manifest: CFDCaseManifest, actualHashes: Record<string, string>): boolean {
    if (manifest.geometryHash !== actualHashes.geometry) return false;
    if (manifest.meshHash !== actualHashes.mesh) return false;
    if (manifest.materialHash !== actualHashes.material) return false;
    if (manifest.bcHash !== actualHashes.bc) return false;
    if (manifest.icHash !== actualHashes.ic) return false;
    if (manifest.solverConfigHash !== actualHashes.solverConfig) return false;
    return true;
  }
}

export class GeometryVerifier {
  public static verifyGeometry(
    dimensions: readonly number[],
    expectedVolume: number,
    tolerance: number
  ): { readonly isValid: boolean; readonly computedVolume: number } {
    // Computes characteristic volume out-of-band: e.g. Box L * W * H
    const computedVolume = dimensions.reduce((acc, d) => acc * d, 1.0);
    const diff = Math.abs(computedVolume - expectedVolume);
    return {
      isValid: diff <= tolerance,
      computedVolume
    };
  }
}

export class MeshVerifier {
  public static verifyTopologyAndQuality(
    cellCount: number,
    faceCount: number,
    skewness: number,
    nonOrthogonality: number,
    negativeVolumes: boolean
  ): boolean {
    if (cellCount <= 0 || faceCount <= 0) return false;
    if (skewness > 0.95) return false; // EXCESSIVE_SKEWNESS limit
    if (nonOrthogonality > 80.0) return false; // poor orthogonality
    if (negativeVolumes) return false; // negative cell volumes forbidden
    return true;
  }
}

export class UnitsVerifier {
  public static checkDimensionalConsistency(units: Record<string, string>): boolean {
    const canonicalUnits: Record<string, string> = {
      density: 'kg/m3',
      pressure: 'Pa',
      velocity: 'm/s',
      viscosity: 'Pa.s',
      temperature: 'K',
      energy: 'J'
    };

    for (const key of Object.keys(canonicalUnits)) {
      if (units[key] && units[key] !== canonicalUnits[key]) {
        return false; // Mismatch in dimensional unit canonicalization
      }
    }
    return true;
  }
}

export class ResultIntegrityVerifier {
  public static verifyResult(
    fieldValues: readonly number[],
    expectedCellCount: number,
    allowNegativeDensity: boolean = false
  ): { readonly isValid: boolean; readonly hasNaNOrInf: boolean } {
    if (fieldValues.length !== expectedCellCount) {
      return { isValid: false, hasNaNOrInf: false };
    }

    for (const val of fieldValues) {
      if (isNaN(val) || !isFinite(val)) {
        return { isValid: false, hasNaNOrInf: true };
      }
      if (!allowNegativeDensity && val < 0.0) {
        // Density must be strictly positive
        return { isValid: false, hasNaNOrInf: false };
      }
    }

    return { isValid: true, hasNaNOrInf: false };
  }
}

export class IndependentResidualCalculator {
  public static recomputeImbalanceResidual(
    fluxes: readonly number[],
    sources: readonly number[]
  ): number {
    const netFlux = fluxes.reduce((acc, f) => acc + f, 0.0);
    const netSource = sources.reduce((acc, s) => acc + s, 0.0);
    return Math.abs(netFlux - netSource);
  }
}

export class ConservationRecalculator {
  public static recalculateGlobalBalances(
    massFluxes: readonly number[],
    momentumFluxes: readonly number[],
    energyFluxes: readonly number[]
  ): { readonly massImbalance: number; readonly momentumImbalance: number; readonly energyImbalance: number } {
    const massImbalance = Math.abs(massFluxes.reduce((acc, f) => acc + f, 0.0));
    const momentumImbalance = Math.abs(momentumFluxes.reduce((acc, f) => acc + f, 0.0));
    const energyImbalance = Math.abs(energyFluxes.reduce((acc, f) => acc + f, 0.0));
    return { massImbalance, momentumImbalance, energyImbalance };
  }
}

export class IndependentVerifierCore {
  public static verifyDualCalculations(
    primaryValues: readonly { name: string; val: number }[],
    independentValues: readonly { name: string; val: number }[],
    config: IndependentCheckConfig
  ): IndependentVerifierVerdict {
    const auditRecords: { stepId: string; calculationName: string; primaryValue: number; verifiedValue: number; status: 'VERIFIED' | 'DISAGREEMENT' }[] = [];
    let passed = true;

    for (const prim of primaryValues) {
      const matchedInd = independentValues.find(ind => ind.name === prim.name);
      if (!matchedInd) {
        passed = false;
        auditRecords.push({
          stepId: prim.name,
          calculationName: prim.name,
          primaryValue: prim.val,
          verifiedValue: NaN,
          status: 'DISAGREEMENT'
        });
        continue;
      }

      const diff = Math.abs(prim.val - matchedInd.val);
      const relativeDiff = prim.val !== 0 ? diff / Math.abs(prim.val) : diff;

      const matched = diff <= config.absoluteTolerance || relativeDiff <= config.relativeTolerance;

      if (!matched) {
        passed = false;
      }

      auditRecords.push({
        stepId: prim.name,
        calculationName: prim.name,
        primaryValue: prim.val,
        verifiedValue: matchedInd.val,
        status: matched ? 'VERIFIED' : 'DISAGREEMENT'
      });
    }

    return {
      verifierId: 'SECP-IndependentVerifier-072',
      passed,
      auditRecords,
      status: passed ? 'VERIFIED' : 'VERIFIER_DISAGREEMENT'
    };
  }

  public static replayCFDVerification(
    manifest: CFDCaseManifest,
    actualHashes: Record<string, string>,
    primaryValues: readonly { name: string; val: number }[],
    independentValues: readonly { name: string; val: number }[],
    config: IndependentCheckConfig
  ): { readonly success: boolean; readonly verdict: string } {
    const hashesPassed = InputIntegrityVerifier.verifyHashes(manifest, actualHashes);
    if (!hashesPassed) {
      return { success: false, verdict: 'INPUT_TAMPERED' };
    }

    const dualVerdict = this.verifyDualCalculations(primaryValues, independentValues, config);
    if (dualVerdict.status === 'VERIFIER_DISAGREEMENT') {
      return { success: false, verdict: 'VERIFICATION_FAILED' };
    }

    return { success: true, verdict: 'INDEPENDENTLY_VERIFIED' };
  }
}
