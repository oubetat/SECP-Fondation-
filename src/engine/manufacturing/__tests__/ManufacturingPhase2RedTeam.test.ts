import { describe, it, expect } from 'vitest';
import { ForwardKinematicsSolver } from '../kinematics/ForwardKinematicsSolver';
import { InverseKinematicsSolver } from '../kinematics/InverseKinematicsSolver';
import { CollisionDetector } from '../collision/CollisionDetector';
import { FiveAxisToolpathGenerator } from '../cam/FiveAxisToolpathGenerator';
import { IndependentManufacturingOracle } from '../IndependentManufacturingOracle';
import { TrueCollisionVerdict } from '../collision/types';
import { IKSolutionStatus } from '../kinematics/types';

describe('Manufacturing Phase 2 Red-Team Adversarial Matrix', () => {
  const mockMachine: any = {
    machineType: 'MILL_5_AXIS',
    axes: [
      { axisId: 'X', travelLimits: { min: -500, max: 500 }, homePosition: 0 },
      { axisId: 'Y', travelLimits: { min: -500, max: 500 }, homePosition: 0 },
      { axisId: 'Z', travelLimits: { min: -100, max: 800 }, homePosition: 0 },
      { axisId: 'A', travelLimits: { min: -110, max: 110 }, homePosition: 0, axisType: 'ROTARY_TILT' },
      { axisId: 'C', travelLimits: { min: -360, max: 360 }, homePosition: 0, axisType: 'ROTARY_TABLE' }
    ],
    kinematicChain: { chainId: 'TABLE-TABLE' }
  };

  it('MFG-06: Axis-limit violation must be detected by IK solver', () => {
    // Target position far outside X/Y limits (X=5000)
    const targetPose: any = {
      matrix: [
        [1, 0, 0, 5000],
        [0, 1, 0, 0],
        [0, 0, 1, 100],
        [0, 0, 0, 1]
      ]
    };

    const solutions = InverseKinematicsSolver.solve(mockMachine, targetPose);
    expect(solutions[0].status).toBe(IKSolutionStatus.LIMIT_VIOLATION);
    
    // Oracle verification
    const oracleResult = IndependentManufacturingOracle.verifyLimits(
      solutions[0].axisValues as any,
      { 
        x: [-500, 500], y: [-500, 500], z: [-100, 800], 
        a: [-110, 110], c: [-360, 360] 
      }
    );
    expect(oracleResult).toBe(false);
  });

  it('MFG-08: Singular configuration must be flagged by IK solver', () => {
    // Tool axis [0,0,1] is a singularity in 5-axis Table-Table (A=0)
    const targetPose: any = {
      matrix: [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 100],
        [0, 0, 0, 1]
      ]
    };

    const solutions = InverseKinematicsSolver.solve(mockMachine, targetPose);
    expect(solutions[0].status).toBe(IKSolutionStatus.SINGULAR);
  });

  it('MFG-12: Fixture collision must be detected', () => {
    const toolpath: any = {
      toolpathId: 'tp_adversarial',
      points: [{
        position: { x: 100, y: 100, z: 20 },
        toolAxis: { x: 0, y: 0, z: 1 }
      }]
    };

    const collisionModel: any = {
      collisionModelId: 'mdl_test',
      revision: 1,
      stock: { isActive: false },
      workpiece: { isActive: false },
      fixture: [{
        objectId: 'clamp_01',
        type: 'FIXTURE',
        isActive: true,
        aabb: {
          min: { x: 90, y: 90, z: 10 },
          max: { x: 110, y: 110, z: 30 }
        }
      }],
      checkSurfaces: [],
      keepOutVolumes: [],
      samplingPolicy: { sampleCount: 1, coverageMetric: 1.0, continuousMotionEnabled: false },
      tolerance: { clearanceTolerance: 0.1, collisionTolerance: 0.001, contactTolerance: 0.02 }
    };

    const report = CollisionDetector.evaluateToolpath(toolpath, collisionModel);
    expect(report.verdict).toBe(TrueCollisionVerdict.FIXTURE_COLLISION);
    expect(report.provenSafe).toBe(false);
  });

  it('MFG-14: Tool gouge must be detected by oracle logic (Independent Sphere check)', () => {
    const toolPos = { x: 50, y: 50, z: 10 };
    const toolRadius = 5;
    
    const surfacePoint = { x: 50, y: 50, z: 12 }; // Surface is at Z=12, tool tip at Z=10 -> Gouge!
    const surfaceRadius = 1;

    const isCollision = IndependentManufacturingOracle.checkSphereCollision(
      toolPos, toolRadius,
      surfacePoint, surfaceRadius
    );
    
    expect(isCollision).toBe(true);
  });

  it('MFG-22: Subtractive volume invariant (Volume cannot increase)', () => {
    const initialVolume = 1000;
    const finalVolume = 1005; // Maliciously increased volume

    const isValid = IndependentManufacturingOracle.verifySubtractiveVolumeInvariant(initialVolume, finalVolume);
    expect(isValid).toBe(false);
  });
});
