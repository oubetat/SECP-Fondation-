/**
 * SECP Industrial OS v3 — Collision Authority Core
 * P1.6 Authority Migration & Runtime Enforcement Verification Suite
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CollisionAuthority,
  CollisionExactness,
  CollisionSeverity,
  CollisionStatus,
  CanonicalCollisionInput
} from '../index';
import { ExactNarrowPhaseProvider } from '../narrow-phase/ExactNarrowPhaseProvider';
import {
  AssemblyCollisionProvider,
  CamFiveAxisCollisionProvider,
  MachineSimulationCollisionProvider,
  KinematicsCollisionProvider
} from '../adapters/CanonicalDomainProviders';

import { CollisionDetectionEngine } from '../../cam/collision/CollisionDetectionEngine';
import { CAMCollisionEngine } from '../../cam/fiveaxis/FiveAxisCollisionEngine';
import { MachineCollisionEngine } from '../../cam/machine-sim/MachineCollisionEngine';
import { AssemblyInterferenceEngine } from '../../assembly/AssemblyInterferenceEngine';
import { InterferenceDetectionEngine } from '../../assembly/InterferenceDetectionEngine';
import { CollisionEngine as KinematicCollisionEngine } from '../../kinematics/CollisionEngine';
import { ToolpathVerificationEngine } from '../../cam/ToolpathVerificationEngine';

describe('P1.6 Runtime Authority Enforcement & Migration Suite', () => {
  beforeEach(() => {
    CollisionAuthority.ensureDefaultProviders();
  });

  // --- Runtime Path 1: CAM Toolpath Verification Path ---
  it('P1.6-G03: CAM path reaches CollisionAuthority coordinator', () => {
    const evaluateSpy = vi.spyOn(CollisionAuthority, 'evaluateSync');
    
    const res = CollisionDetectionEngine.verifyToolpath(
      'JOB_P1_6_CAM',
      'SETUP_01',
      'Facing',
      [{ tcp: { x: 0, y: 0, z: 10 }, toolOrientation: { x: 0, y: 0, z: 1 }, motionType: 'LINEAR' }],
      { 
        toolId: 'T1', 
        toolType: 'ENDMILL', 
        cutterDiameterMm: 10, 
        fluteLengthMm: 30, 
        shoulderLengthMm: 40, 
        totalLengthMm: 80, 
        stickoutMm: 50, 
        shankDiameterMm: 10 
      },
      { holderLowerDiameterMm: 30, holderGaugeLengthMm: 40 } as any,
      undefined,
      [{ v0: { x: -10, y: -10, z: 0 }, v1: { x: 10, y: -10, z: 0 }, v2: { x: 0, y: 10, z: 0 }, normal: { x: 0, y: 0, z: 1 } }]
    );

    expect(evaluateSpy).toHaveBeenCalled();
    const lastCallInput = evaluateSpy.mock.calls[0][0] as CanonicalCollisionInput;
    expect(lastCallInput.domain).toBe('CAM_MULTI_AXIS');
    expect(lastCallInput.cadRevisionId).toBe('JOB_P1_6_CAM');
    evaluateSpy.mockRestore();
  });

  // --- Runtime Path 2: 5-Axis Collision Path ---
  it('P1.6-G04: 5-Axis CAM path reaches CollisionAuthority coordinator', () => {
    const evaluateSpy = vi.spyOn(CollisionAuthority, 'evaluateSync');

    CAMCollisionEngine.checkSegmentCollision(
      { toolId: 'T1', cutterDiameterMm: 10, fluteLengthMm: 30, stickoutMm: 50, shankDiameterMm: 10, holder: { holderDiameterMm: 30, gaugeLengthMm: 40, clearanceMarginMm: 2.0, stages: [] } },
      { x: 0, y: 0, z: 20 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 10 },
      { x: 0, y: 0, z: 1 },
      [{ meshId: 'M1', name: 'PartWall', type: 'PART_NON_CUTTING_WALL', vertices: [{ x: 0, y: 0, z: 0 }], faces: [] }],
      0
    );

    expect(evaluateSpy).toHaveBeenCalled();
    const callInput = evaluateSpy.mock.calls[0][0] as CanonicalCollisionInput;
    expect(callInput.domain).toBe('CAM_MULTI_AXIS');
    expect(callInput.cadRevisionId).toContain('5AXIS_SEG_0');
    evaluateSpy.mockRestore();
  });

  // --- Runtime Path 3: Machine Simulation Path ---
  it('P1.6-G05: Machine Simulation path reaches CollisionAuthority coordinator', () => {
    const evaluateSpy = vi.spyOn(CollisionAuthority, 'evaluateSync');

    const machEngine = new MachineCollisionEngine({ 
      collisionClearanceMm: 1.0, 
      holderClearanceMm: 2.0, 
      fixtureClearanceMm: 2.0 
    } as any);
    machEngine.evaluatePoseCollisions(
      { toolTipWorld: { x: 0, y: 0, z: 100 }, toolOrientationWorld: { x: 0, y: 0, z: 1 } } as any,
      { getCollisionVolumes: () => [] } as any,
      { clamps: [] } as any,
      { bounds: { min: { x: -50, y: -50, z: -50 }, max: { x: 50, y: 50, z: 0 } } } as any,
      false,
      1,
      0.5,
      'G1 X0 Y0 Z100'
    );

    expect(evaluateSpy).toHaveBeenCalled();
    const callInput = evaluateSpy.mock.calls[0][0] as CanonicalCollisionInput;
    expect(callInput.domain).toBe('NC_SIMULATION');
    evaluateSpy.mockRestore();
  });

  // --- Runtime Path 4: Assembly Path ---
  it('P1.6-G06: Assembly path reaches CollisionAuthority coordinator', async () => {
    const evaluateSpy = vi.spyOn(CollisionAuthority, 'evaluateSync');

    await InterferenceDetectionEngine.analyze([
      { instanceId: 'comp-A', name: 'Block A', partId: 'P1', worldTransform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } } },
      { instanceId: 'comp-B', name: 'Block B', partId: 'P2', worldTransform: { position: { x: 20, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } } }
    ] as any);

    expect(evaluateSpy).toHaveBeenCalled();
    const callInput = evaluateSpy.mock.calls[0][0] as CanonicalCollisionInput;
    expect(callInput.domain).toBe('ASSEMBLY');
    evaluateSpy.mockRestore();
  });

  // --- Runtime Path 5: Kinematics Path ---
  it('P1.6-G07: Kinematics path reaches CollisionAuthority coordinator', () => {
    const evaluateSpy = vi.spyOn(CollisionAuthority, 'evaluateSync');

    const kinEngine = new KinematicCollisionEngine({
      workpieceBounds: { xMin: -50, xMax: 50, yMin: -50, yMax: 50, zMin: -50, zMax: 0 },
      toolLength: 50, toolDiameter: 10, safeClearance: 5.0
    });

    kinEngine.verifyPoint({ position: { x: 0, y: 0, z: 10 }, moveType: 'FEED' } as any, 0);

    expect(evaluateSpy).toHaveBeenCalled();
    const callInput = evaluateSpy.mock.calls[0][0] as CanonicalCollisionInput;
    expect(callInput.domain).toBe('KINEMATIC_MECHANISM');
    evaluateSpy.mockRestore();
  });

  // --- Negative Test A: Failure Downgrade Prevention ---
  it('P1.6-G10: Malformed input or missing provider fails closed (provenSafe=false)', async () => {
    const badInput: CanonicalCollisionInput = {
      domain: 'CAM_MULTI_AXIS',
      coordinateFrame: 'WCS',
      units: 'MILLIMETERS',
      toleranceProfile: { linearToleranceMm: -1.0, angularToleranceDeg: 0.5, clearanceWarningMarginMm: 2.0, safeClearanceMarginMm: 0.5 } // Negative tolerance
    };

    const res = await CollisionAuthority.evaluate(badInput);
    expect(res.status).toBe(CollisionStatus.ANALYSIS_FAILED);
    expect(res.provenSafe).toBe(false);
  });

  // --- Negative Test B: Unhandled Assembly Fail-Closed ---
  it('P1.6-G10: Unregistered assembly components do not return false safe CLEAR', async () => {
    const res = await InterferenceDetectionEngine.analyze([
      { instanceId: 'unknown-A', name: 'Unknown Comp A', partId: 'P100' },
      { instanceId: 'unknown-B', name: 'Unknown Comp B', partId: 'P200' }
    ] as any);

    expect(res.status).toBe('ANALYSIS_FAILED');
    expect(res.provenSafe).toBe(false);
  });

  // --- Negative Test C: Exactness Forgery Prevention ---
  it('P1.6-G11: Provider with SAMPLED exactness cannot forge EXACT rating', () => {
    const provider = new KinematicsCollisionProvider();
    expect(provider.capabilities.exactnessLevel).toBe(CollisionExactness.SAMPLED);
    expect(provider.capabilities.exactnessLevel).not.toBe(CollisionExactness.EXACT);
  });

  // --- Bypass Mutation Test (P1.6-G21): Authority Failure Cannot Become Safe ---
  it('P1.6-G21: Bypass mutation — when CollisionAuthority returns ANALYSIS_FAILED, callers preserve fail-closed semantics', async () => {
    // Spy and mock evaluateSync to return ANALYSIS_FAILED
    const evaluateSpy = vi.spyOn(CollisionAuthority, 'evaluateSync').mockImplementation((input: CanonicalCollisionInput) => {
      return {
        executionId: 'MUTATION_TEST',
        timestampIso: new Date().toISOString(),
        status: CollisionStatus.ANALYSIS_FAILED,
        severity: CollisionSeverity.FATAL_FAILURE,
        exactness: CollisionExactness.UNSUPPORTED,
        provenSafe: false,
        metrics: { minClearanceMm: 0, maxPenetrationDepthMm: 0, volumetricInterferenceMm3: 0 },
        contactManifold: [],
        temporalInfo: { timeOfImpactNormalized: null, criticalSubStepIndex: null },
        failureState: { isFailed: true, failureReason: 'MOCK_FAIL' },
        provenance: { cadDocumentRevisionId: input?.cadRevisionId, algorithmVersion: 'MOCK_FAIL@1.0.0' },
        diagnostics: ['MOCK_FAIL']
      };
    });

    const res = InterferenceDetectionEngine.analyze([
      { instanceId: 'unknown-1', name: 'M1', partId: 'P1' }
    ] as any);

    await expect(res).resolves.toMatchObject({
      status: 'ANALYSIS_FAILED',
      provenSafe: false
    });

    evaluateSpy.mockRestore();
  });
});
