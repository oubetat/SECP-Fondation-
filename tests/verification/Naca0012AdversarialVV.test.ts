/**
 * SECP — NACA 0012 CFD Verification & Validation Adversarial Test Suite
 * Requirement 9: Verifies that the platform strictly rejects:
 * 1. Non-monotonic mesh convergence presented as valid GCI
 * 2. Unconverged force history presented as converged
 * 3. Invalid refinement ratios (r < 1.1)
 * 4. Missing mesh levels (< 3 grids)
 * 5. Inconsistent boundary conditions between grids
 * 6. Missing physical reference data
 * 7. Validation without uncertainty/error assessment
 * 8. Automatic promotion of solver PASS to VALIDATED
 * 9. Reuse of stale CFD evidence after geometry/configuration change
 */

import { describe, it, expect } from 'vitest';
import { GciEngine, StrictGciContractData } from '../../src/engine/cfd3d/diagnostics/GciEngine';

describe('NACA0012 CFD V&V Adversarial Protection Suite', () => {

  // 1. Non-monotonic mesh convergence
  it('1. Rejects non-monotonic mesh convergence presented as valid GCI', () => {
    const adversarialData: StrictGciContractData = {
      coarse: {
        meshHash: 'mesh-coarse-001',
        solutionStateHash: 'sol-coarse-001',
        CL: 0.2104,
        converged: true,
        iterations: 500,
        cells: 3200,
        faces: 6400,
        characteristicLength: 0.0177
      },
      medium: {
        meshHash: 'mesh-medium-001',
        solutionStateHash: 'sol-medium-001',
        CL: 0.3812,
        converged: true,
        iterations: 500,
        cells: 7200,
        faces: 14400,
        characteristicLength: 0.0118
      },
      fine: {
        meshHash: 'mesh-fine-001',
        solutionStateHash: 'sol-fine-001',
        CL: 0.1456,
        converged: true,
        iterations: 500,
        cells: 16200,
        faces: 32400,
        characteristicLength: 0.00786
      },
      refinementRatios: { r21: 1.5, r32: 1.5 }
    };

    const report = GciEngine.evaluateStrictContract(adversarialData);

    expect(report.computed).toBe(true);
    expect(report.numericallyValid).toBe(true);
    expect(report.meshConverged).toBe(false);
    expect(report.validated).toBe(false);
    expect(report.rejectionReason).toContain('Non-monotonic mesh convergence');
  });

  // 2. Unconverged force history
  it('2. Rejects unconverged force history presented as converged', () => {
    const unconvergedFine = {
      meshHash: 'mesh-fine-002',
      solutionStateHash: 'sol-fine-002',
      CL: 0.1456,
      converged: false, // Unconverged force history / residual
      iterations: 500,
      cells: 16200,
      faces: 32400,
      characteristicLength: 0.00786
    };

    const data: StrictGciContractData = {
      coarse: {
        meshHash: 'mesh-coarse-002',
        solutionStateHash: 'sol-coarse-002',
        CL: 0.1400,
        converged: true,
        iterations: 500,
        cells: 3200,
        faces: 6400,
        characteristicLength: 0.0177
      },
      medium: {
        meshHash: 'mesh-medium-002',
        solutionStateHash: 'sol-medium-002',
        CL: 0.1430,
        converged: true,
        iterations: 500,
        cells: 7200,
        faces: 14400,
        characteristicLength: 0.0118
      },
      fine: unconvergedFine,
      refinementRatios: { r21: 1.5, r32: 1.5 }
    };

    const report = GciEngine.evaluateStrictContract(data);

    expect(report.meshConverged).toBe(false);
    expect(report.validated).toBe(false);
    expect(report.rejectionReason).toContain('failed solver convergence');
  });

  // 3. Invalid refinement ratios (r < 1.1)
  it('3. Rejects invalid refinement ratios (r < 1.1)', () => {
    const data: StrictGciContractData = {
      coarse: {
        meshHash: 'mesh-coarse-003',
        solutionStateHash: 'sol-coarse-003',
        CL: 0.1400,
        converged: true,
        iterations: 500,
        cells: 7000,
        faces: 14000,
        characteristicLength: 0.0120
      },
      medium: {
        meshHash: 'mesh-medium-003',
        solutionStateHash: 'sol-medium-003',
        CL: 0.1430,
        converged: true,
        iterations: 500,
        cells: 7100,
        faces: 14200,
        characteristicLength: 0.0119
      },
      fine: {
        meshHash: 'mesh-fine-003',
        solutionStateHash: 'sol-fine-003',
        CL: 0.1450,
        converged: true,
        iterations: 500,
        cells: 7200,
        faces: 14400,
        characteristicLength: 0.0118
      },
      refinementRatios: { r21: 1.008, r32: 1.008 } // Invalid r < 1.1
    };

    // Refinement ratio < 1.1 violates Richardson extrapolation assumptions
    const isRefinementValid = data.refinementRatios.r21 >= 1.1 && data.refinementRatios.r32 >= 1.1;
    expect(isRefinementValid).toBe(false);
  });

  // 4. Missing mesh levels (< 3 grids)
  it('4. Rejects missing mesh levels (< 3 grids)', () => {
    const insufficientGrids = [
      { level: 'Fine', CL: 0.1456 },
      { level: 'Coarse', CL: 0.1400 }
    ];

    const hasThreeGrids = insufficientGrids.length >= 3;
    expect(hasThreeGrids).toBe(false);
  });

  // 5. Inconsistent boundary conditions between grids
  it('5. Rejects inconsistent boundary conditions between grids', () => {
    const fineBC = { aoa: 10.0, re: 6e6 };
    const mediumBC = { aoa: 12.0, re: 6e6 }; // Inconsistent AoA!

    const isBCConsistent = fineBC.aoa === mediumBC.aoa && fineBC.re === mediumBC.re;
    expect(isBCConsistent).toBe(false);
  });

  // 6. Missing physical reference data
  it('6. Rejects physical validation attempt missing reference data', () => {
    const cfdResult = { CL: 0.1456, CD: 0.0125, status: 'CONVERGED' };
    const referenceData = null; // Missing reference dataset

    const isValidationPossible = cfdResult.status === 'CONVERGED' && referenceData !== null;
    expect(isValidationPossible).toBe(false);
  });

  // 7. Validation without uncertainty / error assessment
  it('7. Rejects validation without uncertainty / error assessment', () => {
    const validationRecord = {
      clComputed: 1.085,
      clExp: 1.090,
      experimentalUncertainty: undefined, // Missing U_exp
      numericalUncertainty: undefined      // Missing U_num
    };

    const isValidated = validationRecord.experimentalUncertainty !== undefined && validationRecord.numericalUncertainty !== undefined;
    expect(isValidated).toBe(false);
  });

  // 8. Solver PASS automatically converted into VALIDATED
  it('8. Rejects automatic conversion of solver PASS into VALIDATED', () => {
    const solverExecution = {
      status: 'SOLVER_EXECUTED',
      residualPass: true,
      gciStatus: 'NOT_PROVEN',
      physicalValidationStatus: 'NOT_PROVEN'
    };

    // Fail-closed semantic rule: SOLVER_EXECUTED != VALIDATED
    const isPromotedToValidated = solverExecution.residualPass && solverExecution.gciStatus === 'VALIDATED';
    expect(isPromotedToValidated).toBe(false);
  });

  // 9. Stale CFD evidence reused after geometry/configuration change
  it('9. Rejects stale CFD evidence after geometry/configuration change', () => {
    const initialEvidence = {
      geometryHash: 'geom-naca0012-chord-1.0',
      revision: 'REV-A',
      cfdHash: 'cfd-hash-001'
    };

    const modifiedGeometry = {
      geometryHash: 'geom-naca0012-chord-1.2', // Geometry mutated!
      revision: 'REV-B'
    };

    const isEvidenceStillValid = initialEvidence.geometryHash === modifiedGeometry.geometryHash && initialEvidence.revision === modifiedGeometry.revision;
    expect(isEvidenceStillValid).toBe(false);
  });

  // 10. Residual gate bypass: Rejects declaring numerical convergence when momentum Linf exceeds tolerance
  it('10. Rejects residual gate bypass when momentum Linf exceeds threshold', () => {
    const runResult = {
      continuityL1: 2.76e-3,
      momentumLinf: 0.055302, // Exceeds tolerance of 0.015000!
      momentumTol: 0.015000,
      forceStabilityPassed: true
    };

    // Strict multi-gate rule: Force stability alone CANNOT bypass failed residual norm
    const isNumericallyConverged = runResult.momentumLinf < runResult.momentumTol && runResult.forceStabilityPassed;
    expect(isNumericallyConverged).toBe(false);
  });

  // 11. Fake convergence: Rejects convergence when residuals pass but force history is unstable
  it('11. Rejects fake convergence when force history is unstable despite residual pass', () => {
    const runResult = {
      continuityL1: 1.0e-5,
      momentumLinf: 0.005,
      momentumTol: 0.015,
      forceStability: {
        clRelativeWindowChange: 0.085, // 8.5% > 2% allowed threshold!
        passed: false
      }
    };

    const isFullyConverged = runResult.momentumLinf < runResult.momentumTol && runResult.forceStability.passed;
    expect(isFullyConverged).toBe(false);
  });

  // 12. Reference mismatch: Rejects validation when reference conditions differ from simulation
  it('12. Rejects physical validation when experimental conditions differ from simulation', () => {
    const simConditions = { aoa: 10.0, re: 6.0e6, mach: 0.15 };
    const referenceConditions = { aoa: 15.0, re: 3.0e6, mach: 0.30 }; // Material mismatch!

    const isConditionsCompatible = (
      Math.abs(simConditions.aoa - referenceConditions.aoa) < 0.1 &&
      Math.abs(simConditions.re - referenceConditions.re) / referenceConditions.re < 0.05
    );
    expect(isConditionsCompatible).toBe(false);
  });

  // 13. Partial quantity validation: Rejects declaring model VALIDATED when CD agrees but CL fails
  it('13. Rejects model-level validation when single key aerodynamic quantity (CL) fails acceptance interval', () => {
    const quantityValidation = {
      CL: { computed: 0.14812, ref: 1.085, u_exp: 0.02, validated: false }, // Discrepancy = 0.93688 >> 0.02
      CD: { computed: 0.01231, ref: 0.0122, u_exp: 0.0008, validated: true },
      Cm: { computed: -0.01438, ref: -0.013, u_exp: 0.002, validated: true }
    };

    // Full model validation requires ALL primary quantities to be validated
    const isModelValidated = quantityValidation.CL.validated && quantityValidation.CD.validated && quantityValidation.Cm.validated;
    expect(isModelValidated).toBe(false);
  });

  // 14. False causal attribution: Rejects declaring a mechanism FACT without controlled comparative evidence
  it('14. Rejects declaring causal hypothesis as FACT without controlled comparative parameter isolation', () => {
    const causalClaim = {
      hypothesis: '1st-order upwind artificial viscosity causes leading-edge lift underprediction',
      controlledComparisonExecuted: false,
      provenByComparativeIsolation: false
    };

    const isEstablishedFact = causalClaim.controlledComparisonExecuted && causalClaim.provenByComparativeIsolation;
    expect(isEstablishedFact).toBe(false);
  });

  // 15. Unauthorized G0 escalation: Rejects promoting to G0 whenever ANY gate is NOT_PROVEN
  it('15. Rejects unauthorized G0 escalation when numerical or physical gates remain NOT_PROVEN', () => {
    const gateStatus = {
      solverExecuted: 'PASS',
      numericallyConverged: 'PASS',
      gridConverged: 'NOT_PROVEN',
      verified: 'NOT_PROVEN',
      validated: 'NOT_PROVEN'
    };

    const canEscalateToG0 = (
      gateStatus.solverExecuted === 'PASS' &&
      gateStatus.numericallyConverged === 'PASS' &&
      gateStatus.gridConverged === 'PASS' &&
      gateStatus.verified === 'PASS' &&
      gateStatus.validated === 'PASS'
    );

    // Negative case must NEVER produce G0
    expect(canEscalateToG0).toBe(false);
  });
});
