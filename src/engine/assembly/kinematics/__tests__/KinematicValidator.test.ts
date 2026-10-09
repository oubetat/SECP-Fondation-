import { describe, it, expect } from 'vitest';
import { createKinematicBody, createIdentityTransform } from '../KinematicBody';
import { KinematicJoint } from '../KinematicJointModel';
import { KinematicValidator } from '../KinematicValidator';

function makeFrame(origin = { x: 0, y: 0, z: 0 }) {
  return {
    origin,
    primaryAxis: { x: 0, y: 0, z: 1 },
    secondaryAxis: { x: 1, y: 0, z: 0 },
  };
}

describe('KinematicValidator Independent Verification Tests', () => {
  it('TEST 12: should validate orthogonal transforms and reject non-orthogonal matrices', () => {
    const validT = createIdentityTransform();
    const rep1 = KinematicValidator.validate4x4Transform(validT);
    expect(rep1.valid).toBe(true);

    // Corrupted non-orthogonal transform
    const invalidT = [
      [2, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    const rep2 = KinematicValidator.validate4x4Transform(invalidT);
    expect(rep2.valid).toBe(false);
  });

  it('TEST 13: should reject NaN and Infinity values injected into transforms', () => {
    const nanT = createIdentityTransform();
    nanT[0][3] = NaN;
    const repNaN = KinematicValidator.validate4x4Transform(nanT);
    expect(repNaN.valid).toBe(false);

    const infT = createIdentityTransform();
    infT[1][1] = Infinity;
    const repInf = KinematicValidator.validate4x4Transform(infT);
    expect(repInf.valid).toBe(false);
  });

  it('should detect contradictory multiple ground bodies in assembly', () => {
    const b1 = createKinematicBody('B1', 'comp1', true);
    const b2 = createKinematicBody('B2', 'comp2', true); // Contradictory second ground

    const report = KinematicValidator.validateAssemblyKinematics([b1, b2], []);
    expect(report.valid).toBe(false);
    expect(report.status).toBe('CONFLICT');
  });

  it('should detect disconnected bodies not reachable from ground body', () => {
    const b1 = createKinematicBody('B1', 'comp1', true);
    const b2 = createKinematicBody('B2', 'comp2', false); // Disconnected, no joint connecting it

    const report = KinematicValidator.validateAssemblyKinematics([b1, b2], []);
    expect(report.valid).toBe(false);
    expect(report.status).toBe('CONFLICT');
  });
});
