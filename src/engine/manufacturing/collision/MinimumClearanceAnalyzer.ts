import {
  ClearanceProfile,
  ClearanceState,
  CollisionModel,
  CollisionObject,
  DistanceQueryResult,
  Point3D,
  Vector3D
} from "./types";
import { NarrowPhaseCollisionEngine } from "./NarrowPhaseCollisionEngine";

export class MinimumClearanceAnalyzer {
  /**
   * Evaluates the continuous clearance profile along a trajectory of tool poses against a collision model.
   */
  public static analyzeProfile(
    toolpathId: string,
    poses: Array<{ position: Point3D; toolAxis: Vector3D }>,
    toolObject: CollisionObject,
    environmentObjects: CollisionObject[],
    requiredClearance: number = 3.0
  ): ClearanceProfile {
    const samples: ClearanceProfile["samples"] = [];
    let globalMinDistance = Number.POSITIVE_INFINITY;
    let cumulativeArc = 0.0;

    for (let i = 0; i < poses.length; i++) {
      const pose = poses[i];
      if (i > 0) {
        const prev = poses[i - 1];
        const segDist = Math.sqrt(
          Math.pow(pose.position.x - prev.position.x, 2) +
          Math.pow(pose.position.y - prev.position.y, 2) +
          Math.pow(pose.position.z - prev.position.z, 2)
        );
        cumulativeArc += segDist;
      }

      // Update tool representation at current pose
      const currentToolObj = this.transformToolObject(toolObject, pose.position, pose.toolAxis);

      let minSampleDist = Number.POSITIVE_INFINITY;
      let closestPair: [string, string] = [currentToolObj.objectId, "NONE"];

      for (const envObj of environmentObjects) {
        if (!envObj.isActive) continue;
        const qRes: DistanceQueryResult = NarrowPhaseCollisionEngine.queryDistance(currentToolObj, envObj);
        if (qRes.minimumDistance < minSampleDist) {
          minSampleDist = qRes.minimumDistance;
          closestPair = [currentToolObj.objectId, envObj.objectId];
        }
      }

      if (minSampleDist < globalMinDistance) {
        globalMinDistance = minSampleDist;
      }

      let state = ClearanceState.CLEAR;
      if (minSampleDist <= 0.001) {
        state = ClearanceState.VIOLATED;
      } else if (minSampleDist < requiredClearance) {
        state = ClearanceState.MARGINAL;
      }

      samples.push({
        s: poses.length > 1 ? i / (poses.length - 1) : 0,
        arcLength: cumulativeArc,
        minDistance: minSampleDist,
        clearanceState: state,
        closestPair
      });
    }

    return {
      toolpathId,
      samples,
      globalMinDistance: globalMinDistance === Number.POSITIVE_INFINITY ? 0 : globalMinDistance
    };
  }

  private static transformToolObject(
    baseTool: CollisionObject,
    pos: Point3D,
    axis: Vector3D
  ): CollisionObject {
    const length = baseTool.capsule ? (baseTool.capsule.p2.z - baseTool.capsule.p1.z) || 50 : 50;
    const radius = baseTool.capsule ? baseTool.capsule.radius : 5;

    const tip = { ...pos };
    const top: Point3D = {
      x: pos.x + axis.x * length,
      y: pos.y + axis.y * length,
      z: pos.z + axis.z * length
    };

    return {
      ...baseTool,
      capsule: {
        p1: tip,
        p2: top,
        radius
      },
      aabb: {
        min: {
          x: Math.min(tip.x, top.x) - radius,
          y: Math.min(tip.y, top.y) - radius,
          z: Math.min(tip.z, top.z) - radius
        },
        max: {
          x: Math.max(tip.x, top.x) + radius,
          y: Math.max(tip.y, top.y) + radius,
          z: Math.max(tip.z, top.z) + radius
        }
      }
    };
  }
}
