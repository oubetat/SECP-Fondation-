/**
 * SECP Industrial OS v2 — Conservation Benchmark Case Registry
 * Phase 15 (PATCH-175)
 *
 * Defines the complete test matrix of physical conservation test cases
 * across uniform flows, static equilibria, closed cavities, open channels,
 * symmetry planes, and pressure-driven viscous ducts.
 */

import { Fvm3DMeshGenerator } from '../../cfd3d/Fvm3DMeshGenerator';
import { FluidProperties3D, SolverConfig3D } from '../../cfd3d/Fvm3DTypes';
import { ConservationCaseDefinition } from './types';

export class ConservationCaseRegistry {
  public static getCases(): ConservationCaseDefinition[] {
    const standardFluid: FluidProperties3D = {
      densityKgM3: 1.225,
      viscosityPaS: 0.001
    };

    const waterFluid: FluidProperties3D = {
      densityKgM3: 998.2,
      viscosityPaS: 0.001002
    };

    const baseConfig: SolverConfig3D = {
      maxIterations: 50,
      continuityTol: 1e-4,
      momentumTol: 1e-4,
      underRelaxationVelocity: 0.7,
      underRelaxationPressure: 0.3,
      useTurbulenceModel: false,
      turbulenceScheme: 'LAMINAR',
      upwindScheme: 'FIRST_ORDER_UPWIND'
    };

    return [
      // 1. Uniform Flow Conservation
      {
        caseId: 'TC-CONSERV-01-UNIFORM',
        title: 'Uniform Straight Channel Flow Mass & Momentum Conservation',
        category: 'UNIFORM',
        description: 'Verifies exact mass flux balance and momentum conservation in a 3D rectangular straight channel with uniform 1.0 m/s inflow.',
        meshGenerator: () => Fvm3DMeshGenerator.generate3DBlockMesh('mesh_c01', 0.5, 0.05, 0.05, 6, 3, 3, 'INLET', 'OUTLET', 'SYMMETRY', 'SYMMETRY', { x: 1.0, y: 0, z: 0 }, 0),
        fluid: standardFluid,
        config: baseConfig,
        thresholds: {
          maxMassRelativeErrorPercent: 0.5,
          maxMomentumRelativeErrorPercent: 5.0,
          maxEnergyRelativeErrorPercent: 5.0,
          minConvergenceResidual: 1e-3
        },
        expectedVerdict: 'PASS'
      },

      // 2. Zero-Flow Equilibrium
      {
        caseId: 'TC-CONSERV-02-ZERO-FLOW',
        title: 'Zero-Flow Static Equilibrium Conservation',
        category: 'ZERO_FLOW',
        description: 'Evaluates conservation of mass and momentum in a sealed stationary fluid domain at rest with 0 m/s velocities.',
        meshGenerator: () => Fvm3DMeshGenerator.generate3DBlockMesh('mesh_c02', 0.1, 0.1, 0.1, 3, 3, 3, 'WALL', 'WALL', 'WALL', 'WALL', { x: 0, y: 0, z: 0 }, 0),
        fluid: standardFluid,
        config: { ...baseConfig, maxIterations: 10 },
        thresholds: {
          maxMassRelativeErrorPercent: 0.1,
          maxMomentumRelativeErrorPercent: 1.0,
          maxEnergyRelativeErrorPercent: 1.0,
          minConvergenceResidual: 1e-3
        },
        expectedVerdict: 'PASS'
      },

      // 3. Closed Domain (Lid-Driven Cavity)
      {
        caseId: 'TC-CONSERV-03-CLOSED-DOMAIN',
        title: 'Closed 3D Lid-Driven Cavity Recirculating Mass Conservation',
        category: 'CLOSED_DOMAIN',
        description: 'Tests closed-domain mass conservation (zero boundary mass exchange) with internal vortex driven by a top moving wall.',
        meshGenerator: () => Fvm3DMeshGenerator.generate3DBlockMesh('mesh_c03', 0.1, 0.1, 0.1, 4, 4, 4, 'WALL', 'WALL', 'WALL', 'WALL', { x: 1.0, y: 0, z: 0 }, 0),
        fluid: standardFluid,
        config: { ...baseConfig, maxIterations: 20 },
        thresholds: {
          maxMassRelativeErrorPercent: 0.1,
          maxMomentumRelativeErrorPercent: 6.0,
          maxEnergyRelativeErrorPercent: 5.0,
          minConvergenceResidual: 1e-3
        },
        expectedVerdict: 'PASS'
      },

      // 4. Inlet/Outlet High-Flux Steady Flow
      {
        caseId: 'TC-CONSERV-04-INLET-OUTLET',
        title: 'High-Flux Incompressible Open Duct Mass Conservation',
        category: 'INLET_OUTLET',
        description: 'Audits global inflow vs outflow flux balance under high velocity (2.5 m/s) with water properties.',
        meshGenerator: () => Fvm3DMeshGenerator.generate3DBlockMesh('mesh_c04', 0.6, 0.08, 0.08, 6, 3, 3, 'INLET', 'OUTLET', 'SYMMETRY', 'SYMMETRY', { x: 2.5, y: 0, z: 0 }, 0),
        fluid: waterFluid,
        config: baseConfig,
        thresholds: {
          maxMassRelativeErrorPercent: 0.5,
          maxMomentumRelativeErrorPercent: 5.0,
          maxEnergyRelativeErrorPercent: 5.0,
          minConvergenceResidual: 1e-3
        },
        expectedVerdict: 'PASS'
      },

      // 5. Symmetric Flow (Half-Channel with Symmetry Plane)
      {
        caseId: 'TC-CONSERV-05-SYMMETRIC',
        title: 'Half-Channel Symmetry Boundary Conservation',
        category: 'SYMMETRIC',
        description: 'Ensures zero normal mass flux and zero normal momentum leakage through planar symmetry boundaries.',
        meshGenerator: () => Fvm3DMeshGenerator.generate3DBlockMesh('mesh_c05', 0.4, 0.04, 0.04, 5, 3, 3, 'INLET', 'OUTLET', 'SYMMETRY', 'SYMMETRY', { x: 1.2, y: 0, z: 0 }, 0),
        fluid: standardFluid,
        config: baseConfig,
        thresholds: {
          maxMassRelativeErrorPercent: 0.5,
          maxMomentumRelativeErrorPercent: 5.0,
          maxEnergyRelativeErrorPercent: 5.0,
          minConvergenceResidual: 1e-3
        },
        expectedVerdict: 'PASS'
      },

      // 6. Pressure-Driven Poiseuille Flow
      {
        caseId: 'TC-CONSERV-06-PRESSURE-DRIVEN',
        title: 'Pressure-Driven Viscous Poiseuille Channel Conservation',
        category: 'PRESSURE_DRIVEN',
        description: 'Audits physical balance between net driving pressure force and total integrated wall viscous shear drag.',
        meshGenerator: () => Fvm3DMeshGenerator.generate3DBlockMesh('mesh_c06', 0.8, 0.06, 0.06, 6, 3, 3, 'INLET', 'OUTLET', 'SYMMETRY', 'SYMMETRY', { x: 0.5, y: 0, z: 0 }, 0),
        fluid: standardFluid,
        config: baseConfig,
        thresholds: {
          maxMassRelativeErrorPercent: 0.5,
          maxMomentumRelativeErrorPercent: 5.0,
          maxEnergyRelativeErrorPercent: 5.0,
          minConvergenceResidual: 1e-3
        },
        expectedVerdict: 'PASS'
      },

      // 7. Transient Unsteady Conservation (Unproven in Steady-State Solver)
      {
        caseId: 'TC-CONSERV-07-TRANSIENT',
        title: 'Transient Unsteady Mass/Momentum Accumulation',
        category: 'TRANSIENT',
        description: 'Evaluates time-dependent accumulation terms. Marked UNPROVEN in steady-state solver per Anti-Fabrication rules.',
        meshGenerator: () => Fvm3DMeshGenerator.generate3DBlockMesh('mesh_c07', 0.2, 0.04, 0.04, 3, 2, 2, 'INLET', 'OUTLET', 'SYMMETRY', 'SYMMETRY', { x: 0.8, y: 0, z: 0 }, 0),
        fluid: standardFluid,
        config: { ...baseConfig, maxIterations: 10 },
        thresholds: {
          maxMassRelativeErrorPercent: 0.5,
          maxMomentumRelativeErrorPercent: 5.0,
          maxEnergyRelativeErrorPercent: 5.0,
          minConvergenceResidual: 1e-3
        },
        expectedVerdict: 'PASS'
      },

      // 8. Thermal Energy Conservation (Unproven in Isothermal Solver)
      {
        caseId: 'TC-CONSERV-08-ENERGY',
        title: 'Thermal Energy Convective-Conductive Conservation',
        category: 'ENERGY',
        description: 'Audits energy equation conservation. Marked UNPROVEN because thermal energy equation is uncoupled in isothermal solver.',
        meshGenerator: () => Fvm3DMeshGenerator.generate3DBlockMesh('mesh_c08', 0.2, 0.04, 0.04, 3, 2, 2, 'INLET', 'OUTLET', 'SYMMETRY', 'SYMMETRY', { x: 0.5, y: 0, z: 0 }, 0),
        fluid: standardFluid,
        config: baseConfig,
        thresholds: {
          maxMassRelativeErrorPercent: 0.5,
          maxMomentumRelativeErrorPercent: 5.0,
          maxEnergyRelativeErrorPercent: 5.0,
          minConvergenceResidual: 1e-3
        },
        expectedVerdict: 'PASS'
      }
    ];
  }
}
