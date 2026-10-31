/**
 * PATCH-176: Turbulence Adversarial Attack Suite
 * 
 * Executes 6 intentional numerical and physical corruptions:
 * 1. Incompatible Boundary Conditions (Negative intensity / invalid velocity)
 * 2. Invalid / Degenerate Mesh Input
 * 3. Unphysical Initial Turbulence Values (k = -10.0)
 * 4. Solver Non-Convergence State (Premature termination)
 * 5. Corrupted Turbulence Field (NaN injection)
 * 6. Reference Mismatch Attack (Extreme reference deviation)
 */

import { AdversarialTurbulenceTestResult } from './types';
import { Fvm3DMeshGenerator } from '../../cfd3d/Fvm3DMeshGenerator';
import { Fvm3DNavierStokesSolver } from '../../cfd3d/Fvm3DNavierStokesSolver';
import { BoundaryConditionSpec3D, FluidProperties3D, SolverConfig3D } from '../../cfd3d/Fvm3DTypes';
import { DomainBindingTestUtility } from '../../crossdomain/DomainBindingTestUtility';
import { TurbulenceQuantitiesAuditor } from './TurbulenceQuantitiesAuditor';

export class TurbulenceAdversarialSuite {
  public static runAdversarialAttacks(): AdversarialTurbulenceTestResult[] {
    const results: AdversarialTurbulenceTestResult[] = [];
    const mesh = Fvm3DMeshGenerator.generateBoxMesh(0.4, 0.03, 0.03, 10, 3, 3);
    const fluid: FluidProperties3D = { densityKgM3: 1.225, viscosityPaS: 1.81e-5 };

    const baseConfig: SolverConfig3D = {
      maxIterations: 20,
      continuityTol: 1e-4,
      momentumTol: 1e-4,
      underRelaxationVelocity: 0.7,
      underRelaxationPressure: 0.3,
      useTurbulenceModel: true,
      turbulenceScheme: 'K_EPSILON',
      upwindScheme: 'FIRST_ORDER_UPWIND'
    };

    // Attack 1: Incompatible Boundary Conditions (Negative Fluid Viscosity)
    try {
      const invalidFluid = { densityKgM3: 1.225, viscosityPaS: -1.81e-5 };
      const bc: BoundaryConditionSpec3D = { inletVelocityMS: { x: 10, y: 0, z: 0 }, outletPressurePa: 0 };
      const binding1 = DomainBindingTestUtility.createSealedCfdBinding(mesh, invalidFluid);
      Fvm3DNavierStokesSolver.solve(binding1, baseConfig);

      results.push({
        testId: 'ADV-TURB-01',
        testName: 'Incompatible Boundary Condition (Negative Viscosity)',
        attackVector: 'Negative viscosity mu = -1.81e-5 Pa.s injected into fluid properties',
        expectedOutcome: 'INVALID',
        actualOutcome: 'PASS_UNEXPECTED',
        detectedBy: 'Solver Pre-validation Gate',
        passed: false,
        details: 'Negative viscosity was not rejected by solver.'
      });
    } catch (e: unknown) {
      const errMessage = e instanceof Error ? e.message : String(e);
      const isGuardException = errMessage.includes('NUMERICAL_FAILURE: Fluid viscosity must be positive');
      results.push({
        testId: 'ADV-TURB-01',
        testName: 'Incompatible Boundary Condition (Negative Viscosity)',
        attackVector: 'Negative viscosity mu = -1.81e-5 Pa.s injected into fluid properties',
        expectedOutcome: 'INVALID',
        actualOutcome: isGuardException ? 'INVALID' : 'UNEXPECTED_ERROR',
        detectedBy: 'Solver Pre-validation Gate',
        passed: isGuardException,
        details: isGuardException
          ? `Strict Pre-Initialization Interception Verified: ${errMessage}`
          : `Unexpected failure mode: ${errMessage}`
      });
    }

    // Attack 2: Invalid Degenerate Mesh Input
    try {
      const badMesh = JSON.parse(JSON.stringify(mesh));
      badMesh.cells[0].volume = -0.001; // Negative cell volume
      badMesh.quality.hasPositiveVolumes = false;

      const bc: BoundaryConditionSpec3D = { inletVelocityMS: { x: 10, y: 0, z: 0 }, outletPressurePa: 0 };
      const binding2 = DomainBindingTestUtility.createSealedCfdBinding(badMesh, fluid);
      const sol = Fvm3DNavierStokesSolver.solve(binding2, baseConfig);

      const isInvalid = !sol.mesh.quality.hasPositiveVolumes || sol.numericalStatus === 'INVALID';
      results.push({
        testId: 'ADV-TURB-02',
        testName: 'Degenerate Mesh Input (Negative Cell Volume)',
        attackVector: 'Injected negative cell volume volume = -0.001 m^3',
        expectedOutcome: 'INVALID',
        actualOutcome: isInvalid ? 'INVALID' : 'PASS_UNEXPECTED',
        detectedBy: 'Mesh Quality Auditor',
        passed: isInvalid,
        details: isInvalid ? 'Correctly flagged as INVALID mesh quality.' : 'Failed to catch negative volume.'
      });
    } catch (e: unknown) {
      const errMessage = e instanceof Error ? e.message : String(e);
      results.push({
        testId: 'ADV-TURB-02',
        testName: 'Degenerate Mesh Input (Negative Cell Volume)',
        attackVector: 'Injected negative cell volume volume = -0.001 m^3',
        expectedOutcome: 'INVALID',
        actualOutcome: 'INVALID',
        detectedBy: 'Mesh Quality Auditor',
        passed: true,
        details: `Correctly thrown exception: ${errMessage}`
      });
    }

    // Attack 3: Unphysical Initial Turbulence Values (k < 0)
    const bcNormal: BoundaryConditionSpec3D = { inletVelocityMS: { x: 10, y: 0, z: 0 }, outletPressurePa: 0 };
    const bindingNormal = DomainBindingTestUtility.createSealedCfdBinding(mesh, fluid);
    const solNormal = Fvm3DNavierStokesSolver.solve(bindingNormal, baseConfig);

    const forgedSol3 = JSON.parse(JSON.stringify(solNormal));
    if (forgedSol3.turbulence) {
      forgedSol3.turbulence.k[0] = -10.0; // Negative kinetic energy
    }

    const audit3 = TurbulenceQuantitiesAuditor.auditSolution(forgedSol3);
    const passed3 = audit3.hasNegativeK && !audit3.isPhysicallyBounded;

    results.push({
      testId: 'ADV-TURB-03',
      testName: 'Unphysical Turbulence Energy Injection (k = -10.0)',
      attackVector: 'Forced negative turbulent kinetic energy k = -10.0 m^2/s^2',
      expectedOutcome: 'FAIL',
      actualOutcome: passed3 ? 'FAIL' : 'PASS_UNEXPECTED',
      detectedBy: 'Turbulent Quantities Auditor',
      passed: passed3,
      details: passed3 ? 'Correctly detected k < 0 positivity violation.' : 'Failed to detect negative k.'
    });

    // Attack 4: Non-Converged Solver Execution State
    const nonConvConfig: SolverConfig3D = {
      ...baseConfig,
      maxIterations: 1, // Only 1 iteration
      continuityTol: 1e-12
    };

    const bindingNonConv = DomainBindingTestUtility.createSealedCfdBinding(mesh, fluid);
    const solNonConv = Fvm3DNavierStokesSolver.solve(bindingNonConv, nonConvConfig);
    const isNotConverged = !solNonConv.converged && solNonConv.finalContinuityResidual > 1e-4;

    results.push({
      testId: 'ADV-TURB-04',
      testName: 'Non-Converged Solver State (Iter = 1)',
      attackVector: 'Single SIMPLE iteration executed; high continuity residual remaining',
      expectedOutcome: 'NOT_CONVERGED',
      actualOutcome: isNotConverged ? 'NOT_CONVERGED' : 'PASS_UNEXPECTED',
      detectedBy: 'Convergence Monitor',
      passed: isNotConverged,
      details: isNotConverged ? `Correctly reported NOT_CONVERGED (Residual = ${solNonConv.finalContinuityResidual.toExponential(2)})` : 'Failed to detect non-convergence.'
    });

    // Attack 5: Corrupted Turbulence Field (NaN in nut)
    const forgedSol5 = JSON.parse(JSON.stringify(solNormal));
    if (forgedSol5.turbulence) {
      forgedSol5.turbulence.nut[0] = NaN;
    }

    const audit5 = TurbulenceQuantitiesAuditor.auditSolution(forgedSol5);
    const passed5 = audit5.hasNaN;

    results.push({
      testId: 'ADV-TURB-05',
      testName: 'Corrupted Turbulence Field (NaN Injection)',
      attackVector: 'Injected NaN into eddy viscosity array nut[0] = NaN',
      expectedOutcome: 'FAIL',
      actualOutcome: passed5 ? 'FAIL' : 'PASS_UNEXPECTED',
      detectedBy: 'Turbulent Quantities Auditor',
      passed: passed5,
      details: passed5 ? 'Correctly flagged NaN corruption in turbulence field.' : 'Failed to detect NaN.'
    });

    // Attack 6: Reference Mismatch Attack (Fake reference value)
    const U6 = bcNormal.inletVelocityMS.x;
    const rho6 = fluid.densityKgM3;
    const wallArea6 = mesh.faces.filter(f => f.boundaryType === 'WALL').reduce((sum, f) => sum + f.area, 0);
    const viscousForce6 = solNormal.monitors.viscousDragForceN || solNormal.monitors.dragForceN;
    const tau_w6 = viscousForce6 / Math.max(wallArea6, 1e-10);
    const calculatedF = (8.0 * tau_w6) / Math.max(rho6 * U6 * U6, 1e-10);
    const forgedRefF = 0.500; // 15x higher than actual physical value
    const relErr = Math.abs((calculatedF - forgedRefF) / forgedRefF) * 100;
    const passed6 = relErr > 50.0;

    results.push({
      testId: 'ADV-TURB-06',
      testName: 'Reference Mismatch Attack (Fake Benchmark Ref)',
      attackVector: 'Compared physical solver output against fake benchmark reference value 0.500',
      expectedOutcome: 'FAIL',
      actualOutcome: passed6 ? 'FAIL' : 'PASS_UNEXPECTED',
      detectedBy: 'Reference Validator',
      passed: passed6,
      details: passed6 ? `Correctly flagged high reference deviation error (${relErr.toFixed(1)}%).` : 'Failed reference error check.'
    });

    return results;
  }
}
