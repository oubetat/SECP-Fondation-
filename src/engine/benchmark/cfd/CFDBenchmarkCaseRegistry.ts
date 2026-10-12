/**
 * SECP Industrial OS v2 — CFD Benchmark Case Registry
 * Phase 15 (PATCH-174)
 *
 * Defines the canonical test cases spanning all 10 CFD verification categories.
 */

import { CFDCategory, CFDVerdict } from './types';
import { Fvm3DMeshGenerator } from '../../cfd3d/Fvm3DMeshGenerator';
import { FvmMesh3D, FluidProperties3D, SolverConfig3D } from '../../cfd3d/Fvm3DTypes';

export interface CFDBenchmarkCaseDefinition {
  id: string;
  category: CFDCategory;
  title: string;
  description: string;
  expectedVerdict: CFDVerdict;
  setup: () => {
    mesh: FvmMesh3D;
    fluid: FluidProperties3D;
    config: SolverConfig3D;
    referenceAreaM2: number;
    referenceVelocityMS: number;
    analyticalCheck?: {
      type: 'POISEUILLE' | 'COUETTE' | 'NONE';
      tolerancePercent: number;
    };
  };
}

export class CFDBenchmarkCaseRegistry {
  private static cases: CFDBenchmarkCaseDefinition[] = [
    // -------------------------------------------------------------
    // CATEGORY A: Analytical Verification
    // -------------------------------------------------------------
    {
      id: 'TC-CFD-A01',
      category: 'A_ANALYTICAL_VERIFICATION',
      title: '3D Poiseuille Channel Flow vs Analytical Solution',
      description: 'Verifies numerical velocity distribution and pressure drop against exact Navier-Stokes solution (Delta P = 12 mu L U_avg / h^2).',
      expectedVerdict: 'PASS',
      setup: () => {
        const Lx = 1.0, Ly = 0.1, Lz = 0.1;
        const Uavg = 0.5;
        const rho = 1.225, mu = 5.0e-4;
        const mesh = Fvm3DMeshGenerator.generate3DBlockMesh(
          'poiseuille_a01',
          Lx, Ly, Lz,
          16, 12, 4,
          'INLET', 'OUTLET', 'WALL', 'SYMMETRY',
          { x: Uavg, y: 0, z: 0 }, 0.0
        );
        for (const face of mesh.faces) {
          if (face.boundaryType === 'INLET') {
            const normY = face.centroid.y / Ly;
            face.u_bc = 6.0 * Uavg * normY * (1.0 - normY);
          }
        }
        return {
          mesh,
          fluid: { densityKgM3: rho, viscosityPaS: mu },
          config: {
            maxIterations: 150,
            continuityTol: 1e-4,
            momentumTol: 1e-4,
            underRelaxationVelocity: 0.7,
            underRelaxationPressure: 0.3,
            useTurbulenceModel: false,
            turbulenceScheme: 'LAMINAR',
            upwindScheme: 'FIRST_ORDER_UPWIND'
          },
          referenceAreaM2: Ly * Lz,
          referenceVelocityMS: Uavg,
          analyticalCheck: { type: 'POISEUILLE', tolerancePercent: 20.0 }
        };
      }
    },
    {
      id: 'TC-CFD-A02',
      category: 'A_ANALYTICAL_VERIFICATION',
      title: '3D Planar Couette Shear Flow',
      description: 'Verifies linear velocity gradient u(y) = U_wall * y / h and constant shear stress between stationary and moving plate.',
      expectedVerdict: 'PASS',
      setup: () => {
        const Lx = 0.5, Ly = 0.05, Lz = 0.05;
        const Uwall = 1.0;
        const rho = 1.225, mu = 0.001;
        // In Couette flow, top wall moves at Uwall, inlet has linear profile u(y) = Uwall * (y/Ly)
        const mesh = Fvm3DMeshGenerator.generate3DBlockMesh(
          'couette_a02',
          Lx, Ly, Lz,
          8, 8, 4,
          'INLET', 'OUTLET', 'WALL', 'SYMMETRY',
          { x: 0, y: 0, z: 0 }, 0.0
        );
        for (const face of mesh.faces) {
          if (face.boundaryType === 'WALL' && face.centroid.y >= Ly - 1e-4) {
            face.u_bc = Uwall;
          }
          if (face.boundaryType === 'INLET') {
            const normY = face.centroid.y / Ly;
            face.u_bc = Uwall * normY;
          }
        }
        return {
          mesh,
          fluid: { densityKgM3: rho, viscosityPaS: mu },
          config: {
            maxIterations: 100,
            continuityTol: 1e-4,
            momentumTol: 1e-4,
            underRelaxationVelocity: 0.7,
            underRelaxationPressure: 0.3,
            useTurbulenceModel: false,
            turbulenceScheme: 'LAMINAR',
            upwindScheme: 'FIRST_ORDER_UPWIND'
          },
          referenceAreaM2: Ly * Lz,
          referenceVelocityMS: Uwall,
          analyticalCheck: { type: 'COUETTE', tolerancePercent: 6.0 }
        };
      }
    },
    {
      id: 'TC-CFD-A03',
      category: 'A_ANALYTICAL_VERIFICATION',
      title: '3D Lid-Driven Cavity Recirculating Flow',
      description: 'Verifies primary recirculating vortex, center line velocity profile, and pressure extrema in a 3D closed lid cavity.',
      expectedVerdict: 'PASS',
      setup: () => {
        const L = 0.1;
        const Utop = 1.0;
        const rho = 1.0, mu = 0.01; // Re = 100
        const mesh = Fvm3DMeshGenerator.generate3DBlockMesh(
          'cavity_a03',
          L, L, L,
          10, 10, 4,
          'WALL', 'WALL', 'WALL', 'SYMMETRY',
          { x: 0, y: 0, z: 0 }, 0.0
        );
        // Apply moving lid velocity at top wall y = L
        for (const face of mesh.faces) {
          if (face.boundaryType === 'WALL' && face.centroid.y >= L - 1e-4) {
            face.u_bc = Utop;
          }
        }
        return {
          mesh,
          fluid: { densityKgM3: rho, viscosityPaS: mu },
          config: {
            maxIterations: 120,
            continuityTol: 1e-3,
            momentumTol: 1e-3,
            underRelaxationVelocity: 0.6,
            underRelaxationPressure: 0.3,
            useTurbulenceModel: false,
            turbulenceScheme: 'LAMINAR',
            upwindScheme: 'FIRST_ORDER_UPWIND'
          },
          referenceAreaM2: L * L,
          referenceVelocityMS: Utop,
          analyticalCheck: { type: 'NONE', tolerancePercent: 10.0 }
        };
      }
    },

    // -------------------------------------------------------------
    // CATEGORY B: Conservation
    // -------------------------------------------------------------
    {
      id: 'TC-CFD-B01',
      category: 'B_CONSERVATION',
      title: 'Global Mass Flux Conservation in 3D Duct',
      description: 'Audits inlet mass flow vs outlet mass flow to enforce mass balance error < 0.5%.',
      expectedVerdict: 'PASS',
      setup: () => {
        const mesh = Fvm3DMeshGenerator.generate3DBlockMesh(
          'mass_b01',
          0.8, 0.08, 0.08,
          12, 6, 4,
          'INLET', 'OUTLET', 'WALL', 'SYMMETRY',
          { x: 1.5, y: 0, z: 0 }, 0.0
        );
        return {
          mesh,
          fluid: { densityKgM3: 998.2, viscosityPaS: 0.001002 },
          config: {
            maxIterations: 80,
            continuityTol: 1e-4,
            momentumTol: 1e-4,
            underRelaxationVelocity: 0.7,
            underRelaxationPressure: 0.3,
            useTurbulenceModel: false,
            turbulenceScheme: 'LAMINAR',
            upwindScheme: 'FIRST_ORDER_UPWIND'
          },
          referenceAreaM2: 0.08 * 0.08,
          referenceVelocityMS: 1.5
        };
      }
    },
    {
      id: 'TC-CFD-B02',
      category: 'B_CONSERVATION',
      title: 'Momentum Balance & Wall Friction Equilibrium',
      description: 'Audits net pressure gradient force vs integrated viscous wall drag in steady channel flow.',
      expectedVerdict: 'PASS',
      setup: () => {
        const mesh = Fvm3DMeshGenerator.generate3DBlockMesh(
          'mom_b02',
          0.6, 0.06, 0.06,
          10, 6, 4,
          'INLET', 'OUTLET', 'WALL', 'SYMMETRY',
          { x: 0.8, y: 0, z: 0 }, 0.0
        );
        return {
          mesh,
          fluid: { densityKgM3: 1.225, viscosityPaS: 0.0005 },
          config: {
            maxIterations: 80,
            continuityTol: 1e-4,
            momentumTol: 1e-4,
            underRelaxationVelocity: 0.7,
            underRelaxationPressure: 0.3,
            useTurbulenceModel: false,
            turbulenceScheme: 'LAMINAR',
            upwindScheme: 'FIRST_ORDER_UPWIND'
          },
          referenceAreaM2: 0.06 * 0.06,
          referenceVelocityMS: 0.8
        };
      }
    },
    {
      id: 'TC-CFD-B03',
      category: 'B_CONSERVATION',
      title: 'Energy Conservation Audit & Thermal Coupling Verification',
      description: 'Audits presence of coupled energy equation; records status honestly as UNPROVEN if uncoupled.',
      expectedVerdict: 'UNPROVEN',
      setup: () => {
        const mesh = Fvm3DMeshGenerator.generate3DBlockMesh(
          'energy_b03',
          0.4, 0.04, 0.04,
          6, 4, 2,
          'INLET', 'OUTLET', 'WALL', 'SYMMETRY',
          { x: 1.0, y: 0, z: 0 }, 0.0
        );
        return {
          mesh,
          fluid: { densityKgM3: 1.225, viscosityPaS: 0.001 },
          config: {
            maxIterations: 20,
            continuityTol: 1e-3,
            momentumTol: 1e-3,
            underRelaxationVelocity: 0.7,
            underRelaxationPressure: 0.3,
            useTurbulenceModel: false,
            turbulenceScheme: 'LAMINAR',
            upwindScheme: 'FIRST_ORDER_UPWIND'
          },
          referenceAreaM2: 0.04 * 0.04,
          referenceVelocityMS: 1.0
        };
      }
    },

    // -------------------------------------------------------------
    // CATEGORY C: Convergence
    // -------------------------------------------------------------
    {
      id: 'TC-CFD-C01',
      category: 'C_CONVERGENCE',
      title: 'Monotonic Residual Decay in SIMPLE Predictor-Corrector',
      description: 'Evaluates residual trajectory to verify monotonic reduction of continuity and momentum defects.',
      expectedVerdict: 'PASS',
      setup: () => {
        const mesh = Fvm3DMeshGenerator.generate3DBlockMesh(
          'conv_c01',
          0.5, 0.05, 0.05,
          10, 6, 4,
          'INLET', 'OUTLET', 'WALL', 'SYMMETRY',
          { x: 0.5, y: 0, z: 0 }, 0.0
        );
        return {
          mesh,
          fluid: { densityKgM3: 1.225, viscosityPaS: 0.0005 },
          config: {
            maxIterations: 90,
            continuityTol: 1e-4,
            momentumTol: 1e-4,
            underRelaxationVelocity: 0.7,
            underRelaxationPressure: 0.3,
            useTurbulenceModel: false,
            turbulenceScheme: 'LAMINAR',
            upwindScheme: 'FIRST_ORDER_UPWIND'
          },
          referenceAreaM2: 0.05 * 0.05,
          referenceVelocityMS: 0.5
        };
      }
    },
    {
      id: 'TC-CFD-C02',
      category: 'C_CONVERGENCE',
      title: 'False-Convergence Protection Trap',
      description: 'Ensures solver will not emit false CONVERGED verdict when physical mass conservation is violated.',
      expectedVerdict: 'PASS',
      setup: () => {
        const mesh = Fvm3DMeshGenerator.generate3DBlockMesh(
          'conv_c02',
          0.4, 0.04, 0.04,
          8, 4, 4,
          'INLET', 'OUTLET', 'WALL', 'SYMMETRY',
          { x: 1.0, y: 0, z: 0 }, 0.0
        );
        return {
          mesh,
          fluid: { densityKgM3: 1.225, viscosityPaS: 0.001 },
          config: {
            maxIterations: 60,
            continuityTol: 1e-4,
            momentumTol: 1e-4,
            underRelaxationVelocity: 0.7,
            underRelaxationPressure: 0.3,
            useTurbulenceModel: false,
            turbulenceScheme: 'LAMINAR',
            upwindScheme: 'FIRST_ORDER_UPWIND'
          },
          referenceAreaM2: 0.04 * 0.04,
          referenceVelocityMS: 1.0
        };
      }
    },

    // -------------------------------------------------------------
    // CATEGORY D: Mesh Independence
    // -------------------------------------------------------------
    {
      id: 'TC-CFD-D01',
      category: 'D_MESH_INDEPENDENCE',
      title: 'Grid Independence & Monotonic Refinement Study',
      description: 'Executes coarse (64 cells), medium (512 cells), and fine (1,728 cells) grids and computes Grid Sensitivity Index.',
      expectedVerdict: 'PASS',
      setup: () => {
        const mesh = Fvm3DMeshGenerator.generate3DBlockMesh(
          'mesh_d01',
          0.6, 0.06, 0.06,
          12, 6, 4,
          'INLET', 'OUTLET', 'WALL', 'SYMMETRY',
          { x: 0.5, y: 0, z: 0 }, 0.0
        );
        return {
          mesh,
          fluid: { densityKgM3: 1.225, viscosityPaS: 0.0005 },
          config: {
            maxIterations: 80,
            continuityTol: 1e-4,
            momentumTol: 1e-4,
            underRelaxationVelocity: 0.7,
            underRelaxationPressure: 0.3,
            useTurbulenceModel: false,
            turbulenceScheme: 'LAMINAR',
            upwindScheme: 'FIRST_ORDER_UPWIND'
          },
          referenceAreaM2: 0.06 * 0.06,
          referenceVelocityMS: 0.5
        };
      }
    },

    // -------------------------------------------------------------
    // CATEGORY E: Boundary Conditions
    // -------------------------------------------------------------
    {
      id: 'TC-CFD-E01',
      category: 'E_BOUNDARY_CONDITIONS',
      title: 'Conjugate Velocity Inlet & Pressure Outlet Pair',
      description: 'Verifies proper Dirichlet-Neumann velocity-pressure conditioning and Rhie-Chow pressure decoupling.',
      expectedVerdict: 'PASS',
      setup: () => {
        const mesh = Fvm3DMeshGenerator.generate3DBlockMesh(
          'bc_e01',
          0.5, 0.05, 0.05,
          10, 6, 4,
          'INLET', 'OUTLET', 'WALL', 'SYMMETRY',
          { x: 2.0, y: 0, z: 0 }, 0.0
        );
        return {
          mesh,
          fluid: { densityKgM3: 1.225, viscosityPaS: 0.001 },
          config: {
            maxIterations: 70,
            continuityTol: 1e-4,
            momentumTol: 1e-4,
            underRelaxationVelocity: 0.7,
            underRelaxationPressure: 0.3,
            useTurbulenceModel: false,
            turbulenceScheme: 'LAMINAR',
            upwindScheme: 'FIRST_ORDER_UPWIND'
          },
          referenceAreaM2: 0.05 * 0.05,
          referenceVelocityMS: 2.0
        };
      }
    },
    {
      id: 'TC-CFD-E02',
      category: 'E_BOUNDARY_CONDITIONS',
      title: 'Symmetry Plane Zero-Gradient Boundary Verification',
      description: 'Verifies zero normal mass flux and zero normal velocity gradient across lateral symmetry boundaries.',
      expectedVerdict: 'PASS',
      setup: () => {
        const mesh = Fvm3DMeshGenerator.generate3DBlockMesh(
          'bc_e02',
          0.5, 0.05, 0.05,
          8, 6, 4,
          'INLET', 'OUTLET', 'WALL', 'SYMMETRY',
          { x: 1.0, y: 0, z: 0 }, 0.0
        );
        return {
          mesh,
          fluid: { densityKgM3: 1.225, viscosityPaS: 0.001 },
          config: {
            maxIterations: 60,
            continuityTol: 1e-4,
            momentumTol: 1e-4,
            underRelaxationVelocity: 0.7,
            underRelaxationPressure: 0.3,
            useTurbulenceModel: false,
            turbulenceScheme: 'LAMINAR',
            upwindScheme: 'FIRST_ORDER_UPWIND'
          },
          referenceAreaM2: 0.05 * 0.05,
          referenceVelocityMS: 1.0
        };
      }
    },

    // -------------------------------------------------------------
    // CATEGORY F: Numerical Stability
    // -------------------------------------------------------------
    {
      id: 'TC-CFD-F01',
      category: 'F_NUMERICAL_STABILITY',
      title: 'Moderate Reynolds Number Laminar Stability',
      description: 'Evaluates solver numerical stability and diagonal dominance at Reynolds number Re = 500.',
      expectedVerdict: 'PASS',
      setup: () => {
        const mesh = Fvm3DMeshGenerator.generate3DBlockMesh(
          'stab_f01',
          0.5, 0.05, 0.05,
          12, 6, 4,
          'INLET', 'OUTLET', 'WALL', 'SYMMETRY',
          { x: 5.0, y: 0, z: 0 }, 0.0
        );
        return {
          mesh,
          fluid: { densityKgM3: 1.225, viscosityPaS: 0.0006 }, // Re ~ 500
          config: {
            maxIterations: 80,
            continuityTol: 1e-3,
            momentumTol: 1e-3,
            underRelaxationVelocity: 0.7,
            underRelaxationPressure: 0.3,
            useTurbulenceModel: false,
            turbulenceScheme: 'LAMINAR',
            upwindScheme: 'FIRST_ORDER_UPWIND'
          },
          referenceAreaM2: 0.05 * 0.05,
          referenceVelocityMS: 5.0
        };
      }
    },

    // -------------------------------------------------------------
    // CATEGORY G: Adversarial CFD
    // -------------------------------------------------------------
    {
      id: 'TC-CFD-G01',
      category: 'G_ADVERSARIAL_CFD',
      title: 'Adversarial Pathological Input & Degeneracy Rejection',
      description: 'Injects unphysical density, zero viscosity, inverted volume, and malformed BCs; verifies diagnostic safety.',
      expectedVerdict: 'PASS',
      setup: () => {
        const mesh = Fvm3DMeshGenerator.generate3DBlockMesh(
          'adv_g01',
          0.4, 0.04, 0.04,
          6, 4, 2,
          'INLET', 'OUTLET', 'WALL', 'SYMMETRY',
          { x: 1.0, y: 0, z: 0 }, 0.0
        );
        return {
          mesh,
          fluid: { densityKgM3: 1.225, viscosityPaS: 0.001 },
          config: {
            maxIterations: 40,
            continuityTol: 1e-3,
            momentumTol: 1e-3,
            underRelaxationVelocity: 0.7,
            underRelaxationPressure: 0.3,
            useTurbulenceModel: false,
            turbulenceScheme: 'LAMINAR',
            upwindScheme: 'FIRST_ORDER_UPWIND'
          },
          referenceAreaM2: 0.04 * 0.04,
          referenceVelocityMS: 1.0
        };
      }
    },

    // -------------------------------------------------------------
    // CATEGORY H: Determinism & Reproducibility
    // -------------------------------------------------------------
    {
      id: 'TC-CFD-H01',
      category: 'H_DETERMINISM_REPRODUCIBILITY',
      title: 'Multi-Pass Bit-Exact Solution State Invariance',
      description: 'Executes repeat solutions on identical grids and verifies 0.00% numerical drift across all cell values.',
      expectedVerdict: 'PASS',
      setup: () => {
        const mesh = Fvm3DMeshGenerator.generate3DBlockMesh(
          'det_h01',
          0.4, 0.04, 0.04,
          8, 4, 4,
          'INLET', 'OUTLET', 'WALL', 'SYMMETRY',
          { x: 0.8, y: 0, z: 0 }, 0.0
        );
        return {
          mesh,
          fluid: { densityKgM3: 1.225, viscosityPaS: 0.0005 },
          config: {
            maxIterations: 50,
            continuityTol: 1e-4,
            momentumTol: 1e-4,
            underRelaxationVelocity: 0.7,
            underRelaxationPressure: 0.3,
            useTurbulenceModel: false,
            turbulenceScheme: 'LAMINAR',
            upwindScheme: 'FIRST_ORDER_UPWIND'
          },
          referenceAreaM2: 0.04 * 0.04,
          referenceVelocityMS: 0.8
        };
      }
    },

    // -------------------------------------------------------------
    // CATEGORY I: Performance
    // -------------------------------------------------------------
    {
      id: 'TC-CFD-I01',
      category: 'I_PERFORMANCE',
      title: 'Measured Wall-Clock Scalability across 4 Grid Scales',
      description: 'Measures real execution time and time per iteration from 64 to 4,096 cells without synthetic timers.',
      expectedVerdict: 'PASS',
      setup: () => {
        const mesh = Fvm3DMeshGenerator.generate3DBlockMesh(
          'perf_i01',
          0.5, 0.05, 0.05,
          8, 6, 4,
          'INLET', 'OUTLET', 'WALL', 'SYMMETRY',
          { x: 1.0, y: 0, z: 0 }, 0.0
        );
        return {
          mesh,
          fluid: { densityKgM3: 1.225, viscosityPaS: 0.001 },
          config: {
            maxIterations: 40,
            continuityTol: 1e-4,
            momentumTol: 1e-4,
            underRelaxationVelocity: 0.7,
            underRelaxationPressure: 0.3,
            useTurbulenceModel: false,
            turbulenceScheme: 'LAMINAR',
            upwindScheme: 'FIRST_ORDER_UPWIND'
          },
          referenceAreaM2: 0.05 * 0.05,
          referenceVelocityMS: 1.0
        };
      }
    },

    // -------------------------------------------------------------
    // CATEGORY J: Regression Protection
    // -------------------------------------------------------------
    {
      id: 'TC-CFD-J01',
      category: 'J_REGRESSION',
      title: 'Historical CFD Suite (SECP-082) Canonical Verification',
      description: 'Ensures full backward compatibility with PATCH-082 3D Poiseuille, Cavity, and Mesh Verification batteries.',
      expectedVerdict: 'PASS',
      setup: () => {
        const mesh = Fvm3DMeshGenerator.generate3DBlockMesh(
          'reg_j01',
          0.5, 0.05, 0.05,
          10, 6, 4,
          'INLET', 'OUTLET', 'WALL', 'SYMMETRY',
          { x: 0.5, y: 0, z: 0 }, 0.0
        );
        return {
          mesh,
          fluid: { densityKgM3: 1.225, viscosityPaS: 0.0005 },
          config: {
            maxIterations: 70,
            continuityTol: 1e-4,
            momentumTol: 1e-4,
            underRelaxationVelocity: 0.7,
            underRelaxationPressure: 0.3,
            useTurbulenceModel: false,
            turbulenceScheme: 'LAMINAR',
            upwindScheme: 'FIRST_ORDER_UPWIND'
          },
          referenceAreaM2: 0.05 * 0.05,
          referenceVelocityMS: 0.5
        };
      }
    }
  ];

  public static getCases(): CFDBenchmarkCaseDefinition[] {
    return this.cases;
  }

  public static getCaseById(id: string): CFDBenchmarkCaseDefinition | undefined {
    return this.cases.find(c => c.id === id);
  }
}
