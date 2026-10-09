import { describe, it, expect, beforeEach } from 'vitest';
import { KinematicState } from '../KinematicState';
import { createKinematicBody } from '../KinematicBody';
import { KinematicJoint } from '../KinematicJointModel';
import { KinematicAssemblyEngine } from '../KinematicAssemblyEngine';
import { KinematicTransactionManager } from '../KinematicTransaction';

function makeFrame(origin = { x: 0, y: 0, z: 0 }) {
  return {
    origin,
    primaryAxis: { x: 0, y: 0, z: 1 },
    secondaryAxis: { x: 1, y: 0, z: 0 },
  };
}

describe('KinematicTransaction ACID Tests', () => {
  beforeEach(() => {
    KinematicTransactionManager.clearHistory();
  });

  it('TEST 18: should commit valid motion command and advance revision ID', () => {
    const state = new KinematicState('ASSY-TX-1', 'REV-0');
    const ground = createKinematicBody('B1', 'comp1', true);
    const arm = createKinematicBody('B2', 'comp2', false);

    state.addBody(ground);
    state.addBody(arm);

    const joint: KinematicJoint = {
      jointId: 'J1',
      assemblyId: 'ASSY-TX-1',
      parentBodyId: 'B1',
      childBodyId: 'B2',
      jointType: 'REVOLUTE',
      parentFrame: makeFrame(),
      childFrame: makeFrame(),
      parameters: { axis: { x: 0, y: 0, z: 1 } },
      limits: { min: -180, max: 180 },
      position: 0,
      tolerance: 1e-4,
      enabled: true,
      suppressed: false,
      createdAt: new Date().toISOString(),
    };
    state.addJoint(joint);

    const res = KinematicAssemblyEngine.applyMotionCommand(state, {
      jointId: 'J1',
      targetPosition: 45,
      requestedAt: new Date().toISOString(),
      parentRevisionId: 'REV-0',
    });

    expect(res.success).toBe(true);
    expect(res.result.status).toBe('CONVERGED_WITH_REMAINING_DOF');
    expect(state.revisionId).toBe('REV-1');
    expect(state.getJoint('J1')?.position).toBe(45);
  });

  it('TEST 18 (cont): should rollback failed motion command leaving state pristine', () => {
    const state = new KinematicState('ASSY-TX-2', 'REV-5');
    const ground = createKinematicBody('B1', 'comp1', true);
    const arm = createKinematicBody('B2', 'comp2', false);

    state.addBody(ground);
    state.addBody(arm);

    const joint: KinematicJoint = {
      jointId: 'J1',
      assemblyId: 'ASSY-TX-2',
      parentBodyId: 'B1',
      childBodyId: 'B2',
      jointType: 'REVOLUTE',
      parentFrame: makeFrame(),
      childFrame: makeFrame(),
      parameters: { axis: { x: 0, y: 0, z: 1 } },
      limits: { min: -45, max: 45 },
      position: 10,
      tolerance: 1e-4,
      enabled: true,
      suppressed: false,
      createdAt: new Date().toISOString(),
    };
    state.addJoint(joint);

    // Initial solve to establish base transform
    KinematicAssemblyEngine.solveForwardKinematics(state);
    const baseTransform = JSON.parse(JSON.stringify(state.getBody('B2')!.worldTransform));

    // Attempt illegal motion exceeding limit
    const res = KinematicAssemblyEngine.applyMotionCommand(state, {
      jointId: 'J1',
      targetPosition: 120, // Exceeds max limit 45
      requestedAt: new Date().toISOString(),
      parentRevisionId: 'REV-5',
    });

    expect(res.success).toBe(false);
    expect(res.result.status).toBe('LIMIT_VIOLATION');
    expect(state.revisionId).toBe('REV-5'); // Revision not changed
    expect(state.getJoint('J1')?.position).toBe(10); // Position reverted
    expect(state.getBody('B2')?.worldTransform).toEqual(baseTransform); // Transform untouched
  });
});
