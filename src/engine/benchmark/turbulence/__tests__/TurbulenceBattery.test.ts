import { describe, it, expect } from 'vitest';
import { TurbulenceBattery } from '../TurbulenceBattery';
import { TurbulenceModelDiscoveryEngine } from '../TurbulenceModelDiscovery';
import { TurbulenceExecutionPathVerifier } from '../TurbulenceExecutionPathVerifier';
import { TurbulenceCaseRegistry } from '../TurbulenceCaseRegistry';
import { TurbulenceAdversarialSuite } from '../TurbulenceAdversarialSuite';
import { HardAcceptanceGate176 } from '../HardAcceptanceGate176';

describe('PATCH-176: CFD Turbulence Benchmark Engine', () => {
  it('discovers and classifies all turbulence models without false claims', () => {
    const discovered = TurbulenceModelDiscoveryEngine.discoverModels();
    expect(discovered.length).toBeGreaterThanOrEqual(6);
    expect(discovered.some(m => m.model === 'LAMINAR')).toBe(true);
    expect(discovered.some(m => m.model === 'K_EPSILON')).toBe(true);
    expect(discovered.some(m => m.validation === 'UNPROVEN')).toBe(true);
  });

  it('verifies turbulence model execution path integration', () => {
    const audit = TurbulenceExecutionPathVerifier.verifyExecutionPath();
    expect(audit.turbulentViscosityActive).toBe(true);
    expect(audit.viscosityMaxDiffPercent).toBeGreaterThan(0);
  });

  it('calculates Reynolds numbers dynamically from physical inputs', () => {
    const reCalc = TurbulenceCaseRegistry.calculateReynoldsNumber(1.225, 10.0, 0.015, 1.81e-5);
    expect(reCalc.calculatedReynoldsNumber).toBeCloseTo(10151.9, 0);
    expect(reCalc.flowRegimeClassification).toBe('TURBULENT');
  });

  it('intercepts 100% of adversarial attack vectors', () => {
    const advResults = TurbulenceAdversarialSuite.runAdversarialAttacks();
    expect(advResults.length).toBe(6);
    expect(advResults.every(r => r.passed)).toBe(true);
  });

  it('runs full turbulence battery and passes Gate 176', () => {
    const report = TurbulenceBattery.runFullBattery();
    expect(report.gate176Result.passed).toBe(true);
    expect(report.gate176Result.score).toBe(100);
    expect(report.finalVerdict).toBe('PASS');
    expect(report.gate176Result.attestationSignature).toContain('SECP-GATE176-SIG-');

    // Evidence Contract Integrity Verifications
    expect(report.referenceValidations).toBeDefined();
    expect(report.referenceValidations.length).toBe(4);
    expect(report.caseExecutionRecords).toBeDefined();
    expect(report.caseExecutionRecords.length).toBe(4);
    expect(report.meshSensitivityStudy).toBeDefined();
    expect(report.meshSensitivityStudy.points.length).toBe(3);
    expect(report.adversarialDefense).toBeDefined();
    expect(report.adversarialDefense.length).toBe(6);

    // Verify raw numerical values
    const channelCase = report.caseExecutionRecords.find(c => c.caseId === 'TC-TURB-01-CHANNEL');
    expect(channelCase).toBeDefined();
    expect(channelCase?.executionId).toBeDefined();
    expect(channelCase?.forceStabilityPassed).toBe(true);
    expect(channelCase?.convergenceStatus).toBe('CONVERGED');
    expect(channelCase?.errorPercent).toBeLessThan(25.0);

    const pipeCase = report.caseExecutionRecords.find(c => c.caseId === 'TC-TURB-02-PIPE');
    expect(pipeCase).toBeDefined();
    expect(pipeCase?.executionId).toBeDefined();
    expect(pipeCase?.forceStabilityPassed).toBe(true);
    expect(pipeCase?.convergenceStatus).toBe('CONVERGED');
    expect(pipeCase?.errorPercent).toBeLessThan(25.0);

    const apgCase = report.caseExecutionRecords.find(c => c.caseId === 'TC-TURB-04-ADVERSE-PRESSURE');
    expect(apgCase).toBeDefined();
    expect(apgCase?.verdict).toBe('UNPROVEN');
    expect(apgCase?.convergenceStatus).toBe('CONVERGED');

    // Cryptographic Attestation Verification
    const attestationCheck = HardAcceptanceGate176.verifyAttestation(report);
    expect(attestationCheck.isValid).toBe(true);

    // Tamper Resistance Test: Mutating any engineering result invalidates the attestation
    const tamperedReportMetric = JSON.parse(JSON.stringify(report));
    tamperedReportMetric.worstReferenceErrorPercent = 0.01;
    expect(HardAcceptanceGate176.verifyAttestation(tamperedReportMetric).isValid).toBe(false);

    const tamperedReportCase = JSON.parse(JSON.stringify(report));
    tamperedReportCase.referenceValidations[0].calculatedValue += 0.05;
    expect(HardAcceptanceGate176.verifyAttestation(tamperedReportCase).isValid).toBe(false);

    const tamperedReportExec = JSON.parse(JSON.stringify(report));
    tamperedReportExec.caseExecutionRecords[0].actualIterations = 999;
    expect(HardAcceptanceGate176.verifyAttestation(tamperedReportExec).isValid).toBe(false);
  });
});
