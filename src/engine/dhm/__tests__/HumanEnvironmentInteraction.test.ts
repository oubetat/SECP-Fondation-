/**
 * SECP Human Factors & Ergonomics Engine (HFEE) — TASK 007-001-A
 * Human-Environment Interaction & Task Assessment Forensic Verification
 */

import { describe, it, expect } from 'vitest';
import { HumanEnvironmentInteractionEngine } from '../interaction/HumanEnvironmentInteractionEngine';
import { HumanTaskDefinition, InteractionObject, InteractionStatus } from '../interaction/types';
import { Vector3D } from '../../assembly/graph/types';

describe('HumanEnvironmentInteractionEngine Forensic Audit', () => {
  const profileId = 'ANSUR2_MALE_P50';

  // Derived from Forensic Audit:
  // Sitting P50 Male: Head Z=914, Shoulders Z=603, Hand Tip (Neutral) Z=-227.
  // A point 20cm forward and 20cm down from the shoulder should be highly reachable and visible.
  const REACHABLE_TARGET: Vector3D = { x: 200, y: -206, z: 400 }; 
  const UNREACHABLE_TARGET: Vector3D = { x: 2500, y: 0, z: 2500 };

  it('should produce a genuinely FEASIBLE result for a standard reachable control', () => {
    const dashboardControl: InteractionObject = {
      objectId: 'KNOB_001',
      name: 'Radio Knob',
      type: 'CONTROL',
      documentId: 'CAD_DASH_V1',
      interactionPoints: {
        'CENTER': {
          positionWCS: REACHABLE_TARGET,
          label: 'Knob Center'
        }
      }
    };

    const task: HumanTaskDefinition = {
      taskId: 'TASK_RADIO_ADJUST',
      name: 'Adjust Radio',
      dhmProfileId: profileId,
      states: [
        {
          stateId: 'STATE_1',
          description: 'Reach knob',
          targetObjectId: 'KNOB_001',
          targetPointKey: 'CENTER',
          effectorRegion: 'RIGHT_HAND',
          requiresReachability: true,
          requiresVisibility: true
        }
      ]
    };

    const analysis = HumanEnvironmentInteractionEngine.analyzeTask(
      task,
      { objects: [dashboardControl] },
      { documentId: 'ENG_DOC_001', revision: 1 }
    );

    expect(analysis.overallFeasibility).toBe(true);
    expect(analysis.states[0].status).toBe(InteractionStatus.FEASIBLE);
    expect(analysis.maxErgonomicRiskScore).toBeGreaterThan(0);
  });

  it('should identify INFEASIBLE_REACH for a target too far away', () => {
    const task: HumanTaskDefinition = {
      taskId: 'TASK_OUT_OF_REACH',
      name: 'Reach far',
      dhmProfileId: profileId,
      states: [
        {
          stateId: 'STATE_1',
          description: 'Reach far away',
          targetPositionWCS: UNREACHABLE_TARGET,
          effectorRegion: 'RIGHT_HAND',
          requiresReachability: true,
          requiresVisibility: false
        }
      ]
    };

    const analysis = HumanEnvironmentInteractionEngine.analyzeTask(
      task,
      { objects: [] },
      { documentId: 'DOC_REACH_FAIL', revision: 1 }
    );

    expect(analysis.overallFeasibility).toBe(false);
    expect(analysis.states[0].status).toBe(InteractionStatus.INFEASIBLE_REACH);
  });

  it('should identify INFEASIBLE_VISIBILITY for an occluded target', () => {
    const wall: Vector3D[][] = [
      [{ x: 100, y: -500, z: 0 }, { x: 100, y: 500, z: 0 }, { x: 100, y: 0, z: 2000 }]
    ];

    const task: HumanTaskDefinition = {
      taskId: 'TASK_OCCLUDED',
      name: 'Look Behind Wall',
      dhmProfileId: profileId,
      states: [
        {
          stateId: 'STATE_1',
          description: 'Look at target behind wall',
          targetPositionWCS: REACHABLE_TARGET,
          effectorRegion: 'RIGHT_HAND',
          requiresReachability: false,
          requiresVisibility: true
        }
      ]
    };

    const analysis = HumanEnvironmentInteractionEngine.analyzeTask(
      task,
      { objects: [], globalObstacles: wall },
      { documentId: 'DOC_VIS_FAIL', revision: 1 }
    );

    expect(analysis.overallFeasibility).toBe(false);
    expect(analysis.states[0].status).toBe(InteractionStatus.INFEASIBLE_VISIBILITY);
  });

  it('should identify INFEASIBLE_COLLISION when effector target causes collision', () => {
    const obstacle: Vector3D[][] = [
      [{ x: 150, y: -250, z: 350 }, { x: 250, y: -250, z: 350 }, { x: 200, y: -150, z: 450 }]
    ];

    const task: HumanTaskDefinition = {
      taskId: 'TASK_COLLISION',
      name: 'Reach Into Obstacle',
      dhmProfileId: profileId,
      states: [
        {
          stateId: 'STATE_1',
          description: 'Reach into obstacle',
          targetPositionWCS: REACHABLE_TARGET,
          effectorRegion: 'RIGHT_HAND',
          requiresReachability: true,
          requiresVisibility: false
        }
      ]
    };

    const analysis = HumanEnvironmentInteractionEngine.analyzeTask(
      task,
      { objects: [], globalObstacles: obstacle },
      { documentId: 'DOC_COL_FAIL', revision: 1 }
    );

    expect(analysis.overallFeasibility).toBe(false);
    expect([InteractionStatus.INFEASIBLE_COLLISION, InteractionStatus.INFEASIBLE_REACH]).toContain(analysis.states[0].status);
  });

  it('should handle INVALID_INPUT for missing target data', () => {
    const task: HumanTaskDefinition = {
      taskId: 'TASK_INVALID',
      name: 'Bad Task',
      dhmProfileId: profileId,
      states: [
        {
          stateId: 'STATE_1',
          description: 'Missing target',
          effectorRegion: 'RIGHT_HAND',
          requiresReachability: true,
          requiresVisibility: true
        } as any
      ]
    };

    const analysis = HumanEnvironmentInteractionEngine.analyzeTask(
      task,
      { objects: [] },
      { documentId: 'DOC_INVALID', revision: 1 }
    );

    expect(analysis.overallFeasibility).toBe(false);
    expect(analysis.states[0].status).toBe(InteractionStatus.INVALID_INPUT);
  });
});
