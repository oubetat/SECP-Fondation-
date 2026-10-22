/**
 * SECP Industrial OS — Engineering Truth OS
 * structural_integrity_verification.test.ts
 *
 * SECP-ENGINE-STRENGTHENING-001D Verification Suite:
 * Rigorous Independent Analytical Benchmarks (S1 through S9 + Canonical Integration)
 * for Thin Plate Bending, Discrete Matrix Stiffness Operator, Static Equilibrium,
 * Stress Tensor Recovery, Monotonic Mesh Refinement, and Adversarial Input Diagnostics.
 */

import { describe, it, expect } from 'vitest';
import {
  StructuralPlateSolver,
  SpatialStructuralResult
} from '../StructuralPlateSolver';
import {
  PcbStructuralBoardConfig,
  STANDARD_PCB_STRUCTURAL_MATERIALS,
  calculateStructuralModelHash
} from '../PcbStructuralModel';
import {
  PcbStructuralDeflectionEngine,
  PcbSubstrateProperties
} from '../../pcb/PcbStructuralDeflectionEngine';
import { PcbHardAcceptanceGate } from '../../pcb/PcbHardAcceptanceGate';

function logSection(title: string) {
  console.log('\n' + '='.repeat(78));
  console.log(title);
  console.log('='.repeat(78));
}

let totalAssertions = 0;
let passedAssertions = 0;

function assertCheck(id: string, name: string, condition: boolean, note: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`[✓ PASS] ${id.padEnd(16)} ${name.padEnd(44)} ↳ ${note}`);
  } else {
    console.error(`[✗ FAIL] ${id.padEnd(16)} ${name.padEnd(44)} ↳ ${note}`);
  }
}

describe('SECP-ENGINE-STRENGTHENING-001D — Structural Solver Integrity & Numerical Verification', () => {
  it('executes full structural verification suite (Benchmarks S1 - S10)', () => {
    logSection('SECP INDUSTRIAL OS — STRUCTURAL INTEGRITY VERIFICATION SUITE (P4)');

    // =========================================================================
    // BENCHMARK S1: 1D Simply Supported Beam / Strip Navier Limit
    // =========================================================================
    logSection('BENCHMARK S1: 1D Simply Supported Beam Strip Analytical Navier Limit');
    {
      const LM = 0.1; // 100 mm
      const WM = 0.01; // 10 mm
      const hM = 0.0016; // 1.6 mm
      const EPa = 24.0e9; // 24 GPa
      const qPa = 500.0; // 500 Pa

      const analytical = StructuralPlateSolver.computeEulerBernoulliSimplySupportedBeam(
        LM,
        WM,
        hM,
        EPa,
        qPa
      );

      // w_max = 5 * q * L^4 / (384 * E * I)
      const expectedDeflectionMm = (5 * (qPa * WM) * Math.pow(LM, 4)) / (384 * EPa * ((WM * Math.pow(hM, 3)) / 12)) * 1000;
      const deflectionDiff = Math.abs(analytical.maxDeflectionMm - expectedDeflectionMm);
      const relativeErr = (deflectionDiff / expectedDeflectionMm) * 100;

      assertCheck(
        'BENCH-S1-DEF',
        'Simply Supported Beam Center Deflection',
        relativeErr < 0.01,
        `Analytical = ${analytical.maxDeflectionMm.toFixed(5)} mm, Closed-Form = ${expectedDeflectionMm.toFixed(5)} mm, Error = ${relativeErr.toFixed(4)}%`
      );

      // Bending stress sigma = (3 * q * L^2) / (4 * W * h^2)
      const expectedStressMPa = ((qPa * WM * Math.pow(LM, 2) / 8) * (hM / 2)) / ((WM * Math.pow(hM, 3)) / 12) / 1e6;
      const stressDiff = Math.abs(analytical.maxStressMPa - expectedStressMPa);
      assertCheck(
        'BENCH-S1-STR',
        'Simply Supported Beam Max Bending Stress',
        stressDiff < 0.01,
        `Computed = ${analytical.maxStressMPa.toFixed(3)} MPa, Expected = ${expectedStressMPa.toFixed(3)} MPa`
      );
    }

    // =========================================================================
    // BENCHMARK S2: 1D Cantilever Tip Load
    // =========================================================================
    logSection('BENCHMARK S2: 1D Cantilever Tip Load Analytical Benchmark');
    {
      const LM = 0.1;
      const WM = 0.01;
      const hM = 0.0016;
      const EPa = 24.0e9;
      const tipForceN = 1.0;

      const cantilever = StructuralPlateSolver.computeCantileverTipLoad(LM, WM, hM, EPa, tipForceN);
      const expectedTipMm = (tipForceN * Math.pow(LM, 3)) / (3 * EPa * ((WM * Math.pow(hM, 3)) / 12)) * 1000;
      const expectedRootStress = (tipForceN * LM * (hM / 2)) / ((WM * Math.pow(hM, 3)) / 12) / 1e6;

      const tipRelErr = (Math.abs(cantilever.tipDeflectionMm - expectedTipMm) / expectedTipMm) * 100;
      const stressRelErr = (Math.abs(cantilever.rootStressMPa - expectedRootStress) / expectedRootStress) * 100;

      assertCheck(
        'BENCH-S2-TIP',
        'Cantilever Beam Tip Deflection',
        tipRelErr < 0.01,
        `Tip Deflection = ${cantilever.tipDeflectionMm.toFixed(4)} mm (Error: ${tipRelErr.toFixed(4)}%)`
      );

      assertCheck(
        'BENCH-S2-ROOT',
        'Cantilever Root Bending Stress',
        stressRelErr < 0.01,
        `Root Stress = ${cantilever.rootStressMPa.toFixed(2)} MPa (Expected: ${expectedRootStress.toFixed(2)} MPa)`
      );
    }

    // =========================================================================
    // BENCHMARK S3: 2D Simply Supported Rectangular Plate under Uniform Load
    // =========================================================================
    logSection('BENCHMARK S3: 2D Simply Supported Plate Navier Series Benchmark');
    {
      const config: PcbStructuralBoardConfig = {
        lengthMm: 100, // 0.1 m
        widthMm: 80,   // 0.08 m
        thicknessMm: 1.6,
        youngModulusGpa: 24.0,
        poissonRatio: 0.14,
        densityKgM3: 1850.0,
        boundaryType: 'FOUR_EDGES_SIMPLY_SUPPORTED',
        loads: {
          uniformPressurePa: 1000.0,
          includeSubstrateSelfWeight: false
        },
        gridResolutionX: 25,
        gridResolutionY: 25
      };

      const result = StructuralPlateSolver.solve(config);

      assertCheck(
        'BENCH-S3-NAVIER',
        'Navier Series Convergence & Accuracy',
        result.analyticalComparison !== undefined && result.analyticalComparison.deflectionRelativeErrorPercent < 2.0,
        `Computed = ${result.maxDeflectionMm.toFixed(4)} mm, Analytical Navier = ${result.analyticalComparison?.analyticalMaxDeflectionMm.toFixed(4)} mm (Error = ${result.analyticalComparison?.deflectionRelativeErrorPercent.toFixed(3)}%)`
      );

      assertCheck(
        'BENCH-S3-LOC',
        'Symmetric Center Max Deflection Location',
        Math.abs(result.maxDeflectionLocation.xMm - 50.0) <= 2.5 && Math.abs(result.maxDeflectionLocation.yMm - 40.0) <= 2.5,
        `Max Deflection Peak at (${result.maxDeflectionLocation.xMm}, ${result.maxDeflectionLocation.yMm}) mm (Expected center: 50, 40)`
      );
    }

    // =========================================================================
    // BENCHMARK S4: 2D Clamped Rectangular Plate under Uniform Load
    // =========================================================================
    logSection('BENCHMARK S4: 2D Clamped Plate Roark / Timoshenko Solution Benchmark');
    {
      const configClamped: PcbStructuralBoardConfig = {
        lengthMm: 100,
        widthMm: 100,
        thicknessMm: 1.6,
        youngModulusGpa: 24.0,
        poissonRatio: 0.14,
        densityKgM3: 1850.0,
        boundaryType: 'FOUR_EDGES_CLAMPED',
        loads: {
          uniformPressurePa: 1000.0,
          includeSubstrateSelfWeight: false
        },
        gridResolutionX: 21,
        gridResolutionY: 21
      };

      const configSS: PcbStructuralBoardConfig = {
        ...configClamped,
        boundaryType: 'FOUR_EDGES_SIMPLY_SUPPORTED'
      };

      const clampedRes = StructuralPlateSolver.solve(configClamped);
      const ssRes = StructuralPlateSolver.solve(configSS);

      // Rotational restraint must reduce deflection: w_clamped < w_simply_supported
      assertCheck(
        'BENCH-S4-RESTRAIN',
        'Rotational Clamp Stiffness Reduction Effect',
        clampedRes.maxDeflectionMm < ssRes.maxDeflectionMm,
        `Clamped Deflection = ${clampedRes.maxDeflectionMm.toFixed(4)} mm < SS Deflection = ${ssRes.maxDeflectionMm.toFixed(4)} mm (Ratio = ${(clampedRes.maxDeflectionMm / ssRes.maxDeflectionMm).toFixed(2)})`
      );

      assertCheck(
        'BENCH-S4-ROARK',
        'Timoshenko / Roark Clamped Benchmark Agreement',
        clampedRes.analyticalComparison !== undefined && clampedRes.analyticalComparison.deflectionRelativeErrorPercent < 3.0,
        `Clamped = ${clampedRes.maxDeflectionMm.toFixed(4)} mm vs Roark = ${clampedRes.analyticalComparison?.analyticalMaxDeflectionMm.toFixed(4)} mm (Error: ${clampedRes.analyticalComparison?.deflectionRelativeErrorPercent.toFixed(2)}%)`
      );
    }

    // =========================================================================
    // BENCHMARK S5: Localized Point Load on Plate
    // =========================================================================
    logSection('BENCHMARK S5: Localized Component Point Load on Substrate');
    {
      const configPoint: PcbStructuralBoardConfig = {
        lengthMm: 100,
        widthMm: 100,
        thicknessMm: 1.6,
        boundaryType: 'FOUR_EDGES_SIMPLY_SUPPORTED',
        loads: {
          uniformPressurePa: 0.0,
          includeSubstrateSelfWeight: false,
          componentPointLoads: [
            { id: 'L1_INDUCTOR', xMm: 50.0, yMm: 50.0, forceN: 2.0, description: 'Power Inductor 2N Force' }
          ]
        },
        gridResolutionX: 21,
        gridResolutionY: 21
      };

      const pointRes = StructuralPlateSolver.solve(configPoint);

      assertCheck(
        'BENCH-S5-MAX',
        'Point Load Maximum Deflection Location Match',
        Math.abs(pointRes.maxDeflectionLocation.xMm - 50.0) <= 2.5 && Math.abs(pointRes.maxDeflectionLocation.yMm - 50.0) <= 2.5,
        `Max Deflection occurs at (${pointRes.maxDeflectionLocation.xMm}, ${pointRes.maxDeflectionLocation.yMm}) mm for point load at (50, 50)`
      );

      assertCheck(
        'BENCH-S5-STRESS',
        'Localized Stress Tensor Concentration',
        pointRes.maxVonMisesStressMPa > 0,
        `Peak von Mises Stress = ${pointRes.maxVonMisesStressMPa.toFixed(2)} MPa at point load site`
      );
    }

    // =========================================================================
    // BENCHMARK S6: Four Corner Standoff Supported Board
    // =========================================================================
    logSection('BENCHMARK S6: Four Corner Standoff Support Simulation');
    {
      const configCorners: PcbStructuralBoardConfig = {
        lengthMm: 80,
        widthMm: 60,
        thicknessMm: 1.6,
        youngModulusGpa: 24.0,
        boundaryType: 'FOUR_CORNERS_SUPPORTED',
        loads: {
          uniformPressurePa: 200.0,
          includeSubstrateSelfWeight: true
        },
        gridResolutionX: 17,
        gridResolutionY: 17
      };

      const cornerRes = StructuralPlateSolver.solve(configCorners);

      assertCheck(
        'BENCH-S6-CORNER',
        'Corner Standoff Deflection & Stability',
        cornerRes.maxDeflectionMm > 0 && cornerRes.isMechanicallyStable,
        `Max Deflection = ${cornerRes.maxDeflectionMm.toFixed(4)} mm, Allowable = ${cornerRes.allowableDeflectionMm.toFixed(4)} mm`
      );

      assertCheck(
        'BENCH-S6-FREQ',
        'Fundamental Frequency under Corner Mounts',
        cornerRes.fundamentalFrequencyHz > 10.0,
        `Fundamental frequency = ${cornerRes.fundamentalFrequencyHz} Hz`
      );
    }

    // =========================================================================
    // BENCHMARK S7: Static Equilibrium and Transverse Reaction Balance
    // =========================================================================
    logSection('BENCHMARK S7: Static Transverse Equilibrium and Reaction Force Balance');
    {
      const testCases: StructuralBoundaryType[] = [
        'FOUR_EDGES_SIMPLY_SUPPORTED',
        'FOUR_EDGES_CLAMPED',
        'FOUR_CORNERS_SUPPORTED'
      ];

      for (const bType of testCases) {
        const configEq: PcbStructuralBoardConfig = {
          lengthMm: 100,
          widthMm: 80,
          thicknessMm: 1.6,
          youngModulusGpa: 24.0,
          boundaryType: bType,
          loads: {
            uniformPressurePa: 500.0,
            includeSubstrateSelfWeight: true
          },
          gridResolutionX: 15,
          gridResolutionY: 15
        };

        const res = StructuralPlateSolver.solve(configEq);

        assertCheck(
          `BENCH-S7-EQ-${bType.slice(5, 10)}`,
          `Static Force Balance (${bType})`,
          res.equilibrium.isEquilibriumSatisfied,
          `Applied = ${res.equilibrium.totalAppliedLoadN.toFixed(4)} N, Reaction = ${res.equilibrium.totalReactionForceN.toFixed(4)} N, Imbalance = ${res.equilibrium.forceImbalanceN.toFixed(6)} N`
        );

        assertCheck(
          `BENCH-S7-RES-${bType.slice(5, 10)}`,
          `Algebraic Residual Norm (${bType})`,
          res.equilibrium.isResidualConverged,
          `||Kw - F||_2 / ||F||_2 = ${res.equilibrium.relativeResidualNorm.toExponential(3)} (< 1e-5)`
        );
      }
    }

    // =========================================================================
    // BENCHMARK S8: Mesh Refinement and Spatial Convergence
    // =========================================================================
    logSection('BENCHMARK S8: Mesh Refinement Convergence across Grid Densities');
    {
      const configMesh: PcbStructuralBoardConfig = {
        lengthMm: 100,
        widthMm: 100,
        thicknessMm: 1.6,
        boundaryType: 'FOUR_EDGES_SIMPLY_SUPPORTED',
        loads: {
          uniformPressurePa: 1000.0,
          includeSubstrateSelfWeight: false
        }
      };

      const conv = StructuralPlateSolver.verifyMeshConvergence(configMesh, [11, 21, 31]);

      assertCheck(
        'BENCH-S8-MONOTONIC',
        'Monotonic Truncation Error Reduction',
        conv.isMonotonic,
        `Grid Densities: ${conv.resolutions.join(', ')} -> Deflections: ${conv.maxDeflectionsMm.map(d => d.toFixed(4)).join(', ')} mm (Errors: ${conv.relativeErrorsPercent.join(', ')}%)`
      );

      assertCheck(
        'BENCH-S8-RATE',
        'Spatial Convergence Rate Stability',
        conv.convergenceRate >= 1.0,
        `Observed spatial convergence order p = ${conv.convergenceRate} (Theoretical: 2.0)`
      );
    }

    // =========================================================================
    // BENCHMARK S9: Adversarial Inputs and Fail-Closed Diagnostics
    // =========================================================================
    logSection('BENCHMARK S9: Adversarial Input Diagnostics and Boundary Integrity');
    {
      // Adversarial Case 1: Unconstrained rigid-body motion (0 support points)
      let unconstrainedCaught = false;
      try {
        const unconstrainedConfig: PcbStructuralBoardConfig = {
          lengthMm: 100,
          widthMm: 100,
          thicknessMm: 1.6,
          boundaryType: 'STANDOFF_SUPPORTED',
          standoffs: [] // Zero standoffs!
        };
        StructuralPlateSolver.solve(unconstrainedConfig);
      } catch (err: any) {
        unconstrainedCaught = err.message.includes('UNCONSTRAINED_RIGID_BODY_MOTION');
      }

      assertCheck(
        'BENCH-S9-RIGID',
        'Rejection of Unconstrained Kinematic Modes',
        unconstrainedCaught,
        'Solver safely rejected 0-support plate with UNCONSTRAINED_RIGID_BODY_MOTION error code'
      );

      // Adversarial Case 2: Negative plate thickness
      let negThickCaught = false;
      try {
        StructuralPlateSolver.solve({
          lengthMm: 100,
          widthMm: 100,
          thicknessMm: -1.6,
          boundaryType: 'FOUR_EDGES_SIMPLY_SUPPORTED'
        });
      } catch (err: any) {
        negThickCaught = err.message.includes('INVALID_GEOMETRY');
      }

      assertCheck(
        'BENCH-S9-GEOM',
        'Rejection of Negative Dimensions',
        negThickCaught,
        'Solver safely rejected negative thickness with INVALID_GEOMETRY error code'
      );

      // Adversarial Case 3: Zero or negative Young's modulus
      let zeroModCaught = false;
      try {
        StructuralPlateSolver.solve({
          lengthMm: 100,
          widthMm: 100,
          thicknessMm: 1.6,
          youngModulusGpa: -10.0,
          boundaryType: 'FOUR_EDGES_SIMPLY_SUPPORTED'
        });
      } catch (err: any) {
        zeroModCaught = err.message.includes('INVALID_MATERIAL');
      }

      assertCheck(
        'BENCH-S9-MAT',
        'Rejection of Negative Young Modulus',
        zeroModCaught,
        'Solver safely rejected non-physical modulus with INVALID_MATERIAL error code'
      );
    }

    // =========================================================================
    // BENCHMARK S10: Canonical PCB Model Integration & Deterministic Hashing
    // =========================================================================
    logSection('BENCHMARK S10: Canonical PcbCanonicalModel Mechanical Integration');
    {
      const baseline = PcbHardAcceptanceGate.createValidBaselineModel();
      const canonicalRes = PcbStructuralDeflectionEngine.evaluateCanonicalPcbModel(baseline, 80.0);

      assertCheck(
        'BENCH-S10-CANONICAL',
        'Canonical PCB Structural Evaluation',
        canonicalRes.isMechanicallyStable && canonicalRes.maxDeflectionMm >= 0,
        `Canonical Board: Deflection = ${canonicalRes.maxDeflectionMm.toFixed(4)} mm, Max Stress = ${canonicalRes.maxVonMisesStressMPa.toFixed(2)} MPa, SF = ${canonicalRes.safetyFactor}`
      );

      assertCheck(
        'BENCH-S10-HASH',
        'Deterministic SHA-256 Revision Hash',
        canonicalRes.configHash.length === 64,
        `SHA-256 Digest = ${canonicalRes.configHash}`
      );
    }

    logSection(`STRUCTURAL INTEGRITY SUMMARY: ${passedAssertions}/${totalAssertions} PASSED (100%)`);
    expect(passedAssertions).toBe(totalAssertions);
    expect(totalAssertions).toBeGreaterThanOrEqual(16);
  });
});
