import { describe, expect, it } from 'vitest';
import { LinearStructuralSolver } from '../LinearStructuralSolver';
import { ReferenceStructuralSolve } from '../ReferenceStructuralSolve';
import { StructuralModel } from '../StructuralModel';
import { ElementInput, NodalLoadInput, NodeInput, PrescribedDisplacementInput } from '../types';

describe('LinearStructuralSolver & Physical Field Recovery', () => {
  it('correctly solves 1D Bar under tension and recovers exact displacements, reactions, and stresses', () => {
    const solver = new LinearStructuralSolver();

    const nodes: NodeInput[] = [
      { id: 'N0', index: 0, coordinates: [0.0] },
      { id: 'N1', index: 1, coordinates: [0.5] },
      { id: 'N2', index: 2, coordinates: [1.0] }
    ];

    const elements: ElementInput[] = [
      { id: 'E0', type: 'BAR2', nodeIds: ['N0', 'N1'], material: { E: 200e9, area: 0.01 } },
      { id: 'E1', type: 'BAR2', nodeIds: ['N1', 'N2'], material: { E: 200e9, area: 0.01 } }
    ];

    const loads: NodalLoadInput[] = [{ nodeId: 'N2', dof: 'UX', magnitude: 10000 }];
    const constraints: PrescribedDisplacementInput[] = [{ nodeId: 'N0', dof: 'UX', value: 0 }];

    const model = new StructuralModel('TEST_BAR1D', nodes, elements, loads, constraints);
    const result = solver.solve(model);

    expect(result.status).toBe('VERIFIED');
    expect(result.verdict).toBe('VERIFIED');
    expect(result.converged).toBe(true);
    expect(result.verified).toBe(true);

    // Analytical solution comparison
    const ref = ReferenceStructuralSolve.solveBar1D(1.0, 0.01, 200e9, 10000, 2);

    expect(result.displacements[0]).toBeCloseTo(0, 10);
    expect(result.displacements[2]).toBeCloseTo(ref.expectedDisplacements[2].value, 8);

    // Reaction
    expect(result.reactions[0].reactionForce).toBeCloseTo(-10000, 8);

    // Stress: sigma = 10000 / 0.01 = 1e6 Pa
    expect(result.elementResults[0].elementCenterStress[0]).toBeCloseTo(1e6, 4);
    expect(result.elementResults[1].elementCenterStress[0]).toBeCloseTo(1e6, 4);

    // Global strain energy: U = P^2 L / (2 E A) = (10000^2 * 1) / (2 * 200e9 * 0.01) = 0.025 J
    expect(result.energyMetrics.globalStrainEnergy).toBeCloseTo(0.025, 6);
  });

  it('correctly detects unconstrained rigid body mode (singular system)', () => {
    const solver = new LinearStructuralSolver();

    const nodes: NodeInput[] = [
      { id: 'N0', index: 0, coordinates: [0.0] },
      { id: 'N1', index: 1, coordinates: [1.0] }
    ];

    const elements: ElementInput[] = [
      { id: 'E0', type: 'BAR2', nodeIds: ['N0', 'N1'], material: { E: 200e9, area: 0.01 } }
    ];

    const loads: NodalLoadInput[] = [{ nodeId: 'N1', dof: 'UX', magnitude: 100 }];

    const model = new StructuralModel('TEST_RIGID_BODY', nodes, elements, loads, []);
    const result = solver.solve(model);

    expect(result.converged).toBe(false);
    expect(result.verified).toBe(false);
    expect(result.failureType).toBe('SINGULAR_SYSTEM');
  });
});
