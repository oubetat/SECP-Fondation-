/**
 * SECP087ToolpathSimulator.ts
 *
 * Simulates 5-Axis Toolpaths into deterministic Machine States:
 * Toolpath -> Machine Kinematics -> Collision Bridge -> 3D Render States
 */

import { FiveAxisToolpath, NurbsSurfacePatch } from '../classa5axis/SECP083Types';
import { MachineConfiguration, SECP087MachineState } from './SECP087Types';
import { SECP087MachineKinematicsEngine } from './SECP087MachineKinematicsEngine';
import { SECP087CollisionBridge } from './SECP087CollisionBridge';
import { TelemetryHasher } from '../telemetry/TelemetryHasher';

export class SECP087ToolpathSimulator {

  /**
   * Simulates full toolpath into sequential Machine States
   */
  public static simulate(
    toolpath: FiveAxisToolpath,
    surface: NurbsSurfacePatch,
    config: MachineConfiguration
  ): {
    states: SECP087MachineState[];
    totalSteps: number;
    totalDurationSec: number;
    toolpathHash: string;
    kinematicStateHash: string;
    firstCollisionStepIndex: number | null;
  } {
    const states: SECP087MachineState[] = [];
    const collisionAnalysis = SECP087CollisionBridge.analyzeToolpathCollisions(toolpath, surface, config);

    let cumulativeTimeSec = 0;
    const points = toolpath.points;

    // Hash toolpath points
    const toolpathStr = points.map(p => `${p.pointIndex}:${p.position.x},${p.position.y},${p.position.z}:${p.toolVector.x},${p.toolVector.y},${p.toolVector.z}`).join('|');
    const toolpathHashHex = TelemetryHasher.hashString(toolpathStr).substring(0, 16).toUpperCase();
    const toolpathHash = `TP-5AXIS-${toolpathHashHex}`;

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];

      if (i > 0) {
        const prev = points[i - 1];
        const dist = Math.hypot(
          pt.position.x - prev.position.x,
          pt.position.y - prev.position.y,
          pt.position.z - prev.position.z
        );
        const feedMmSec = (pt.feedRateMmMin || 1000) / 60;
        const dt = feedMmSec > 0 ? dist / feedMmSec : 0.01;
        cumulativeTimeSec += dt;
      }

      // 1. Calculate Inverse Kinematics
      const joints = SECP087MachineKinematicsEngine.calculateInverseKinematics(pt.position, pt.toolVector, config);

      // 2. Evaluate Forward Kinematics
      const fk = SECP087MachineKinematicsEngine.evaluateForwardKinematics(joints, config);

      // 3. Forward Kinematic Position Error Check
      const fkError = Math.hypot(
        pt.position.x - fk.forwardPos.x,
        pt.position.y - fk.forwardPos.y,
        pt.position.z - fk.forwardPos.z
      );

      // 4. Axis Limits & Singularity
      const hasAxisLimitViolation = SECP087MachineKinematicsEngine.checkAxisLimits(joints, config.limits);
      const hasSingularity = Math.abs(pt.toolVector.z) > 0.9999;

      // 5. Collision bridge details
      const stepCol = collisionAnalysis.stepDetails.get(i);
      const hasGouge = stepCol ? stepCol.hasGouge : false;
      const hasHolderCollision = stepCol ? stepCol.hasHolderCollision : false;
      const hasMachineCollision = stepCol ? (stepCol.hasMachineCollision || stepCol.hasShankCollision || stepCol.hasFixtureCollision) : false;
      const collisionDetails = stepCol ? stepCol.message : undefined;

      // Calculate step hash
      const stepStr = `${i}:${cumulativeTimeSec.toFixed(3)}:${joints.xMm},${joints.yMm},${joints.zMm},${joints.aDeg},${joints.bDeg},${joints.cDeg}:${hasGouge}:${hasHolderCollision}:${hasMachineCollision}`;
      const stepHashHex = TelemetryHasher.hashString(stepStr).substring(0, 16).toUpperCase();

      states.push({
        stepIndex: i,
        timestampSec: Number(cumulativeTimeSec.toFixed(3)),
        joints,
        toolTipWcs: pt.position,
        toolVectorWcs: pt.toolVector,
        toolTipMcs: { x: joints.xMm, y: joints.yMm, z: joints.zMm },
        forwardKinematicsPos: fk.forwardPos,
        forwardKinematicsVector: fk.forwardVector,
        forwardKinematicErrorMm: Number(fkError.toFixed(6)),
        moveType: pt.moveType,
        feedRateMmMin: pt.feedRateMmMin,
        spindleRpm: pt.spindleRpm,
        isSpindleActive: pt.spindleRpm > 0,
        hasAxisLimitViolation: hasAxisLimitViolation || (stepCol ? stepCol.hasLimitViolation : false),
        hasSingularity,
        hasOrientationFlip: stepCol ? stepCol.hasOrientationFlip : false,
        hasGougeCollision: hasGouge,
        hasHolderCollision: hasHolderCollision,
        hasMachineCollision: hasMachineCollision,
        collisionDetails,
        componentTransforms: fk.componentTransforms,
        stateHash: `ST-5AXIS-${stepHashHex}`
      });
    }

    // Hash sequence of state hashes
    const stateSeqStr = states.map(s => s.stateHash).join('->');
    const stateSeqHashHex = TelemetryHasher.hashString(stateSeqStr).substring(0, 16).toUpperCase();
    const kinematicStateHash = `KINSEQ-${stateSeqHashHex}`;

    return {
      states,
      totalSteps: states.length,
      totalDurationSec: Number(cumulativeTimeSec.toFixed(2)),
      toolpathHash,
      kinematicStateHash,
      firstCollisionStepIndex: collisionAnalysis.firstCollisionStepIndex
    };
  }
}
