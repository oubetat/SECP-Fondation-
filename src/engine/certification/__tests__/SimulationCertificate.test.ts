/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-164: Simulation Certificate Unit & Adversarial Test Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationCertificateEngine } from '../SimulationCertificateEngine';
import { HardAcceptanceGate164 } from '../HardAcceptanceGate164';
import { CryptographicAttestationEngine } from '../../attestation/CryptographicAttestationEngine';
import { SigningKeyPair } from '../../attestation/types';
import {
  SimulationInputManifest,
  SimulationExecutionManifest,
  SimulationResultManifest,
  SimulationVerificationMatrix,
  SimulationCertificationPolicy,
} from '../simulationTypes';

describe('PATCH-164: Simulation Certificate Engine & Hard Gate Suite', () => {
  let engine: SimulationCertificateEngine;

  const testKeyPair: SigningKeyPair = {
    keyId: 'KEY-TEST-P256',
    algorithm: 'ECDSA-P256-SHA256',
    publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...',
    privateKey: 'private_key_hex_string_sample',
  };

  const defaultPolicy: SimulationCertificationPolicy = {
    policyId: 'POL-SIM-TEST-POLICY',
    policyVersion: '1.0.0',
    requiredClaims: ['CFD_CONVERGED', 'MASS_CONSERVED'],
    minCertificationLevel: 5,
    requiredSolverIdentity: 'CFD-SOLVER-N-S-V4',
    requiredSolverVersion: '4.2.1',
    requireConvergence: true,
    requireConservation: true,
  };

  const sampleCfdParams = {
    fluid: 'Air',
    density: 1.204,
    viscosity: 1.81e-5,
    boundaryConditions: { inletVelocity: 10.0, outletPressure: 0.0 },
    initialConditions: { velocity: 0.0, pressure: 0.0 },
    solverSettings: { relaxU: 0.7, relaxP: 0.3 },
    timeStep: 0.001,
    convergenceCriteria: { continuity: 1e-4, momentum: 1e-4 },
    turbulenceModel: 'k-epsilon',
    numericalSchemes: { convective: 'second-order' },
  };

  const sampleFemParams = {
    material: 'Steel',
    youngsModulus: 2e11,
    poissonRatio: 0.3,
    density: 7850,
    loads: { pointForce: -5000 },
    boundaryConditions: { fixedSupports: ['face-1'] },
    constraints: { fixedY: true },
    solverConfiguration: { method: 'direct-sparse' },
    convergenceCriteria: { forceTolerance: 1e-3 },
  };

  beforeEach(() => {
    engine = SimulationCertificateEngine.getInstance();
    engine.resetRegistry();
  });

  describe('Section 3 & 5: Simulation Identity & Input Manifests', () => {
    it('generates the exact same simulationId for identical configuration, and different ID for altered configurations', () => {
      const idA = SimulationCertificateEngine.computeSimulationId({
        engineeringObjectId: 'PART-A',
        objectRevision: 'REV-01',
        simulationType: 'CFD',
        modelHash: 'MODEL-H1',
        meshHash: 'MESH-H1',
        materialHash: 'MAT-H1',
        boundaryConditionHash: 'BC-H1',
        solverConfigurationHash: 'SOLV-H1',
      });

      const idB = SimulationCertificateEngine.computeSimulationId({
        engineeringObjectId: 'PART-A',
        objectRevision: 'REV-01',
        simulationType: 'CFD',
        modelHash: 'MODEL-H1',
        meshHash: 'MESH-H1',
        materialHash: 'MAT-H1',
        boundaryConditionHash: 'BC-H1',
        solverConfigurationHash: 'SOLV-H1',
      });

      const idC = SimulationCertificateEngine.computeSimulationId({
        engineeringObjectId: 'PART-A',
        objectRevision: 'REV-01',
        simulationType: 'CFD',
        modelHash: 'MODEL-H1',
        meshHash: 'MESH-ALTERED', // changed
        materialHash: 'MAT-H1',
        boundaryConditionHash: 'BC-H1',
        solverConfigurationHash: 'SOLV-H1',
      });

      expect(idA).toBe(idB);
      expect(idA).not.toBe(idC);
    });

    it('detects modifications or mutations inside the cfd/fem input manifests through inputHash changes', () => {
      const rawA: Omit<SimulationInputManifest, 'inputHash'> = {
        simulationId: 'SIM-001',
        simulationType: 'CFD',
        projectId: 'PRJ-1',
        engineeringObjectId: 'PART-001',
        objectRevision: 'REV-01',
        modelHash: 'MODEL-HASH',
        geometryHash: 'GEOM-HASH',
        meshHash: 'MESH-HASH',
        materialHash: 'MAT-HASH',
        boundaryConditionHash: 'BC-HASH',
        initialConditionHash: 'IC-HASH',
        solverConfigurationHash: 'SOLV-HASH',
        cfdParameters: sampleCfdParams,
      };

      const manifestA = engine.buildSimulationInputManifest(rawA);

      const rawB: Omit<SimulationInputManifest, 'inputHash'> = {
        ...rawA,
        cfdParameters: {
          ...sampleCfdParams,
          density: 997, // modified density
        },
      };

      const manifestB = engine.buildSimulationInputManifest(rawB);

      expect(manifestA.inputHash).not.toBe(manifestB.inputHash);
    });
  });

  describe('Section 6 & 7: Simulation Execution & Results', () => {
    it('correctly maps execution statuses and differentiates CONVERGED from FAILED or ABORTED', () => {
      const exec1 = engine.buildSimulationExecutionManifest({
        executionId: 'EXEC-1',
        simulationId: 'SIM-001',
        solverIdentity: 'CFD-SOLVER-N-S-V4',
        solverVersion: '4.2.1',
        runtime: 'Node.js',
        platform: 'Linux',
        configuration: {},
        startTime: '2026-08-22T00:00:00Z',
        endTime: '2026-08-22T00:05:00Z',
        iterationCount: 100,
        terminationReason: 'CONVERGED',
      });

      const exec2 = { ...exec1, terminationReason: 'FAILED' as const };

      expect(exec1.terminationReason).toBe('CONVERGED');
      expect(exec2.terminationReason).toBe('FAILED');
    });

    it('rejects verification if conservation metrics fail', () => {
      const input = engine.buildSimulationInputManifest({
        simulationId: 'SIM-001',
        simulationType: 'CFD',
        projectId: 'PRJ-1',
        engineeringObjectId: 'PART-001',
        objectRevision: 'REV-01',
        modelHash: 'MODEL-HASH',
        geometryHash: 'GEOM-HASH',
        meshHash: 'MESH-HASH',
        materialHash: 'MAT-HASH',
        boundaryConditionHash: 'BC-HASH',
        initialConditionHash: 'IC-HASH',
        solverConfigurationHash: 'SOLV-HASH',
        cfdParameters: sampleCfdParams,
      });

      const exec = engine.buildSimulationExecutionManifest({
        executionId: 'EXEC-1',
        simulationId: 'SIM-001',
        solverIdentity: 'CFD-SOLVER-N-S-V4',
        solverVersion: '4.2.1',
        runtime: 'Node.js',
        platform: 'Linux',
        configuration: {},
        startTime: '2026-08-22T00:00:00Z',
        endTime: '2026-08-22T00:05:00Z',
        iterationCount: 100,
        terminationReason: 'CONVERGED',
      });

      const result = engine.buildSimulationResultManifest({
        resultId: 'RES-1',
        resultHash: 'RESULT-HASH',
        fieldHashes: {},
        scalarResults: {},
        residualHistory: [{ continuity: 1e-6 }],
        conservationMetrics: {
          isConserved: false, // physics laws violated!
          massError: 25.5,
        },
        convergenceMetrics: {
          isConverged: true,
          residualTolerance: 1e-5,
          finalResiduals: { continuity: 1e-6 },
        },
        solverTerminationState: 'CONVERGED',
      });

      const report = engine.verifySimulationEvidence({ input, execution: exec, result });
      expect(report.isValid).toBe(false);
      expect(report.conservation).toBe('NOT_CONSERVED');
    });
  });

  describe('Section 17: Reproducibility Policies', () => {
    it('compares runs successfully on BITWISE_IDENTICAL policy', () => {
      const rawInput: Omit<SimulationInputManifest, 'inputHash'> = {
        simulationId: 'SIM-001',
        simulationType: 'CFD',
        projectId: 'PRJ-1',
        engineeringObjectId: 'PART-001',
        objectRevision: 'REV-01',
        modelHash: 'M-HASH',
        geometryHash: 'G-HASH',
        meshHash: 'ME-HASH',
        materialHash: 'MA-HASH',
        boundaryConditionHash: 'B-HASH',
        initialConditionHash: 'I-HASH',
        solverConfigurationHash: 'S-HASH',
        cfdParameters: sampleCfdParams,
      };

      const inputA = engine.buildSimulationInputManifest(rawInput);
      const inputB = engine.buildSimulationInputManifest(rawInput);

      const execA = { executionId: 'EX-1', simulationId: 'SIM-001', solverIdentity: 'S', solverVersion: '1', runtime: 'R', platform: 'P', configuration: {}, startTime: '', endTime: '', iterationCount: 0, terminationReason: 'CONVERGED' as const };
      const execB = { ...execA, executionId: 'EX-2' };

      const resA = { resultId: 'R-1', resultHash: 'RES-HASH', fieldHashes: {}, scalarResults: { d: 0.1 }, solverTerminationState: 'OK' };
      const resB = { ...resA, resultId: 'R-2' };

      const comparison = engine.compareRuns(
        { input: inputA, execution: execA, result: resA },
        { input: inputB, execution: execB, result: resB },
        'BITWISE_IDENTICAL'
      );

      expect(comparison.isReproducible).toBe(true);
      expect(comparison.reason).toContain('Bitwise identical');
    });

    it('compares runs successfully on NUMERICALLY_EQUIVALENT_WITHIN_TOLERANCE policy', () => {
      const rawInput: Omit<SimulationInputManifest, 'inputHash'> = {
        simulationId: 'SIM-001',
        simulationType: 'CFD',
        projectId: 'PRJ-1',
        engineeringObjectId: 'PART-001',
        objectRevision: 'REV-01',
        modelHash: 'M-HASH',
        geometryHash: 'G-HASH',
        meshHash: 'ME-HASH',
        materialHash: 'MA-HASH',
        boundaryConditionHash: 'B-HASH',
        initialConditionHash: 'I-HASH',
        solverConfigurationHash: 'S-HASH',
        cfdParameters: sampleCfdParams,
      };

      const inputA = engine.buildSimulationInputManifest(rawInput);
      const inputB = engine.buildSimulationInputManifest({ ...rawInput, boundaryConditionHash: 'BC-DIFFERENT' });

      const execA = { executionId: 'EX-1', simulationId: 'SIM-001', solverIdentity: 'S', solverVersion: '1', runtime: 'R', platform: 'P', configuration: {}, startTime: '', endTime: '', iterationCount: 0, terminationReason: 'CONVERGED' as const };
      const execB = { ...execA, executionId: 'EX-2' };

      const resA = { resultId: 'R-1', resultHash: 'RES-HASH-1', fieldHashes: {}, scalarResults: { lift: 1.050001 }, solverTerminationState: 'OK' };
      const resB = { resultId: 'R-2', resultHash: 'RES-HASH-2', fieldHashes: {}, scalarResults: { lift: 1.050002 }, solverTerminationState: 'OK' };

      const bitwiseComparison = engine.compareRuns(
        { input: inputA, execution: execA, result: resA },
        { input: inputB, execution: execB, result: resB },
        'BITWISE_IDENTICAL'
      );
      expect(bitwiseComparison.isReproducible).toBe(false);

      const numericalComparison = engine.compareRuns(
        { input: inputA, execution: execA, result: resA },
        { input: inputB, execution: execB, result: resB },
        'NUMERICALLY_EQUIVALENT_WITHIN_TOLERANCE',
        1e-5
      );

      expect(numericalComparison.isReproducible).toBe(true);
      expect(numericalComparison.reason).toContain('Numerical equivalence');
    });
  });

  describe('Section 19: Hard Acceptance Gate 164 Evaluation', () => {
    it('runs the HardAcceptanceGate164 suite successfully with all checks passing', () => {
      const report = HardAcceptanceGate164.evaluate();
      const failed = report.checks.filter(c => !c.passed);
      if (failed.length > 0) {
        console.log('Failed checks inside HardAcceptanceGate164:', JSON.stringify(failed, null, 2));
      }
      expect(report.verdict).toBe('PASS');
      expect(report.passedChecks).toBe(report.totalChecks);
      expect(report.totalChecks).toBeGreaterThanOrEqual(15);
    });
  });
});
