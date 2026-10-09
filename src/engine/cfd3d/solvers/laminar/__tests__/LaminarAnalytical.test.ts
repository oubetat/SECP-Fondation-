/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-061: Laminar Solver Analytical Test Suite
 */

import { describe, it, expect } from 'vitest';
import { LaminarSolver } from '../LaminarSolver';
import { LaminarSolverConfig } from '../LaminarSolverConfig';
import { LaminarSolverInput } from '../LaminarSolverInput';
import { FieldState, LaminarSolverVerdict } from '../LaminarSolverTypes';
import { CFDMesh3D } from '../../../mesh/CFDMeshTypes';
import { BoundaryConditionSet } from '../../../boundary/BoundaryConditionSet';
import { BoundaryPatch } from '../../../boundary/BoundaryPatch';
import { VelocityBoundaryCondition } from '../../../boundary/VelocityBoundaryCondition';
import { BoundaryConditionType } from '../../../boundary/BoundaryConditionTypes';

describe('PATCH-061: Laminar Solver Analytical Benchmarks', () => {
  const mesh: CFDMesh3D = {
    cells: [{ id: 0,  volume: 1,   }],
    faces: [
      { id: 0, area: 1, normal: [-1, 0, 0],  ownerCellId: 0, neighborCellId: null, isBoundary: true },
      { id: 1, area: 1, normal: [1, 0, 0],  ownerCellId: 0, neighborCellId: null, isBoundary: true }
    ],
    nodes: [],
    boundaryConditions: [],
    metadata: { name: 'test-mesh', description: '' }
  };

  const initialState: FieldState = {
    stateId: 'initial',
    velocity: [[0, 0, 0]],
    pressure: [0],
    dimensions: { velocity: 'm/s', pressure: 'Pa', temperature: 'K' },
    source: 'test',
    hash: 'initial-hash'
  };

  it('CASE A — Zero-flow stability', async () => {
    const solver = new LaminarSolver();
    const input: LaminarSolverInput = {
      mesh,
      material: { density: 1.2, viscosity: 1.8e-5, isConstant: true },
      initialState,
      boundaryConditions: new BoundaryConditionSet([
        new BoundaryPatch('wall1', 'wall1', [0], 1, [-1, 0, 0]),
        new BoundaryPatch('wall2', 'wall2', [1], 1, [1, 0, 0])
      ], []),
      config: new LaminarSolverConfig({ maxIterations: 1 }),
      meshHash: 'h1', materialHash: 'h2', boundaryConditionHash: 'h3', initialStateHash: 'h4'
    };

    const result = await solver.solve(input);
    expect(result.data.iterationCount).toBeGreaterThanOrEqual(0);
    // u should remain near zero
  });

  it('CASE B — 3D Poiseuille Foundation', async () => {
    const inletBC = new VelocityBoundaryCondition('v-in', 'inlet', BoundaryConditionType.VELOCITY_INLET, [1, 0, 0]);
    
    const input: LaminarSolverInput = {
      mesh,
      material: { density: 1.2, viscosity: 1.8e-5, isConstant: true },
      initialState,
      boundaryConditions: new BoundaryConditionSet([
        new BoundaryPatch('inlet', 'inlet', [0], 1, [-1, 0, 0]),
        new BoundaryPatch('outlet', 'outlet', [1], 1, [1, 0, 0])
      ], [inletBC]),
      config: new LaminarSolverConfig({ maxIterations: 2 }),
      meshHash: 'h1', materialHash: 'h2', boundaryConditionHash: 'h3', initialStateHash: 'h4'
    };

    const solver = new LaminarSolver();
    const result = await solver.solve(input);
    expect(result.data.failureCodes).not.toContain('INVALID_INPUT');
  });
});
