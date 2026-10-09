/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Boundary Condition Analytical Test Suite
 */

import { describe, it, expect } from 'vitest';
import { CFDMesh3D } from '../../mesh/CFDMeshTypes';
import { BoundaryPatch } from '../BoundaryPatch';
import { VelocityBoundaryCondition } from '../VelocityBoundaryCondition';
import { PressureBoundaryCondition } from '../PressureBoundaryCondition';
import { TemperatureBoundaryCondition } from '../TemperatureBoundaryCondition';
import { WallBoundaryCondition } from '../WallBoundaryCondition';
import { SymmetryBoundaryCondition } from '../SymmetryBoundaryCondition';
import { InletBoundaryCondition } from '../InletBoundaryCondition';
import { PeriodicBoundaryCondition } from '../PeriodicBoundaryCondition';
import { BoundaryConditionDiscretizer } from '../BoundaryConditionDiscretizer';
import {
  BoundaryConditionType,
  PhysicsDomain,
  WallMotionType,
  VelocityBehaviorType,
  ThermalBehaviorType,
  BoundaryDiagnosticCode
} from '../BoundaryConditionTypes';

describe('PATCH-060: Boundary Condition Analytical Cases', () => {
  const mesh: CFDMesh3D = {
    cells: [{ id: 0, faceIds: [0, 1], volume: 1, center: [0.5, 0.5, 0.5], neighbors: [] }],
    faces: [
      { id: 0, area: 1, normal: [-1, 0, 0], center: [0, 0.5, 0.5], ownerCellId: 0, neighborCellId: null, isBoundary: true },
      { id: 1, area: 1, normal: [1, 0, 0], center: [1, 0.5, 0.5], ownerCellId: 0, neighborCellId: null, isBoundary: true }
    ],
    nodes: [], boundaryConditions: [], metadata: { name: 'test-mesh-060', description: '' }
  };

  const patchInlet = new BoundaryPatch('patch-inlet', 'Inlet', [0], 1, [-1, 0, 0]);
  const patchOutlet = new BoundaryPatch('patch-outlet', 'Outlet', [1], 1, [1, 0, 0]);

  it('CASE A — Fixed velocity inlet: u_face = u_boundary', () => {
    const velBC = new VelocityBoundaryCondition('bc-inlet', 'patch-inlet', BoundaryConditionType.VELOCITY_INLET, [2.5, 0, 0]);
    expect(velBC.validate().valid).toBe(true);
    expect(velBC.parameters.value).toEqual([2.5, 0, 0]);

    const disc = BoundaryConditionDiscretizer.discretizeBoundaryFace(mesh.faces[0], patchInlet, velBC, 1.2);
    // Flux = rho * (u . n) * A = 1.2 * (-2.5) * 1 = -3.0
    expect(disc.faceFlux).toBeCloseTo(-3.0, 6);
  });

  it('CASE B — No-slip stationary wall: u_wall = 0', () => {
    const wall = new WallBoundaryCondition('wall-stat', 'patch-inlet', WallMotionType.STATIC, VelocityBehaviorType.NO_SLIP);
    expect(wall.validate().valid).toBe(true);
    expect(wall.getWallVelocityAtPoint([0, 0.5, 0.5])).toEqual([0, 0, 0]);
  });

  it('CASE C — Moving wall: u_wall = u_wall_velocity (not zero)', () => {
    const wall = new WallBoundaryCondition('wall-mov', 'patch-inlet', WallMotionType.MOVING_TRANSLATIONAL, VelocityBehaviorType.SPECIFIED_VELOCITY, ThermalBehaviorType.ADIABATIC, {
      translationalVelocity: [5, 0, 0]
    });
    expect(wall.validate().valid).toBe(true);
    expect(wall.getWallVelocityAtPoint([0, 0.5, 0.5])).toEqual([5, 0, 0]);
  });

  it('CASE D — Fixed pressure: p_face = p_boundary', () => {
    const pressBC = new PressureBoundaryCondition('press-fix', 'patch-outlet', BoundaryConditionType.FIXED_PRESSURE, 101325);
    expect(pressBC.validate().valid).toBe(true);
    expect(pressBC.parameters.value).toBe(101325);
  });

  it('CASE E — Adiabatic wall: q . n = 0', () => {
    const tempBC = new TemperatureBoundaryCondition('temp-ad', 'patch-inlet', BoundaryConditionType.ADIABATIC_WALL);
    expect(tempBC.validate().valid).toBe(true);
  });

  it('CASE F — Fixed heat flux: q . n = q_boundary', () => {
    const tempBC = new TemperatureBoundaryCondition('temp-q', 'patch-inlet', BoundaryConditionType.FIXED_HEAT_FLUX, undefined, 500);
    expect(tempBC.validate().valid).toBe(true);
    expect(tempBC.parameters.heatFlux).toBe(500);
  });

  it('CASE G — Symmetry: u . n = 0', () => {
    const sym = new SymmetryBoundaryCondition('sym-01', 'patch-inlet');
    const uSym = sym.enforceSymmetryVelocity([1, 2, 3], [-1, 0, 0]);
    // Normal component (-1 * 1 = -1) removed: u_sym = [1 - (-1)(-1), 2, 3] = [0, 2, 3]
    expect(uSym[0]).toBeCloseTo(0, 6);
    expect(uSym[1]).toBeCloseTo(2, 6);
    expect(uSym[2]).toBeCloseTo(3, 6);
  });

  it('CASE H — Periodic pair: master <-> slave face mapping', () => {
    const per = new PeriodicBoundaryCondition('per-01', 'patch-inlet', 'patch-outlet', [1, 0, 0], [{ masterFaceId: 0, slaveFaceId: 1 }]);
    const val = per.validateMapping(patchInlet, patchOutlet);
    expect(val.valid).toBe(true);
  });

  it('CASE I — Deliberate conflicting BC: velocity and mass flow mismatch', () => {
    const inlet = new InletBoundaryCondition('inlet-conflict', 'patch-inlet', BoundaryConditionType.VELOCITY_INLET, {
      velocity: [10, 0, 0], // 10 m/s * 1 m^2 * 1.2 kg/m^3 = 12 kg/s
      massFlowRate: 50,     // Conflicting 50 kg/s
      density: 1.2
    });
    const res = inlet.validateConsistency(1.0);
    expect(res.valid).toBe(false);
    expect(res.code).toBe(BoundaryDiagnosticCode.CONFLICTING_BOUNDARY_CONDITIONS);
  });
});
