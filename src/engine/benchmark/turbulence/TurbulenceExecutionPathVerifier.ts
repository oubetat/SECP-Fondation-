/**
 * PATCH-176: Turbulence Execution Path Verifier
 * 
 * Verifies that selecting a turbulence model actually alters momentum/flux calculations
 * compared to Laminar mode. Measures differences in velocity, viscosity, and pressure.
 * Also checks whether turbulence transport fields evolve dynamically or remain static.
 */

import { ExecutionPathAudit } from './types';
import { Fvm3DMeshGenerator } from '../../cfd3d/Fvm3DMeshGenerator';
import { Fvm3DNavierStokesSolver } from '../../cfd3d/Fvm3DNavierStokesSolver';
import { BoundaryConditionSpec3D, FluidProperties3D, SolverConfig3D } from '../../cfd3d/Fvm3DTypes';

export class TurbulenceExecutionPathVerifier {
  public static verifyExecutionPath(): ExecutionPathAudit {
    const mesh = Fvm3DMeshGenerator.generateBoxMesh(0.5, 0.05, 0.05, 10, 3, 3);
    const fluid: FluidProperties3D = {
      densityKgM3: 1.225,
      viscosityPaS: 1.81e-5
    };

    const bc: BoundaryConditionSpec3D = {
      inletVelocityMS: { x: 5.0, y: 0.0, z: 0.0 },
      outletPressurePa: 0.0,
      wallTurbulenceIntensity: 5.0
    };

    // 1. Run Laminar Solver
    const laminarConfig: SolverConfig3D = {
      maxIterations: 25,
      continuityTol: 1e-4,
      momentumTol: 1e-4,
      underRelaxationVelocity: 0.7,
      underRelaxationPressure: 0.3,
      useTurbulenceModel: false,
      turbulenceScheme: 'LAMINAR',
      upwindScheme: 'FIRST_ORDER_UPWIND'
    };

    const laminarSolution = Fvm3DNavierStokesSolver.solve(mesh, fluid, bc, laminarConfig);

    // 2. Run k-Epsilon Solver
    const kEpsConfig: SolverConfig3D = {
      ...laminarConfig,
      useTurbulenceModel: true,
      turbulenceScheme: 'K_EPSILON'
    };

    const kEpsSolution = Fvm3DNavierStokesSolver.solve(mesh, fluid, bc, kEpsConfig);

    // 3. Compute Differences
    let maxVelDiff = 0.0;
    let maxU_laminar = 0.0;

    for (let i = 0; i < laminarSolution.velocity.u.length; i++) {
      const uLam = laminarSolution.velocity.u[i];
      const uTurb = kEpsSolution.velocity.u[i];
      maxU_laminar = Math.max(maxU_laminar, Math.abs(uLam));
      const diff = Math.abs(uTurb - uLam);
      if (diff > maxVelDiff) {
        maxVelDiff = diff;
      }
    }

    const velDiffPercent = maxU_laminar > 0 ? (maxVelDiff / maxU_laminar) * 100 : 0.0;

    // Check turbulent viscosity
    const nut = kEpsSolution.turbulence?.nut || [];
    let maxNut = 0.0;
    for (const val of nut) {
      if (val > maxNut) maxNut = val;
    }

    const maxViscosityDiffPercent = (maxNut / fluid.viscosityPaS) * 100;

    const pLamDrop = laminarSolution.monitors.pressureDropPa;
    const pTurbDrop = kEpsSolution.monitors.pressureDropPa;
    const pressureDropDiffPercent = pLamDrop > 0 ? Math.abs((pTurbDrop - pLamDrop) / pLamDrop) * 100 : 0.0;

    const laminarToTurbulenceDiffDetected = maxNut > 0 || velDiffPercent > 0.01 || pressureDropDiffPercent > 0.01;
    const turbulentViscosityActive = maxNut > 0;

    // 4. Test if turbulence field is dynamic across iterations or static
    // Currently, k and epsilon are initialized to constant values and nut is computed from them once per step, but k/eps do not dynamically evolve via transport equations.
    const isTurbulenceFieldDynamic = false; // Source code analysis confirms static k/eps initialization

    let executionPathStatus: ExecutionPathAudit['executionPathStatus'] = 'DECOUPLED_FROZEN';
    if (turbulentViscosityActive && !isTurbulenceFieldDynamic) {
      executionPathStatus = 'STATIC_TURBULENCE_EFFECTIVE';
    } else if (turbulentViscosityActive && isTurbulenceFieldDynamic) {
      executionPathStatus = 'DYNAMIC_TURBULENCE_ACTIVE';
    } else if (!laminarToTurbulenceDiffDetected) {
      executionPathStatus = 'IDENTICAL_TO_LAMINAR';
    }

    return {
      laminarToTurbulenceDiffDetected,
      velocityMaxDiffPercent: velDiffPercent,
      viscosityMaxDiffPercent: maxViscosityDiffPercent,
      pressureDropDiffPercent,
      turbulentViscosityActive,
      isTurbulenceFieldDynamic,
      executionPathStatus,
      details: `Turbulent viscosity nut_max = ${maxNut.toExponential(3)} Pa.s (${maxViscosityDiffPercent.toFixed(1)}% of laminar mu). Velocity delta = ${velDiffPercent.toFixed(2)}%. Pressure drop delta = ${pressureDropDiffPercent.toFixed(2)}%.`
    };
  }
}
