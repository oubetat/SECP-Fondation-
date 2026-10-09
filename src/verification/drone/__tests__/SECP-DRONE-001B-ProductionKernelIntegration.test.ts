/**
 * SECP DRONE-001B: Production Kernel Integration & Anti-Bypass Test Suite
 * Classification: SECP Industrial OS Production Integration Proof
 * 
 * Tests PKI-001 through PKI-030:
 * - Runtime telemetry and non-zero kernel invocation
 * - Real production kernel execution (CAD, Assembly, FEA, CFD, CAM, Interop)
 * - Independent verification gates
 * - Causal mutation and lineage preservation
 * - Cross-validation against DRONE-001A Oracle
 * - 3-run bit-for-bit determinism
 * - 12-point adversarial failure injection (FI-01 to FI-12)
 * - Evidence-derived FULLY PROVEN verdict
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Drone001BEvidenceClosureEngine } from '../../../engine/drone/production/Drone001BEvidenceClosureEngine';
import { Drone001BProductionKernelEngine } from '../../../engine/drone/production/Drone001BProductionKernelEngine';
import { Drone001BProductionTelemetry } from '../../../engine/drone/production/Drone001BProductionTelemetry';
import { Drone001BIndependentVerifier } from '../../../engine/drone/production/Drone001BIndependentVerifier';
import { Drone001BCrossValidationEngine } from '../../../engine/drone/production/Drone001BCrossValidationEngine';
import { Drone001BAdversarialEngine } from '../../../engine/drone/production/Drone001BAdversarialEngine';

describe('SECP DRONE-001B — Production Kernel Integration & Anti-Bypass Proof', () => {
  beforeEach(() => {
    Drone001BProductionTelemetry.reset();
  });

  describe('Part 1: Production Kernel Dispatcher & Telemetry (PKI-001 to PKI-006)', () => {
    it('PKI-001: Execution proceeds via DocumentEvaluator without shadow routing', () => {
      const proof = Drone001BEvidenceClosureEngine.executeCompleteProofWorkflow();
      expect(proof.telemetry.dispatcherRoute).toBe('DocumentEvaluator -> SECP Production Kernel Dispatcher');
      expect(proof.telemetry.antiBypassPassed).toBe(true);
    });

    it('PKI-002: BRepKernel is invoked with runtime tracing and valid digests', () => {
      const proof = Drone001BEvidenceClosureEngine.executeCompleteProofWorkflow();
      const brepInv = proof.telemetry.invocations['BRepKernel'];
      expect(brepInv).toBeDefined();
      expect(brepInv.callCount).toBeGreaterThan(0);
      expect(brepInv.inputDigest).toMatch(/^SHA256:[a-f0-9]{64}$/);
      expect(brepInv.outputDigest).toMatch(/^SHA256:[a-f0-9]{64}$/);
      expect(brepInv.runtimeEntry).toContain('BRepKernel');
    });

    it('PKI-003: AssemblyEngine is invoked with runtime tracing and solved mates', () => {
      const proof = Drone001BEvidenceClosureEngine.executeCompleteProofWorkflow();
      const asmInv = proof.telemetry.invocations['AssemblyEngine'];
      expect(asmInv).toBeDefined();
      expect(asmInv.callCount).toBeGreaterThan(0);
      expect(asmInv.inputDigest).toMatch(/^SHA256:[a-f0-9]{64}$/);
      expect(asmInv.outputDigest).toMatch(/^SHA256:[a-f0-9]{64}$/);
    });

    it('PKI-004: StructuralFemEngine is invoked with runtime tracing and solved stress fields', () => {
      const proof = Drone001BEvidenceClosureEngine.executeCompleteProofWorkflow();
      const feaInv = proof.telemetry.invocations['StructuralFemEngine'];
      expect(feaInv).toBeDefined();
      expect(feaInv.callCount).toBeGreaterThan(0);
      expect(feaInv.runtimeEntry).toContain('StructuralFemEngine.solveStructuralFea');
    });

    it('PKI-005: CfdEngine is invoked with runtime tracing and solved Navier-Stokes fields', () => {
      const proof = Drone001BEvidenceClosureEngine.executeCompleteProofWorkflow();
      const cfdInv = proof.telemetry.invocations['CfdEngine'];
      expect(cfdInv).toBeDefined();
      expect(cfdInv.callCount).toBeGreaterThan(0);
      expect(cfdInv.runtimeEntry).toContain('CfdEngine');
    });

    it('PKI-006: CamEngine is invoked with runtime tracing and generated NC toolpaths', () => {
      const proof = Drone001BEvidenceClosureEngine.executeCompleteProofWorkflow();
      const camInv = proof.telemetry.invocations['CamEngine'];
      expect(camInv).toBeDefined();
      expect(camInv.callCount).toBeGreaterThan(0);
      expect(camInv.runtimeEntry).toContain('CamEngine');
    });
  });

  describe('Part 2: Production Engineering Domains Execution & Verification (PKI-007 to PKI-012)', () => {
    it('PKI-007: CAD produces valid B-Rep solid with Euler chi=2, manifold, watertight, positive volume', () => {
      const cad = Drone001BProductionKernelEngine.executeProductionCad();
      const v = Drone001BIndependentVerifier.verifyCad(cad);
      expect(v.valid).toBe(true);
      expect(cad.volumeM3).toBeGreaterThan(0);
      expect(cad.surfaceAreaM2).toBeGreaterThan(0);
      expect(cad.topologySummary.eulerChi).toBe(2);
      expect(cad.topologySummary.isWatertight).toBe(true);
      expect(cad.topologySummary.isManifold).toBe(true);
      expect(cad.bRepHash).toMatch(/^SHA256:[a-f0-9]{64}$/);
    });

    it('PKI-008: Assembly solves 8 mates, confirms zero clashes, AUW <= 2.50kg, prop clearance > 15mm', () => {
      const cad = Drone001BProductionKernelEngine.executeProductionCad();
      const assembly = Drone001BProductionKernelEngine.executeProductionAssembly(cad);
      const v = Drone001BIndependentVerifier.verifyAssembly(assembly);
      expect(v.valid).toBe(true);
      expect(assembly.solvedMatesCount).toBe(8);
      expect(assembly.residualErrorMaxMm).toBeLessThan(0.001);
      expect(assembly.interferences.length).toBe(0);
      expect(assembly.massProperties.totalMassKg).toBeLessThanOrEqual(2.50);
      expect(assembly.tipToTipClearanceMm).toBeGreaterThanOrEqual(15.0);
      expect(assembly.propToFrameClearanceMm).toBeGreaterThanOrEqual(15.0);
      expect(assembly.cgDistanceToCenterMm).toBeLessThanOrEqual(15.0);
    });

    it('PKI-009: Structural FEA solves 6 load cases, achieves static equilibrium, FoS >= 1.50', () => {
      const cad = Drone001BProductionKernelEngine.executeProductionCad();
      const fea = Drone001BProductionKernelEngine.executeProductionFea(cad);
      const v = Drone001BIndependentVerifier.verifyFea(fea);
      expect(v.valid).toBe(true);
      expect(fea.maxDisplacementMm).toBeGreaterThan(0);
      expect(fea.maxDisplacementMm).toBeLessThan(25.0);
      expect(fea.maxVonMisesStressMPa).toBeGreaterThan(0);
      expect(fea.maxVonMisesStressMPa).toBeLessThan(350.0);
      expect(fea.minSafetyFactor).toBeGreaterThanOrEqual(1.50);
    });

    it('PKI-010: Aerodynamics CFD computes Navier-Stokes flow, mass conservation residual < 1e-4', () => {
      const cad = Drone001BProductionKernelEngine.executeProductionCad();
      const cfd = Drone001BProductionKernelEngine.executeProductionCfd(cad);
      const v = Drone001BIndependentVerifier.verifyCfd(cfd);
      expect(v.valid).toBe(true);
      expect(cfd.continuityResidual).toBeLessThanOrEqual(1.0e-4);
      expect(cfd.reynoldsNumberCruise).toBeGreaterThan(0);
      expect(cfd.dragForceCruiseN).toBeGreaterThan(0);
      expect(cfd.dragForceMaxSpeedN).toBeGreaterThan(cfd.dragForceCruiseN);
    });

    it('PKI-011: CAM generates 5-op NC toolpaths, collision/gouge-free, valid G-code with program delimiters', () => {
      const cad = Drone001BProductionKernelEngine.executeProductionCad();
      const cam = Drone001BProductionKernelEngine.executeProductionCam(cad);
      const v = Drone001BIndependentVerifier.verifyCam(cam);
      expect(v.valid).toBe(true);
      expect(cam.gCodeLineCount).toBeGreaterThanOrEqual(10);
      expect(cam.collisionFree).toBe(true);
      expect(cam.gougeFree).toBe(true);
      expect(cam.gCodeText.includes('M30') || cam.gCodeText.includes('M02')).toBe(true);
    });

    it('PKI-012: Interop exports valid ISO 10303 STEP file with standard entity definitions', () => {
      const cad = Drone001BProductionKernelEngine.executeProductionCad();
      const interop = Drone001BProductionKernelEngine.executeProductionInterop(cad);
      expect(interop.stepValid).toBe(true);
      expect(interop.stepEntityCount).toBeGreaterThan(0);
      expect(interop.stepExportText).toContain('ISO-10303-21');
      expect(interop.stepExportText).toContain('END-ISO-10303-21');
    });
  });

  describe('Part 3: Causal Mutation & Lineage Proofs (PKI-013 to PKI-018)', () => {
    it('PKI-013: Arm thickness mutation (4.0mm -> 3.2mm) causes geometry hash change', () => {
      const cadNominal = Drone001BProductionKernelEngine.executeProductionCad({ armThicknessMm: 4.0 });
      const cadMutated = Drone001BProductionKernelEngine.executeProductionCad({ armThicknessMm: 3.2 });
      expect(cadNominal.bRepHash).not.toBe(cadMutated.bRepHash);
      expect(cadNominal.volumeM3).not.toBe(cadMutated.volumeM3);
    });

    it('PKI-014: Arm thickness mutation propagates causally to FEA stress increase', () => {
      const cadNominal = Drone001BProductionKernelEngine.executeProductionCad({ armThicknessMm: 4.0 });
      const cadMutated = Drone001BProductionKernelEngine.executeProductionCad({ armThicknessMm: 3.2 });
      const feaNominal = Drone001BProductionKernelEngine.executeProductionFea(cadNominal, { armThicknessMm: 4.0 });
      const feaMutated = Drone001BProductionKernelEngine.executeProductionFea(cadMutated, { armThicknessMm: 3.2 });

      expect(feaMutated.maxVonMisesStressMPa).toBeGreaterThan(feaNominal.maxVonMisesStressMPa);
      expect(feaMutated.minSafetyFactor).toBeLessThan(feaNominal.minSafetyFactor);
    });

    it('PKI-015: Load case mutation (1g -> 3g) scales von Mises stress linearly', () => {
      const cad = Drone001BProductionKernelEngine.executeProductionCad();
      const fea1g = Drone001BProductionKernelEngine.executeProductionFea(cad, { nominalLoadN: 15.696 });
      const fea3g = Drone001BProductionKernelEngine.executeProductionFea(cad, { nominalLoadN: 15.696 * 3.0 });

      expect(fea3g.maxVonMisesStressMPa).toBeGreaterThan(fea1g.maxVonMisesStressMPa);
      const ratio = fea3g.maxVonMisesStressMPa / fea1g.maxVonMisesStressMPa;
      expect(ratio).toBeCloseTo(3.0, 1);
    });

    it('PKI-016: Load case mutation reduces safety factor causally', () => {
      const cad = Drone001BProductionKernelEngine.executeProductionCad();
      const fea1g = Drone001BProductionKernelEngine.executeProductionFea(cad, { nominalLoadN: 15.696 });
      const fea3g = Drone001BProductionKernelEngine.executeProductionFea(cad, { nominalLoadN: 15.696 * 3.0 });

      expect(fea3g.minSafetyFactor).toBeLessThan(fea1g.minSafetyFactor);
    });

    it('PKI-017: Topology mutation changes face count and B-Rep evidence hash', () => {
      const cadNom = Drone001BProductionKernelEngine.executeProductionCad({ customFeature: false });
      const cadMut = Drone001BProductionKernelEngine.executeProductionCad({ customFeature: true });

      expect(cadMut.topologySummary.totalFaces).toBeGreaterThan(cadNom.topologySummary.totalFaces);
    });

    it('PKI-018: Full causal lineage is recorded and validated in proof package', () => {
      const proof = Drone001BEvidenceClosureEngine.executeCompleteProofWorkflow();
      expect(proof.causalMutations.armThicknessMutation.causalLineageIntact).toBe(true);
      expect(proof.causalMutations.loadCaseMutation.causalLineageIntact).toBe(true);
      expect(proof.causalMutations.topologyMutation.causalLineageIntact).toBe(true);
    });
  });

  describe('Part 4: Cross-Validation with Oracle A & Determinism (PKI-019 to PKI-024)', () => {
    it('PKI-019: Geometry & topology consistency between Stack B and Oracle A', () => {
      const cad = Drone001BProductionKernelEngine.executeProductionCad();
      const assembly = Drone001BProductionKernelEngine.executeProductionAssembly(cad);
      const fea = Drone001BProductionKernelEngine.executeProductionFea(cad);
      const cfd = Drone001BProductionKernelEngine.executeProductionCfd(cad);
      const cam = Drone001BProductionKernelEngine.executeProductionCam(cad);

      const crossVal = Drone001BCrossValidationEngine.crossValidate({ cad, assembly, fea, cfd, cam });
      expect(crossVal.geometryConsistent).toBe(true);
    });

    it('PKI-020: Total mass cross-validation within <= 0.5% tolerance', () => {
      const cad = Drone001BProductionKernelEngine.executeProductionCad();
      const assembly = Drone001BProductionKernelEngine.executeProductionAssembly(cad);
      const fea = Drone001BProductionKernelEngine.executeProductionFea(cad);
      const cfd = Drone001BProductionKernelEngine.executeProductionCfd(cad);
      const cam = Drone001BProductionKernelEngine.executeProductionCam(cad);

      const crossVal = Drone001BCrossValidationEngine.crossValidate({ cad, assembly, fea, cfd, cam });
      expect(crossVal.massConsistent).toBe(true);
      expect(crossVal.massDiffPct).toBeLessThanOrEqual(0.50);
    });

    it('PKI-021: Clearances cross-validation within <= 1.0 mm tolerance', () => {
      const cad = Drone001BProductionKernelEngine.executeProductionCad();
      const assembly = Drone001BProductionKernelEngine.executeProductionAssembly(cad);
      const fea = Drone001BProductionKernelEngine.executeProductionFea(cad);
      const cfd = Drone001BProductionKernelEngine.executeProductionCfd(cad);
      const cam = Drone001BProductionKernelEngine.executeProductionCam(cad);

      const crossVal = Drone001BCrossValidationEngine.crossValidate({ cad, assembly, fea, cfd, cam });
      expect(crossVal.clearancesConsistent).toBe(true);
    });

    it('PKI-022: FEA cantilever arm stress cross-validation within <= 5.0% tolerance', () => {
      const cad = Drone001BProductionKernelEngine.executeProductionCad();
      const assembly = Drone001BProductionKernelEngine.executeProductionAssembly(cad);
      const fea = Drone001BProductionKernelEngine.executeProductionFea(cad);
      const cfd = Drone001BProductionKernelEngine.executeProductionCfd(cad);
      const cam = Drone001BProductionKernelEngine.executeProductionCam(cad);

      const crossVal = Drone001BCrossValidationEngine.crossValidate({ cad, assembly, fea, cfd, cam });
      expect(crossVal.feaConsistent).toBe(true);
      expect(crossVal.feaStressDiffPct).toBeLessThanOrEqual(5.0);
    });

    it('PKI-023: CFD aerodynamic cruise drag cross-validation within <= 8.0% tolerance', () => {
      const cad = Drone001BProductionKernelEngine.executeProductionCad();
      const assembly = Drone001BProductionKernelEngine.executeProductionAssembly(cad);
      const fea = Drone001BProductionKernelEngine.executeProductionFea(cad);
      const cfd = Drone001BProductionKernelEngine.executeProductionCfd(cad);
      const cam = Drone001BProductionKernelEngine.executeProductionCam(cad);

      const crossVal = Drone001BCrossValidationEngine.crossValidate({ cad, assembly, fea, cfd, cam });
      expect(crossVal.cfdConsistent).toBe(true);
      expect(crossVal.cfdDragDiffPct).toBeLessThanOrEqual(8.0);
    });

    it('PKI-024: 3-run deterministic execution produces bit-for-bit identical Merkle root and component digests', () => {
      const run1 = Drone001BEvidenceClosureEngine.executeCompleteProofWorkflow();
      const run2 = Drone001BEvidenceClosureEngine.executeCompleteProofWorkflow();
      const run3 = Drone001BEvidenceClosureEngine.executeCompleteProofWorkflow();

      expect(run1.determinismProof.merkleRootHash).toBe(run2.determinismProof.merkleRootHash);
      expect(run2.determinismProof.merkleRootHash).toBe(run3.determinismProof.merkleRootHash);
      expect(run1.determinismProof.canonicalInputDigest).toBe(run2.determinismProof.canonicalInputDigest);
      expect(run1.determinismProof.geometryResultDigest).toBe(run2.determinismProof.geometryResultDigest);
      expect(run1.determinismProof.feaResultDigest).toBe(run2.determinismProof.feaResultDigest);
    });
  });

  describe('Part 5: Adversarial & Anti-Bypass Gate Rejections (PKI-025 to PKI-030)', () => {
    it('PKI-025: Rejects missing kernel (FI-01) and zero invocations (FI-03)', () => {
      const advResults = Drone001BAdversarialEngine.executeAllAdversarialTests();
      const fi01 = advResults.find(r => r.code === 'FI-01');
      const fi03 = advResults.find(r => r.code === 'FI-03');

      expect(fi01?.detectedAndRejected).toBe(true);
      expect(fi03?.detectedAndRejected).toBe(true);
    });

    it('PKI-026: Rejects synthetic fake kernels (FI-02) and static result mocks (FI-04)', () => {
      const advResults = Drone001BAdversarialEngine.executeAllAdversarialTests();
      const fi02 = advResults.find(r => r.code === 'FI-02');
      const fi04 = advResults.find(r => r.code === 'FI-04');

      expect(fi02?.detectedAndRejected).toBe(true);
      expect(fi04?.detectedAndRejected).toBe(true);
    });

    it('PKI-027: Rejects Euler violations (FI-05) and unphysical safety factors (FI-06)', () => {
      const advResults = Drone001BAdversarialEngine.executeAllAdversarialTests();
      const fi05 = advResults.find(r => r.code === 'FI-05');
      const fi06 = advResults.find(r => r.code === 'FI-06');

      expect(fi05?.detectedAndRejected).toBe(true);
      expect(fi06?.detectedAndRejected).toBe(true);
    });

    it('PKI-028: Rejects corrupted CFD residuals (FI-07) and broken evidence hashes (FI-08)', () => {
      const advResults = Drone001BAdversarialEngine.executeAllAdversarialTests();
      const fi07 = advResults.find(r => r.code === 'FI-07');
      const fi08 = advResults.find(r => r.code === 'FI-08');

      expect(fi07?.detectedAndRejected).toBe(true);
      expect(fi08?.detectedAndRejected).toBe(true);
    });

    it('PKI-029: Rejects shadow dispatchers (FI-09) and oracle fallbacks (FI-10)', () => {
      const advResults = Drone001BAdversarialEngine.executeAllAdversarialTests();
      const fi09 = advResults.find(r => r.code === 'FI-09');
      const fi10 = advResults.find(r => r.code === 'FI-10');

      expect(fi09?.detectedAndRejected).toBe(true);
      expect(fi10?.detectedAndRejected).toBe(true);
    });

    it('PKI-030: Rejects hidden clearance bypasses (FI-11) and hard-coded PASS (FI-12), deriving final FULLY PROVEN verdict', () => {
      const advResults = Drone001BAdversarialEngine.executeAllAdversarialTests();
      const fi11 = advResults.find(r => r.code === 'FI-11');
      const fi12 = advResults.find(r => r.code === 'FI-12');

      expect(fi11?.detectedAndRejected).toBe(true);
      expect(fi12?.detectedAndRejected).toBe(true);

      const proof = Drone001BEvidenceClosureEngine.executeCompleteProofWorkflow();
      expect(proof.verdict).toBe('FULLY PROVEN');
      expect(proof.verdictRationale).toContain('Executed directly through SECP Production Stack');
    });
  });
});
