import { Point3D } from "../collision/types";
import {
  CollisionObjectType,
  CollisionReverificationSummary,
  CollisionVerificationVerdict,
  ToolPoseTraceEntry,
  VerificationCollisionPolicy
} from "./types";

export class CollisionReverifier {
  private collisionPolicy: VerificationCollisionPolicy;

  constructor(collisionPolicy: VerificationCollisionPolicy) {
    this.collisionPolicy = collisionPolicy;
  }

  /**
   * Re-evaluates reconstructed tool poses against obstacle geometry and fixtures.
   */
  public verifyCollisions(
    toolPoseTrace: ToolPoseTraceEntry[],
    fixtures: { name: string; bounds: { min: Point3D; max: Point3D } }[] = [
      {
        name: "Standard Vise Clamp",
        bounds: { min: { x: -80, y: -90, z: -40 }, max: { x: 80, y: -70, z: -10 } }
      }
    ]
  ): CollisionReverificationSummary {
    const events: CollisionReverificationSummary["events"] = [];
    let minClearance = 999.0;
    let criticalPair = {
      objA: CollisionObjectType.TOOL,
      objB: CollisionObjectType.FIXTURE,
      clearanceMM: 999.0,
      location: { x: 0, y: 0, z: 0 } as Point3D
    };

    const HOLDER_LENGTH = 50.0;
    const HOLDER_RADIUS = 30.0;
    const TOOL_RADIUS = 5.0;

    for (let segIdx = 0; segIdx < toolPoseTrace.length; segIdx++) {
      const entry = toolPoseTrace[segIdx];
      for (const sample of entry.samples) {
        const tip = sample.tipPosition;
        const axis = sample.toolAxisVector;

        // Approximate holder center point
        const holderCenter: Point3D = {
          x: tip.x + axis.x * HOLDER_LENGTH,
          y: tip.y + axis.y * HOLDER_LENGTH,
          z: tip.z + axis.z * HOLDER_LENGTH
        };

        // Test against each fixture bounding box
        for (const fix of fixtures) {
          const b = fix.bounds;

          // 1. Tool tip vs Fixture
          const dTipX = Math.max(0, Math.max(b.min.x - tip.x, tip.x - b.max.x));
          const dTipY = Math.max(0, Math.max(b.min.y - tip.y, tip.y - b.max.y));
          const dTipZ = Math.max(0, Math.max(b.min.z - tip.z, tip.z - b.max.z));
          const distTip = Math.hypot(dTipX, dTipY, dTipZ) - TOOL_RADIUS;

          if (distTip < minClearance) {
            minClearance = Math.max(0, distTip);
            criticalPair = {
              objA: CollisionObjectType.TOOL,
              objB: CollisionObjectType.FIXTURE,
              clearanceMM: minClearance,
              location: { ...tip }
            };
          }

          if (distTip < 0) {
            events.push({
              segmentIndex: segIdx,
              objA: CollisionObjectType.TOOL,
              objB: CollisionObjectType.FIXTURE,
              penetrationMM: Math.abs(distTip),
              location: { ...tip }
            });
          }

          // 2. Holder vs Fixture
          const dHoldX = Math.max(0, Math.max(b.min.x - holderCenter.x, holderCenter.x - b.max.x));
          const dHoldY = Math.max(0, Math.max(b.min.y - holderCenter.y, holderCenter.y - b.max.y));
          const dHoldZ = Math.max(0, Math.max(b.min.z - holderCenter.z, holderCenter.z - b.max.z));
          const distHolder = Math.hypot(dHoldX, dHoldY, dHoldZ) - HOLDER_RADIUS;

          if (distHolder < minClearance) {
            minClearance = Math.max(0, distHolder);
            criticalPair = {
              objA: CollisionObjectType.HOLDER,
              objB: CollisionObjectType.FIXTURE,
              clearanceMM: minClearance,
              location: { ...holderCenter }
            };
          }

          if (distHolder < 0) {
            events.push({
              segmentIndex: segIdx,
              objA: CollisionObjectType.HOLDER,
              objB: CollisionObjectType.FIXTURE,
              penetrationMM: Math.abs(distHolder),
              location: { ...holderCenter }
            });
          }
        }
      }
    }

    let verdict = CollisionVerificationVerdict.COLLISION_FREE;
    if (events.length > 0) {
      verdict = CollisionVerificationVerdict.COLLISION_DETECTED;
    } else if (minClearance < this.collisionPolicy.minimumClearanceMM) {
      verdict = CollisionVerificationVerdict.CLEARANCE_VIOLATION;
    }

    return {
      verdict,
      totalCollisionEvents: events.length,
      minimumClearanceMM: minClearance,
      criticalPair,
      events
    };
  }
}
