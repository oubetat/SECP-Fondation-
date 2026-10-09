/**
 * PATCH-SECP-227 — Dynamic Clearance & Interference Engine
 * 
 * Analyzes continuous spatial clearance envelopes and collision events
 * between rigid bodies across kinematic trajectories.
 */

import { Vector3D } from '../../cadKernel';
import { CoordinateFrameEngine } from './CoordinateFrameEngine';
import {
  ComponentKinematicState,
  MechanicalJoint,
  DynamicClearanceRecord
} from './MechanicalJointTypes';
import { JointKinematicsEngine } from './JointKinematicsEngine';

export interface ClearanceEnvelopeReport {
  mechanismId: string;
  nominalClearanceMm: number;
  minimumObservedClearanceMm: number;
  worstCaseTimeSeconds: number;
  criticalPair: [string, string];
  collisionDetected: boolean;
  totalInterferenceEvents: number;
  clearanceRecords: DynamicClearanceRecord[];
}

export class DynamicClearanceEngine {
  /**
   * Evaluate dynamic clearance profile along full range of motion for an active joint
   */
  public static evaluateJointClearanceSweep(
    targetJoint: MechanicalJoint,
    components: ComponentKinematicState[],
    allJoints: MechanicalJoint[],
    samplePoints: number = 30
  ): ClearanceEnvelopeReport {
    const minPos = targetJoint.primaryLimit?.minimum ?? -90;
    const maxPos = targetJoint.primaryLimit?.maximum ?? 90;
    const stepSize = (maxPos - minPos) / Math.max(samplePoints - 1, 1);

    const clearanceRecords: DynamicClearanceRecord[] = [];
    let minObserved = Infinity;
    let worstTime = 0;
    let criticalPair: [string, string] = ['', ''];
    let totalInterference = 0;

    const originalPos = targetJoint.currentPosition;

    for (let i = 0; i < samplePoints; i++) {
      const pos = minPos + i * stepSize;
      targetJoint.currentPosition = pos;

      // Update assembly transforms
      JointKinematicsEngine.updateAssemblyTransforms(components, allJoints);

      let stepMinDist = Infinity;
      let stepPair: [string, string] = ['', ''];
      let stepCollision = false;

      for (let a = 0; a < components.length; a++) {
        for (let b = a + 1; b < components.length; b++) {
          const compA = components[a];
          const compB = components[b];

          // Compute centroid distance
          const dist = CoordinateFrameEngine.vecDistance(compA.worldOrigin, compB.worldOrigin);
          if (dist < stepMinDist) {
            stepMinDist = dist;
            stepPair = [compA.componentId, compB.componentId];
          }

          if (dist < 1.0) { // Under 1.0mm counts as interference/clash
            stepCollision = true;
            totalInterference++;
          }
        }
      }

      if (stepMinDist < minObserved) {
        minObserved = stepMinDist;
        worstTime = i * 0.1;
        criticalPair = stepPair;
      }

      clearanceRecords.push({
        stepIndex: i,
        timeSeconds: i * 0.1,
        jointPositions: { [targetJoint.id]: pos },
        minimumClearanceMm: stepMinDist,
        closestComponentA: stepPair[0],
        closestComponentB: stepPair[1],
        collisionDetected: stepCollision,
        collisionPairs: stepCollision ? [{ componentA: stepPair[0], componentB: stepPair[1], penetrationDepthMm: 1.0 - stepMinDist }] : []
      });
    }

    // Restore original position
    targetJoint.currentPosition = originalPos;
    JointKinematicsEngine.updateAssemblyTransforms(components, allJoints);

    return {
      mechanismId: `CLEARANCE-ENV-${targetJoint.id}`,
      nominalClearanceMm: clearanceRecords[0]?.minimumClearanceMm ?? 50.0,
      minimumObservedClearanceMm: minObserved === Infinity ? 50.0 : minObserved,
      worstCaseTimeSeconds: worstTime,
      criticalPair,
      collisionDetected: totalInterference > 0,
      totalInterferenceEvents: totalInterference,
      clearanceRecords
    };
  }

  /**
   * Evaluate static snapshot clearance and collision across component states
   */
  public static evaluateDynamicClearance(
    components: ComponentKinematicState[]
  ): DynamicClearanceRecord {
    let minObserved = Infinity;
    let stepPair: [string, string] = ['', ''];
    let collisionDetected = false;

    for (let a = 0; a < components.length; a++) {
      for (let b = a + 1; b < components.length; b++) {
        const compA = components[a];
        const compB = components[b];

        const dist = CoordinateFrameEngine.vecDistance(compA.worldOrigin, compB.worldOrigin);
        if (dist < minObserved) {
          minObserved = dist;
          stepPair = [compA.componentId, compB.componentId];
        }

        if (dist < 1.0) {
          collisionDetected = true;
        }
      }
    }

    return {
      stepIndex: 0,
      timeSeconds: 0,
      jointPositions: {},
      minimumClearanceMm: minObserved === Infinity ? 100 : minObserved,
      closestComponentA: stepPair[0],
      closestComponentB: stepPair[1],
      collisionDetected,
      collisionPairs: collisionDetected ? [{ componentA: stepPair[0], componentB: stepPair[1], penetrationDepthMm: 1.0 - minObserved }] : []
    };
  }
}
