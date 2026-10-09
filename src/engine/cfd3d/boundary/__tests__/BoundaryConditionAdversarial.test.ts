/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-060: Boundary Condition Adversarial Test Battery (30 Cases)
 */

import { describe, it, expect } from 'vitest';
import { CFDMesh3D } from '../../mesh/CFDMeshTypes';
import { BoundaryPatch } from '../BoundaryPatch';
import { VelocityBoundaryCondition } from '../VelocityBoundaryCondition';
import { PressureBoundaryCondition } from '../PressureBoundaryCondition';
import { TemperatureBoundaryCondition } from '../TemperatureBoundaryCondition';
import { EnergyBoundaryCondition } from '../EnergyBoundaryCondition';
import { WallBoundaryCondition } from '../WallBoundaryCondition';
import { SymmetryBoundaryCondition } from '../SymmetryBoundaryCondition';
import { PeriodicBoundaryCondition } from '../PeriodicBoundaryCondition';
import { MixedBoundaryCondition } from '../MixedBoundaryCondition';
import { BoundaryConditionValidator } from '../BoundaryConditionValidator';
import { BoundaryConditionDiscretizer } from '../BoundaryConditionDiscretizer';
import { BoundaryConditionVerification } from '../BoundaryConditionVerification';
import {
  BoundaryConditionType,
  PhysicsDomain,
  WallMotionType,
  VelocityBehaviorType,
  ThermalBehaviorType,
  BoundaryDiagnosticCode
} from '../BoundaryConditionTypes';

describe('PATCH-060: Adversarial Test Battery (30 Cases)', () => {
  const mesh: CFDMesh3D = {
    cells: [{ id: 0, faceIds: [0, 1], volume: 1, center: [0.5, 0.5, 0.5], neighbors: [] }],
    faces: [
      { id: 0, area: 1, normal: [-1, 0, 0], center: [0, 0.5, 0.5], ownerCellId: 0, neighborCellId: null, isBoundary: true },
      { id: 1, area: 1, normal: [1, 0, 0], center: [1, 0.5, 0.5], ownerCellId: 0, neighborCellId: null, isBoundary: true }
    ],
    nodes: [], boundaryConditions: [], metadata: { name: 'adv-mesh-060', description: '' }
  };

  const patch0 = new BoundaryPatch('p0', 'P0', [0], 1, [-1, 0, 0]);
  const patch1 = new BoundaryPatch('p1', 'P1', [1], 1, [1, 0, 0]);

  it('1. missing boundary patch in mesh face lookup', () => {
    const badPatch = new BoundaryPatch('bad', 'Bad', [999], 1, [1, 0, 0]);
    expect(badPatch.validate(mesh).valid).toBe(false);
  });

  it('2. empty boundary patch', () => {
    const emptyPatch = new BoundaryPatch('empty', 'Empty', [], 0, [1, 0, 0]);
    expect(emptyPatch.validate(mesh).valid).toBe(false);
  });

  it('3. duplicate face in patch', () => {
    const dupPatch = new BoundaryPatch('dup', 'Dup', [0, 0], 2, [1, 0, 0]);
    expect(dupPatch.validate(mesh).valid).toBe(false);
  });

  it('4. internal face assigned as boundary', () => {
    const internalMesh: CFDMesh3D = {
      cells: [
        { id: 0, faceIds: [0], volume: 1, center: [0, 0, 0], neighbors: [1] },
        { id: 1, faceIds: [0], volume: 1, center: [1, 0, 0], neighbors: [0] }
      ],
      faces: [{ id: 0, area: 1, normal: [1, 0, 0], center: [0.5, 0, 0], ownerCellId: 0, neighborCellId: 1, isBoundary: false }],
      nodes: [], boundaryConditions: [], metadata: { name: 'int-mesh', description: '' }
    };
    const patchInt = new BoundaryPatch('p-int', 'Int', [0], 1, [1, 0, 0]);
    expect(patchInt.validate(internalMesh).valid).toBe(false);
  });

  it('5. zero-area face', () => {
    const zeroAreaMesh: CFDMesh3D = {
      cells: [{ id: 0, faceIds: [0], volume: 1, center: [0, 0, 0], neighbors: [] }],
      faces: [{ id: 0, area: 0, normal: [1, 0, 0], center: [0, 0, 0], ownerCellId: 0, neighborCellId: null, isBoundary: true }],
      nodes: [], boundaryConditions: [], metadata: { name: 'zero-mesh', description: '' }
    };
    const patchZero = new BoundaryPatch('p-zero', 'Zero', [0], 0, [1, 0, 0]);
    expect(patchZero.validate(zeroAreaMesh).valid).toBe(false);
  });

  it('6. invalid normal (NaN)', () => {
    const patchNaN = new BoundaryPatch('p-nan', 'NaN', [0], 1, [NaN, 0, 0]);
    expect(patchNaN.validate(mesh).valid).toBe(false);
  });

  it('7. zero normal vector', () => {
    const patchZeroN = new BoundaryPatch('p-zn', 'ZN', [0], 1, [0, 0, 0]);
    expect(patchZeroN.validate(mesh).valid).toBe(false);
  });

  it('8. reversed / non-unit normal magnitude', () => {
    const patchScaleN = new BoundaryPatch('p-sn', 'SN', [0], 1, [-5, 0, 0]);
    expect(patchScaleN.validate(mesh).valid).toBe(false);
  });

  it('9. NaN boundary value', () => {
    const velNaN = new VelocityBoundaryCondition('v-nan', 'p0', BoundaryConditionType.FIXED_VELOCITY, [NaN, 0, 0]);
    expect(velNaN.validate().valid).toBe(false);
  });

  it('10. Infinity boundary value', () => {
    const velInf = new VelocityBoundaryCondition('v-inf', 'p0', BoundaryConditionType.FIXED_VELOCITY, [Infinity, 0, 0]);
    expect(velInf.validate().valid).toBe(false);
  });

  it('11. negative temperature where disallowed', () => {
    const tempNeg = new TemperatureBoundaryCondition('t-neg', 'p0', BoundaryConditionType.FIXED_TEMPERATURE, -50);
    expect(tempNeg.validate().valid).toBe(false);
  });

  it('12. invalid pressure (non-finite)', () => {
    const pressNaN = new PressureBoundaryCondition('p-nan', 'p0', BoundaryConditionType.FIXED_PRESSURE, NaN);
    expect(pressNaN.validate().valid).toBe(false);
  });

  it('13. invalid velocity units', () => {
    const velUnits = new VelocityBoundaryCondition('v-units', 'p0', BoundaryConditionType.FIXED_VELOCITY, [1, 0, 0], PhysicsDomain.INCOMPRESSIBLE_NAVIER_STOKES, 'km/h');
    expect(velUnits.validate().valid).toBe(false);
  });

  it('14. dimension mismatch', () => {
    const tempBC = new TemperatureBoundaryCondition('t-dim', 'p0', BoundaryConditionType.FIXED_TEMPERATURE, 300, undefined, undefined, undefined, PhysicsDomain.HEAT_TRANSFER, 'm/s');
    expect(tempBC.validate().valid).toBe(false);
  });

  it('15. missing pressure reference in incompressible flow', () => {
    const velBC = new VelocityBoundaryCondition('v0', 'p0', BoundaryConditionType.VELOCITY_INLET, [1, 0, 0]);
    const res = BoundaryConditionValidator.validateSystem(mesh, [patch0, patch1], [velBC], PhysicsDomain.INCOMPRESSIBLE_NAVIER_STOKES);
    expect(res.codes).toContain(BoundaryDiagnosticCode.PRESSURE_REFERENCE_MISSING);
  });

  it('16. conflicting velocity conditions', () => {
    const vel1 = new VelocityBoundaryCondition('v1', 'p0', BoundaryConditionType.VELOCITY_INLET, [1, 0, 0]);
    const vel2 = new VelocityBoundaryCondition('v2', 'p0', BoundaryConditionType.FIXED_VELOCITY, [2, 0, 0]);
    const res = BoundaryConditionValidator.validateSystem(mesh, [patch0, patch1], [vel1, vel2]);
    expect(res.codes).toContain(BoundaryDiagnosticCode.OVERCONSTRAINED_BOUNDARY);
  });

  it('17. conflicting thermal conditions', () => {
    const temp1 = new TemperatureBoundaryCondition('t1', 'p0', BoundaryConditionType.FIXED_TEMPERATURE, 300);
    const temp2 = new TemperatureBoundaryCondition('t2', 'p0', BoundaryConditionType.FIXED_HEAT_FLUX, undefined, 500);
    const res = BoundaryConditionValidator.validateSystem(mesh, [patch0, patch1], [temp1, temp2]);
    expect(res.codes).toContain(BoundaryDiagnosticCode.OVERCONSTRAINED_BOUNDARY);
  });

  it('18. duplicate BC', () => {
    const vel1 = new VelocityBoundaryCondition('v1', 'p0', BoundaryConditionType.VELOCITY_INLET, [1, 0, 0]);
    const vel2 = new VelocityBoundaryCondition('v2', 'p0', BoundaryConditionType.VELOCITY_INLET, [1, 0, 0]);
    const res = BoundaryConditionValidator.validateSystem(mesh, [patch0, patch1], [vel1, vel2]);
    expect(res.codes).toContain(BoundaryDiagnosticCode.DUPLICATE_BOUNDARY_CONDITION);
  });

  it('19. unassigned boundary face', () => {
    const res = BoundaryConditionValidator.validateSystem(mesh, [patch0], []);
    expect(res.codes).toContain(BoundaryDiagnosticCode.UNASSIGNED_BOUNDARY_FACE);
  });

  it('20. over-constrained boundary', () => {
    const vel1 = new VelocityBoundaryCondition('v1', 'p0', BoundaryConditionType.VELOCITY_INLET, [1, 0, 0]);
    const vel2 = new VelocityBoundaryCondition('v2', 'p0', BoundaryConditionType.NO_SLIP_WALL, [0, 0, 0]);
    const res = BoundaryConditionValidator.validateSystem(mesh, [patch0, patch1], [vel1, vel2]);
    expect(res.codes).toContain(BoundaryDiagnosticCode.OVERCONSTRAINED_BOUNDARY);
  });

  it('21. under-constrained boundary', () => {
    const res = BoundaryConditionValidator.validateSystem(mesh, [patch0, patch1], []);
    expect(res.codes).toContain(BoundaryDiagnosticCode.UNDERCONSTRAINED_BOUNDARY_SYSTEM);
  });

  it('22. invalid periodic mapping (face count mismatch)', () => {
    const patchBig = new BoundaryPatch('pBig', 'Big', [0, 1], 2, [-1, 0, 0]);
    const per = new PeriodicBoundaryCondition('per-bad', 'p0', 'pBig', [1, 0, 0], [{ masterFaceId: 0, slaveFaceId: 1 }]);
    const val = per.validateMapping(patch0, patchBig);
    expect(val.valid).toBe(false);
  });

  it('23. mismatched periodic area', () => {
    const patchArea2 = new BoundaryPatch('pArea2', 'Area2', [1], 2, [1, 0, 0]);
    const per = new PeriodicBoundaryCondition('per-bad-area', 'p0', 'pArea2', [1, 0, 0], [{ masterFaceId: 0, slaveFaceId: 1 }]);
    const val = per.validateMapping(patch0, patchArea2);
    expect(val.valid).toBe(false);
  });

  it('24. incompatible material in energy BC', () => {
    const energyBC = new EnergyBoundaryCondition('e1', 'p0', BoundaryConditionType.ENERGY_CONSTRAINT, 100);
    const val = energyBC.validate({ specificHeatCv: 0, specificHeatCp: 0, density: 0 });
    expect(val.valid).toBe(false);
    expect(val.code).toBe(BoundaryDiagnosticCode.ENERGY_BC_UNPROVEN);
  });

  it('25. unsupported BC type for field', () => {
    const app = BoundaryConditionVerification.verifyBoundaryApplicability(
      new VelocityBoundaryCondition('v1', 'p0', BoundaryConditionType.FIXED_TEMPERATURE, [1, 0, 0] as any),
      'VELOCITY' as any,
      PhysicsDomain.INCOMPRESSIBLE_NAVIER_STOKES
    );
    expect(app.valid).toBe(false);
  });

  it('26. unsupported field type', () => {
    const app = BoundaryConditionVerification.verifyBoundaryApplicability(
      new VelocityBoundaryCondition('v1', 'p0', BoundaryConditionType.FIXED_VELOCITY, [1, 0, 0]),
      'UNKNOWN_FIELD' as any,
      PhysicsDomain.INCOMPRESSIBLE_NAVIER_STOKES
    );
    expect(app.valid).toBe(false);
  });

  it('27. missing discretization provenance', () => {
    const velBC = new VelocityBoundaryCondition('v1', 'p0', BoundaryConditionType.VELOCITY_INLET, [1, 0, 0]);
    const disc = BoundaryConditionDiscretizer.discretizeBoundaryFace(mesh.faces[0], patch0, velBC);
    const ver = BoundaryConditionVerification.verifyBoundaryDiscretization(
      new VelocityBoundaryCondition('v2', 'p0', BoundaryConditionType.VELOCITY_INLET, [1, 0, 0]),
      disc
    );
    expect(ver.valid).toBe(false);
  });

  it('28. boundary contribution mismatch', () => {
    const velBC = new VelocityBoundaryCondition('v1', 'p0', BoundaryConditionType.VELOCITY_INLET, [1, 0, 0]);
    const disc = BoundaryConditionDiscretizer.discretizeBoundaryFace(mesh.faces[0], patch0, velBC);
    const badDisc = { ...disc, faceFlux: 999 };
    const ver = BoundaryConditionVerification.verifyBoundaryRecomputation(velBC, mesh.faces[0], patch0, badDisc);
    expect(ver.valid).toBe(false);
  });

  it('29. recomputation mismatch', () => {
    const velBC = new VelocityBoundaryCondition('v1', 'p0', BoundaryConditionType.VELOCITY_INLET, [1, 0, 0]);
    const disc = BoundaryConditionDiscretizer.discretizeBoundaryFace(mesh.faces[0], patch0, velBC);
    const modifiedBC = new VelocityBoundaryCondition('v1', 'p0', BoundaryConditionType.VELOCITY_INLET, [50, 0, 0]);
    const ver = BoundaryConditionVerification.verifyBoundaryRecomputation(modifiedBC, mesh.faces[0], patch0, disc);
    expect(ver.valid).toBe(false);
  });

  it('30. nondeterministic ordering check', () => {
    const ver = BoundaryConditionVerification.verifyBoundaryDeterminism(patch0, new VelocityBoundaryCondition('v1', 'p0', BoundaryConditionType.VELOCITY_INLET, [1, 0, 0]));
    expect(ver.valid).toBe(true);
  });
});
