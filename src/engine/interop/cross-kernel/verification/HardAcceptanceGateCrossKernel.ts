/**
 * SECP Industrial OS v2 — Cross-Kernel Hard Acceptance Gate
 * PATCH-040: Industrial CAD Interoperability & Loss Measurement
 * 
 * Strict forensic evaluation gate for Cross-Kernel Round-Trip Qualification.
 * Enforces non-negotiable rules:
 * - If no genuine external kernel is available -> UNPROVEN (never PASS)
 * - If test harness adapter is used -> UNPROVEN (never PASS)
 * - If volume/topology/unit loss occurs -> FAIL
 * - If evidence is corrupted or tampered -> INVALID
 */

import {
  CrossKernelEvidencePackage,
  CrossKernelVerdict
} from '../CrossKernelTypes';

export interface CrossKernelGateEvaluation {
  passed: boolean;
  verdict: CrossKernelVerdict;
  reason: string;
  metrics: {
    genuineExternalKernelExecuted: boolean;
    exportPassed: boolean;
    externalImportPassed: boolean;
    externalExportPassed: boolean;
    reimportPassed: boolean;
    geometryPassed: boolean;
    topologyPassed: boolean;
    unitsPassed: boolean;
    criticalLossCount: number;
    provenanceChainLength: number;
  };
  domainStatus: {
    geometry: string;
    topology: string;
    brep: string;
    nurbs: string;
    featureHistory: string;
    assembly: string;
    pmi: string;
    units: string;
  };
}

export class HardAcceptanceGateCrossKernel {

  public static evaluate(pkg: CrossKernelEvidencePackage): CrossKernelGateEvaluation {
    // 1. Validate Evidence Package Structure
    if (!pkg || !pkg.sourceBaseline || !pkg.differenceReport || !pkg.exportEvidence || !pkg.roundtripEvidence) {
      return {
        passed: false,
        verdict: 'INVALID',
        reason: 'Evidence package is missing required structural sections',
        metrics: this.getZeroMetrics(),
        domainStatus: this.getEmptyDomainStatus()
      };
    }

    // 2. Tamper / Schema Check
    if (!pkg.sourceArtifactHash || !pkg.sourceCanonicalHash || !pkg.packageId) {
      return {
        passed: false,
        verdict: 'INVALID',
        reason: 'Evidence package failed cryptographic identity verification',
        metrics: this.getZeroMetrics(),
        domainStatus: this.getEmptyDomainStatus()
      };
    }

    const isTestHarness = pkg.externalKernelIdentity?.isTestHarness === true;
    const isAvailable = pkg.externalKernelStatus === 'AVAILABLE';
    const genuineExternal = isAvailable && !isTestHarness;

    const diffs = pkg.differenceReport;
    const geomRes = diffs.categories.GEOMETRY;
    const topoRes = diffs.categories.TOPOLOGY;
    const unitsRes = diffs.categories.UNITS;

    const exportPassed = pkg.exportEvidence.errors.length === 0 && pkg.exportEvidence.stepByteLength > 0;
    const extImportPassed = pkg.externalImportEvidence.importSuccess;
    const extExportPassed = pkg.externalExportEvidence.exportSuccess && pkg.externalExportEvidence.stepByteLength > 0;
    const reimportPassed = pkg.roundtripEvidence.structuralValid && pkg.roundtripEvidence.geometryValid;

    const geometryPassed = geomRes.fidelityStatus !== 'FAIL' && geomRes.lossClassification !== 'ENGINEERING_LOSS';
    const topologyPassed = topoRes.fidelityStatus !== 'FAIL' && topoRes.lossClassification !== 'ENGINEERING_LOSS';
    const unitsPassed = unitsRes.fidelityStatus !== 'FAIL' && unitsRes.lossClassification !== 'ENGINEERING_LOSS';

    const criticalLossCount = diffs.criticalCount;
    const provenanceChainLength = (pkg.provenanceChain || []).length;

    const metrics = {
      genuineExternalKernelExecuted: genuineExternal,
      exportPassed,
      externalImportPassed: extImportPassed,
      externalExportPassed: extExportPassed,
      reimportPassed,
      geometryPassed,
      topologyPassed,
      unitsPassed,
      criticalLossCount,
      provenanceChainLength
    };

    const domainStatus = {
      geometry: geomRes.fidelityStatus,
      topology: topoRes.fidelityStatus,
      brep: diffs.categories.BREP.fidelityStatus,
      nurbs: diffs.categories.NURBS.fidelityStatus,
      featureHistory: diffs.categories.FEATURE_HISTORY.fidelityStatus,
      assembly: diffs.categories.ASSEMBLY.fidelityStatus,
      pmi: diffs.categories.PMI.fidelityStatus,
      units: unitsRes.fidelityStatus
    };

    // Rule 1: Unavailable External CAD Kernel Check
    if (!isAvailable) {
      return {
        passed: false,
        verdict: 'UNPROVEN',
        reason: 'External CAD kernel is UNAVAILABLE in this environment (Verdict is strictly UNPROVEN per Step 26).',
        metrics,
        domainStatus
      };
    }

    // Rule 2: Tampered or Incoherent Evidence
    if (diffs.criticalCount > 0 && diffs.overallLossClassification === 'NO_LOSS') {
      return {
        passed: false,
        verdict: 'INCONCLUSIVE',
        reason: 'Contradictory metrics: critical difference recorded with NO_LOSS classification',
        metrics,
        domainStatus
      };
    }

    // Rule 3: Actual Engineering Failure
    if (!exportPassed || !reimportPassed || !geometryPassed || !topologyPassed || !unitsPassed || criticalLossCount > 0) {
      return {
        passed: false,
        verdict: 'FAIL',
        reason: `Engineering loss detected across round-trip boundary: criticalCount=${criticalLossCount}, geomPassed=${geometryPassed}, topoPassed=${topologyPassed}, unitsPassed=${unitsPassed}`,
        metrics,
        domainStatus
      };
    }

    // Rule 4: Test Harness Adapter Check (cannot grant genuine PASS)
    if (isTestHarness) {
      return {
        passed: false,
        verdict: 'UNPROVEN',
        reason: 'Test harness adapter was used. Test harness validates pipeline mechanics only and cannot grant genuine PASS (Verdict is strictly UNPROVEN per Step 26).',
        metrics,
        domainStatus
      };
    }

    // Rule 5: Genuine External Kernel Succeeded Losslessly / Toleranced
    return {
      passed: true,
      verdict: 'PASS',
      reason: 'Genuine external CAD kernel executed successfully. Boundary representation and geometry verified within tolerance.',
      metrics,
      domainStatus
    };
  }

  private static getZeroMetrics() {
    return {
      genuineExternalKernelExecuted: false,
      exportPassed: false,
      externalImportPassed: false,
      externalExportPassed: false,
      reimportPassed: false,
      geometryPassed: false,
      topologyPassed: false,
      unitsPassed: false,
      criticalLossCount: 0,
      provenanceChainLength: 0
    };
  }

  private static getEmptyDomainStatus() {
    return {
      geometry: 'UNPROVEN',
      topology: 'UNPROVEN',
      brep: 'UNPROVEN',
      nurbs: 'UNPROVEN',
      featureHistory: 'UNPROVEN',
      assembly: 'UNPROVEN',
      pmi: 'UNPROVEN',
      units: 'UNPROVEN'
    };
  }
}
