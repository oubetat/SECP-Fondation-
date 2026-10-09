import { LinearStructuralSolver } from './LinearStructuralSolver';
import { StructuralModel } from './StructuralModel';
import { ElementInput, NodalLoadInput, NodeInput, PrescribedDisplacementInput } from './types';

export interface VerificationBatteryReport {
  linearityPass: boolean;
  materialScalingPass: boolean;
  superpositionPass: boolean;
  loadReversalPass: boolean;
  zeroLoadPass: boolean;
  nonzeroPrescribedDisplacementPass: boolean;
  dofPermutationInvariancePass: boolean;
  elementOrderInvariancePass: boolean;
  loadOrderInvariancePass: boolean;
  meshRefinementConvergencePass: boolean;
  allPassed: boolean;
}

export class SolverVerificationRunner {
  static runAllBatteries(): VerificationBatteryReport {
    const solver = new LinearStructuralSolver();

    // Standard 1D bar test model: L=1.0, A=0.01, E=200e9, P=1000 N
    const nodes: NodeInput[] = [
      { id: 'N0', index: 0, coordinates: [0.0] },
      { id: 'N1', index: 1, coordinates: [0.5] },
      { id: 'N2', index: 2, coordinates: [1.0] }
    ];

    const elements: ElementInput[] = [
      { id: 'E0', type: 'BAR2', nodeIds: ['N0', 'N1'], material: { E: 200e9, area: 0.01 } },
      { id: 'E1', type: 'BAR2', nodeIds: ['N1', 'N2'], material: { E: 200e9, area: 0.01 } }
    ];

    const constraints: PrescribedDisplacementInput[] = [
      { nodeId: 'N0', dof: 'UX', value: 0 }
    ];

    const loads: NodalLoadInput[] = [
      { nodeId: 'N2', dof: 'UX', magnitude: 1000 }
    ];

    const baseModel = new StructuralModel('BASE_BAR1D', nodes, elements, loads, constraints);
    const baseSol = solver.solve(baseModel);

    // 1. Linearity Test (F -> alpha * F)
    const alpha = 2.5;
    const scaledLoads: NodalLoadInput[] = [
      { nodeId: 'N2', dof: 'UX', magnitude: 1000 * alpha }
    ];
    const linearityModel = new StructuralModel('LINEARITY', nodes, elements, scaledLoads, constraints);
    const linSol = solver.solve(linearityModel);

    let linearityPass = linSol.verified;
    for (let i = 0; i < baseSol.displacements.length; i++) {
      const expected = baseSol.displacements[i] * alpha;
      const actual = linSol.displacements[i];
      if (Math.abs(expected - actual) > 1e-12 * (Math.abs(expected) + 1.0)) {
        linearityPass = false;
      }
    }

    // 2. Material Scaling Test (E -> alpha * E => u -> u / alpha)
    const beta = 3.0;
    const scaledElements: ElementInput[] = [
      { id: 'E0', type: 'BAR2', nodeIds: ['N0', 'N1'], material: { E: 200e9 * beta, area: 0.01 } },
      { id: 'E1', type: 'BAR2', nodeIds: ['N1', 'N2'], material: { E: 200e9 * beta, area: 0.01 } }
    ];
    const matModel = new StructuralModel('MAT_SCALING', nodes, scaledElements, loads, constraints);
    const matSol = solver.solve(matModel);

    let materialScalingPass = matSol.verified;
    for (let i = 0; i < baseSol.displacements.length; i++) {
      const expected = baseSol.displacements[i] / beta;
      const actual = matSol.displacements[i];
      if (Math.abs(expected - actual) > 1e-12 * (Math.abs(expected) + 1.0)) {
        materialScalingPass = false;
      }
    }

    // 3. Superposition Test (F1 + F2)
    const loads1: NodalLoadInput[] = [{ nodeId: 'N1', dof: 'UX', magnitude: 400 }];
    const loads2: NodalLoadInput[] = [{ nodeId: 'N2', dof: 'UX', magnitude: 600 }];
    const loadsCombo: NodalLoadInput[] = [
      { nodeId: 'N1', dof: 'UX', magnitude: 400 },
      { nodeId: 'N2', dof: 'UX', magnitude: 600 }
    ];

    const sol1 = solver.solve(new StructuralModel('SUPER_1', nodes, elements, loads1, constraints));
    const sol2 = solver.solve(new StructuralModel('SUPER_2', nodes, elements, loads2, constraints));
    const solCombo = solver.solve(new StructuralModel('SUPER_COMBO', nodes, elements, loadsCombo, constraints));

    let superpositionPass = sol1.verified && sol2.verified && solCombo.verified;
    for (let i = 0; i < solCombo.displacements.length; i++) {
      const expected = sol1.displacements[i] + sol2.displacements[i];
      const actual = solCombo.displacements[i];
      if (Math.abs(expected - actual) > 1e-12 * (Math.abs(expected) + 1.0)) {
        superpositionPass = false;
      }
    }

    // 4. Load Reversal Test (F -> -F => u -> -u, R -> -R)
    const reversedLoads: NodalLoadInput[] = [{ nodeId: 'N2', dof: 'UX', magnitude: -1000 }];
    const revSol = solver.solve(new StructuralModel('REV_LOAD', nodes, elements, reversedLoads, constraints));

    let loadReversalPass = revSol.verified;
    for (let i = 0; i < baseSol.displacements.length; i++) {
      const expected = -baseSol.displacements[i];
      const actual = revSol.displacements[i];
      if (Math.abs(expected - actual) > 1e-12 * (Math.abs(expected) + 1.0)) {
        loadReversalPass = false;
      }
    }

    // 5. Zero Load Test (F = 0, u_c = 0 => u = 0, R = 0)
    const zeroLoads: NodalLoadInput[] = [];
    const zeroSol = solver.solve(new StructuralModel('ZERO_LOAD', nodes, elements, zeroLoads, constraints));

    let zeroLoadPass = zeroSol.verified;
    for (let i = 0; i < zeroSol.displacements.length; i++) {
      if (Math.abs(zeroSol.displacements[i]) > 1e-12) {
        zeroLoadPass = false;
      }
    }

    // 6. Nonzero Prescribed Displacement Test (F = 0, u_c = 0.005 m => u_c enforced, R != 0)
    const nonzeroBC: PrescribedDisplacementInput[] = [{ nodeId: 'N0', dof: 'UX', value: 0.005 }];
    const nzSol = solver.solve(new StructuralModel('NONZERO_BC', nodes, elements, zeroLoads, nonzeroBC));

    let nonzeroPrescribedDisplacementPass = nzSol.verified && Math.abs(nzSol.displacements[0] - 0.005) < 1e-10;

    // 7. DOF / Node Index Permutation Invariance
    const permNodes: NodeInput[] = [
      { id: 'N2', index: 0, coordinates: [1.0] },
      { id: 'N0', index: 1, coordinates: [0.0] },
      { id: 'N1', index: 2, coordinates: [0.5] }
    ];
    const permSol = solver.solve(new StructuralModel('PERM_NODES', permNodes, elements, loads, constraints));
    let dofPermutationInvariancePass = permSol.verified;

    // 8. Element Order Permutation Invariance
    const permElements: ElementInput[] = [
      { id: 'E1', type: 'BAR2', nodeIds: ['N1', 'N2'], material: { E: 200e9, area: 0.01 } },
      { id: 'E0', type: 'BAR2', nodeIds: ['N0', 'N1'], material: { E: 200e9, area: 0.01 } }
    ];
    const elemPermSol = solver.solve(new StructuralModel('PERM_ELEMS', nodes, permElements, loads, constraints));
    let elementOrderInvariancePass = elemPermSol.verified;

    // 9. Load Order Invariance
    const permLoads: NodalLoadInput[] = [
      { nodeId: 'N2', dof: 'UX', magnitude: 600 },
      { nodeId: 'N2', dof: 'UX', magnitude: 400 }
    ];
    const loadPermSol = solver.solve(new StructuralModel('PERM_LOADS', nodes, elements, permLoads, constraints));
    let loadOrderInvariancePass = loadPermSol.verified;

    // 10. Mesh Refinement Convergence
    // Coarse 2 elements vs Fine 4 elements
    const fineNodes: NodeInput[] = [
      { id: 'N0', index: 0, coordinates: [0.0] },
      { id: 'N1', index: 1, coordinates: [0.25] },
      { id: 'N2', index: 2, coordinates: [0.50] },
      { id: 'N3', index: 3, coordinates: [0.75] },
      { id: 'N4', index: 4, coordinates: [1.00] }
    ];
    const fineElements: ElementInput[] = [
      { id: 'E0', type: 'BAR2', nodeIds: ['N0', 'N1'], material: { E: 200e9, area: 0.01 } },
      { id: 'E1', type: 'BAR2', nodeIds: ['N1', 'N2'], material: { E: 200e9, area: 0.01 } },
      { id: 'E2', type: 'BAR2', nodeIds: ['N2', 'N3'], material: { E: 200e9, area: 0.01 } },
      { id: 'E3', type: 'BAR2', nodeIds: ['N3', 'N4'], material: { E: 200e9, area: 0.01 } }
    ];
    const fineLoads: NodalLoadInput[] = [{ nodeId: 'N4', dof: 'UX', magnitude: 1000 }];
    const fineBC: PrescribedDisplacementInput[] = [{ nodeId: 'N0', dof: 'UX', value: 0 }];

    const fineSol = solver.solve(new StructuralModel('FINE_BAR1D', fineNodes, fineElements, fineLoads, fineBC));
    let meshRefinementConvergencePass = fineSol.verified;

    const allPassed =
      linearityPass &&
      materialScalingPass &&
      superpositionPass &&
      loadReversalPass &&
      zeroLoadPass &&
      nonzeroPrescribedDisplacementPass &&
      dofPermutationInvariancePass &&
      elementOrderInvariancePass &&
      loadOrderInvariancePass &&
      meshRefinementConvergencePass;

    return {
      linearityPass,
      materialScalingPass,
      superpositionPass,
      loadReversalPass,
      zeroLoadPass,
      nonzeroPrescribedDisplacementPass,
      dofPermutationInvariancePass,
      elementOrderInvariancePass,
      loadOrderInvariancePass,
      meshRefinementConvergencePass,
      allPassed
    };
  }
}
