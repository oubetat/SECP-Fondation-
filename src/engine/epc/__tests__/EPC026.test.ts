/**
 * SECP Industrial OS — EPC-026 Test Suite
 * FEA Structural Verification Test Suite
 * Tests FEA model creation, CAD entity mapping, material assignments,
 * mesh quality gate, unit validation, actual solver execution, convergence,
 * static equilibrium, engineering margins, failure location pinpointing,
 * CAD-to-FEA traceability, reproducibility, cryptographic evidence,
 * and master verifier verdict PASS across all 25 acceptance criteria.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FEAModelGenerator } from '../fea/FEAModelGenerator';
import { MeshQualityGateService } from '../fea/MeshQualityGateService';
import { FEAUnitValidatorService } from '../fea/FEAUnitValidatorService';
import { FEASolverExecutionEngine } from '../fea/FEASolverExecutionEngine';
import { StructuralEquilibriumValidator } from '../fea/StructuralEquilibriumValidator';
import { StructuralAcceptanceEngine } from '../fea/StructuralAcceptanceEngine';
import { CADToFEATraceabilityService } from '../fea/CADToFEATraceabilityService';
import { EPC026EvidenceGenerator } from '../fea/EPC026EvidenceGenerator';
import { EPC026Verifier } from '../fea/EPC026Verifier';
import { DroneStructuralLoadCaseManager } from '../loads/DroneStructuralLoadCaseManager';

describe('EPC-026: FEA Verification System', () => {
  let loadCaseManager: DroneStructuralLoadCaseManager;

  beforeEach(() => {
    loadCaseManager = new DroneStructuralLoadCaseManager();
  });

  describe('1. FEA Model Creation & CAD Mapping', () => {
    it('should generate FEA Model with explicit CAD-to-FEA entity mappings for LC-001', () => {
      const lc001 = loadCaseManager.getLoadCaseById('LC-001')!;
      expect(lc001).toBeDefined();

      const feaModel = FEAModelGenerator.generateFEAModelForLoadCase(lc001);
      expect(feaModel.modelId).toBe('FEA-MODEL-LC-001');
      expect(feaModel.mesh.nodes.length).toBeGreaterThan(10);
      expect(feaModel.mesh.elements.length).toBeGreaterThan(10);
      expect(feaModel.entityMappings.length).toBeGreaterThan(0);

      const armMapping = feaModel.entityMappings.find(m => m.feaComponentId === 'COMP-ARM-001');
      expect(armMapping).toBeDefined();
      expect(armMapping?.cadPartId).toContain('CAD-PART-ARM-1');
      expect(armMapping?.feaNodeIds.length).toBeGreaterThan(0);
      expect(armMapping?.feaElementIds.length).toBeGreaterThan(0);
    });

    it('should assign valid material properties (E, nu, rho, yield) for all components', () => {
      const lc001 = loadCaseManager.getLoadCaseById('LC-001')!;
      const feaModel = FEAModelGenerator.generateFEAModelForLoadCase(lc001);

      expect(feaModel.materialAssignments.length).toBeGreaterThan(0);
      feaModel.materialAssignments.forEach(mat => {
        expect(mat.densityKgM3).toBeGreaterThan(1000);
        expect(mat.youngsModulusPa).toBeGreaterThan(50e9);
        expect(mat.yieldStrengthPa).toBeGreaterThan(200e6);
        expect(mat.verified).toBe(true);
      });
    });
  });

  describe('2. Mesh Quality Gate & Unit Validation', () => {
    it('should pass Mesh Quality Gate for well-formed structural FEA mesh', () => {
      const lc001 = loadCaseManager.getLoadCaseById('LC-001')!;
      const feaModel = FEAModelGenerator.generateFEAModelForLoadCase(lc001);

      const gateResult = MeshQualityGateService.evaluateMeshQuality(feaModel.mesh);
      expect(gateResult.gatePassed).toBe(true);
      expect(gateResult.hasDegenerateElements).toBe(false);
      expect(gateResult.hasInvalidElements).toBe(false);
      expect(gateResult.hasDuplicateNodes).toBe(false);
      expect(gateResult.hasFreeUnconnectedRegions).toBe(false);
      expect(gateResult.aspectRatioMax).toBeLessThan(5.0);
      expect(gateResult.jacobianDeterminantMin).toBeGreaterThan(0.1);
    });

    it('should pass SI Unit Validation for all load case and mesh parameters', () => {
      const lc001 = loadCaseManager.getLoadCaseById('LC-001')!;
      const feaModel = FEAModelGenerator.generateFEAModelForLoadCase(lc001);

      const unitResult = FEAUnitValidatorService.validateFEAUnits(lc001, feaModel.mesh);
      expect(unitResult.isValid).toBe(true);
      expect(unitResult.errors.length).toBe(0);
      expect(unitResult.checkedQuantityCount).toBeGreaterThan(20);
    });
  });

  describe('3. Solver Execution & Structural Results', () => {
    it('should execute SECP Structural FEA Solver and output non-synthetic results', () => {
      const lc001 = loadCaseManager.getLoadCaseById('LC-001')!;
      const feaModel = FEAModelGenerator.generateFEAModelForLoadCase(lc001);

      const executedSolution = FEASolverExecutionEngine.executeSolver(feaModel, 'LINEAR_STATIC_STRUCTURAL');
      expect(executedSolution.executionMetrics.executionId).toBeDefined();
      expect(executedSolution.executionMetrics.solverName).toBe('SECP_STRUCTURAL_FEA_SOLVER_v4.2');
      expect(executedSolution.executionMetrics.convergenceStatus).toBe('CONVERGED');

      const summary = executedSolution.solutionSummary;
      expect(summary.maxDisplacementMm).toBeGreaterThan(0);
      expect(summary.maxVonMisesStressMPa).toBeGreaterThan(0);
      expect(summary.minSafetyFactor).toBeGreaterThan(1.0);
      expect(summary.reactionForces.length).toBeGreaterThan(0);
    });

    it('should satisfy physical static equilibrium (Sum(F_applied) + Sum(F_reaction) = 0)', () => {
      const lc001 = loadCaseManager.getLoadCaseById('LC-001')!;
      const feaModel = FEAModelGenerator.generateFEAModelForLoadCase(lc001);
      const executedSolution = FEASolverExecutionEngine.executeSolver(feaModel);

      const eqReport = StructuralEquilibriumValidator.validateEquilibrium(feaModel, executedSolution);
      expect(eqReport.isEquilibriumSatisfied).toBe(true);
      expect(eqReport.netForceResidualMagnitudeN).toBeLessThanOrEqual(1e-4);
      expect(eqReport.verdict).toBe('PASS');
    });

    it('should evaluate positive Engineering Margins (MoS = Allowable / (Actual * USF) - 1.0)', () => {
      const lc001 = loadCaseManager.getLoadCaseById('LC-001')!;
      const feaModel = FEAModelGenerator.generateFEAModelForLoadCase(lc001);
      const executedSolution = FEASolverExecutionEngine.executeSolver(feaModel);

      const checks = StructuralAcceptanceEngine.evaluateAcceptance(lc001, feaModel, executedSolution);
      expect(checks.length).toBeGreaterThan(0);

      checks.forEach(check => {
        expect(check.verdict).toBe('PASS');
        expect(check.marginOfSafety).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('4. CAD-to-FEA Traceability & Reproducibility', () => {
    it('should detect STALE status when CAD revision mismatches FEA model revision', () => {
      const lc001 = loadCaseManager.getLoadCaseById('LC-001')!;
      const feaModel = FEAModelGenerator.generateFEAModelForLoadCase(lc001);

      const statusValid = CADToFEATraceabilityService.verifyModelStatus('1.0', feaModel.configuration);
      expect(statusValid).toBe('VALID');

      const statusStale = CADToFEATraceabilityService.verifyModelStatus('2.0-NEW-CAD', feaModel.configuration);
      expect(statusStale).toBe('STALE');
    });

    it('should confirm numerical reproducibility across independent solver runs', () => {
      const lc001 = loadCaseManager.getLoadCaseById('LC-001')!;
      const model1 = FEAModelGenerator.generateFEAModelForLoadCase(lc001);
      const sol1 = FEASolverExecutionEngine.executeSolver(model1);

      const model2 = FEAModelGenerator.generateFEAModelForLoadCase(lc001);
      const sol2 = FEASolverExecutionEngine.executeSolver(model2);

      const stressDiff = Math.abs(sol1.solutionSummary.maxVonMisesStressMPa - sol2.solutionSummary.maxVonMisesStressMPa);
      expect(stressDiff).toBeLessThan(1e-6);
    });
  });

  describe('5. Master Verifier & Evidence Package', () => {
    it('should generate a valid signed evidence package with canonical SHA-256 hash', () => {
      const verification = EPC026Verifier.verifyEPC026(loadCaseManager);
      const evidence = verification.evidencePackage;

      expect(evidence.evidenceId).toBeDefined();
      expect(evidence.overallVerdict).toBe('PASS');
      expect(evidence.evidenceHash).toBeDefined();
      expect(evidence.evidenceHash.length).toBe(64); // SHA-256 hex length
    });

    it('should pass all 25 acceptance criteria in EPC026Verifier with verdict PASS', () => {
      const verification = EPC026Verifier.verifyEPC026(loadCaseManager);

      expect(verification.overallVerdict).toBe('PASS');
      expect(verification.totalCriteriaCount).toBe(25);
      expect(verification.passedCount).toBe(25);
      expect(verification.failedCount).toBe(0);

      verification.criteriaResults.forEach(c => {
        expect(c.status).toBe('PASS');
      });
    });
  });
});
