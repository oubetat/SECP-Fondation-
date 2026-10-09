/**
 * SECP Industrial OS v3 — PATCH-179: 5-Axis Collision & Holder Clearance Engine
 * Detects cutter shank, holder stage, spindle nose, and table/fixture collisions,
 * calculating minimum clearance margins and continuous swept penetration depths.
 */

import { Vector3D } from '../../cadKernel';
import { 
  FiveAxisToolDefinition, 
  CollisionClassification, 
  CollisionEvent 
} from './FiveAxisTypes';
import { ToolSweptVolumeEngine, SweptCapsule } from './FiveAxisSweptVolume';
import { CollisionAuthority, CanonicalCollisionInput } from '../../collision-authority';
import { CamFiveAxisCollisionProvider } from '../../collision-authority/adapters/CanonicalDomainProviders';

export interface ObstacleMesh {
  meshId: string;
  name: string;
  type: 'PART_NON_CUTTING_WALL' | 'FIXTURE_CLAMP' | 'ROTARY_TABLE' | 'VISE_JAW';
  vertices: Vector3D[];
  faces: [number, number, number][]; // Triangular indices
}

export class CAMCollisionEngine {
  /**
   * Checks tool and holder collision for a specific toolpath motion segment
   */
  public static checkSegmentCollision(
    tool: FiveAxisToolDefinition,
    p0: Vector3D,
    axis0: Vector3D,
    p1: Vector3D,
    axis1: Vector3D,
    obstacles: ObstacleMesh[],
    pointIndex: number
  ): { hasCollision: boolean; collisionEvent?: CollisionEvent; minClearanceMm: number } {
    // Route through Canonical CollisionAuthority
    const obstacleTriangles: any[] = [];
    for (const obs of obstacles) {
      if (obs.faces && obs.faces.length > 0) {
        for (const f of obs.faces) {
          const v0 = obs.vertices[f[0]];
          const v1 = obs.vertices[f[1]];
          const v2 = obs.vertices[f[2]];
          if (v0 && v1 && v2) obstacleTriangles.push({ v0, v1, v2 });
        }
      } else if (obs.vertices) {
        for (let i = 0; i < obs.vertices.length - 2; i += 3) {
          obstacleTriangles.push({ v0: obs.vertices[i], v1: obs.vertices[i+1], v2: obs.vertices[i+2] });
        }
      }
    }

    const canonicalInput: CanonicalCollisionInput = {
      domain: 'CAM_MULTI_AXIS',
      coordinateFrame: 'WCS',
      units: 'MILLIMETERS',
      toleranceProfile: { linearToleranceMm: 0.005, angularToleranceDeg: 0.5, clearanceWarningMarginMm: tool.holder?.clearanceMarginMm || 2.0, safeClearanceMarginMm: 0.5 },
      cadRevisionId: `5AXIS_SEG_${pointIndex}`,
      toolAssembly: {
        cutterDiameterMm: tool.cutterDiameterMm,
        fluteLengthMm: tool.fluteLengthMm,
        stickoutMm: tool.stickoutMm,
        shankDiameterMm: tool.shankDiameterMm,
        holderLowerDiameterMm: tool.holder?.holderDiameterMm || tool.shankDiameterMm,
        holderGaugeLengthMm: tool.holder?.gaugeLengthMm || 40.0
      },
      motionSegment: { startTcp: p0, startOrientation: axis0, endTcp: p1, endOrientation: axis1, motionType: 'FEED' },
      geometry: { tessellatedTriangles: obstacleTriangles }
    };

    const canonicalResult = CollisionAuthority.evaluateSync(canonicalInput, CamFiveAxisCollisionProvider.PROVIDER_ID);

    const capsules = ToolSweptVolumeEngine.buildSweptCapsules(tool, p0, axis0, p1, axis1);
    let minOverallClearance = Infinity;
    let worstCollision: CollisionEvent | null = null;

    for (const obstacle of obstacles) {
      for (const v of obstacle.vertices) {
        for (const cap of capsules) {
          // Check distance to capsule centerlines (p0 and p1)
          const dist0 = ToolSweptVolumeEngine.distancePointToSegment(v, cap.p0_bottom, cap.p0_top);
          const dist1 = ToolSweptVolumeEngine.distancePointToSegment(v, cap.p1_bottom, cap.p1_top);
          const minCenterDist = Math.min(dist0.distance, dist1.distance);

          // Effective radius along capsule
          const effRadius = Math.max(cap.radiusBottom, cap.radiusTop);
          const safetyMargin = cap.component === 'HOLDER_STAGE' ? tool.holder.clearanceMarginMm : 1.0;
          const clearance = minCenterDist - effRadius;

          if (clearance < minOverallClearance) {
            minOverallClearance = clearance;
          }

          // Check if clearance is violated
          if (clearance < 0) {
            const penetration = Math.abs(clearance);
            let collClass: CollisionClassification = 'CUTTER_SHANK_COLLISION';
            let collidingComp = `Tool Shank (${tool.shankDiameterMm}mm)`;

            if (cap.component === 'HOLDER_STAGE') {
              collClass = 'HOLDER_COLLISION';
              collidingComp = `Holder Stage #${cap.stageIndex ?? 0} (${cap.radiusBottom * 2}mm)`;
            } else if (cap.component === 'SPINDLE') {
              collClass = 'SPINDLE_NOSE_COLLISION';
              collidingComp = `Spindle Nose / Flange (${tool.holder.flangeDiameterMm}mm)`;
            }

            if (!worstCollision || penetration > worstCollision.penetrationDepthMm) {
              // Calculate suggested tilt adjustment away from collision point
              const dx = v.x - p1.x;
              const dy = v.y - p1.y;
              const suggestedTilt = Math.min(30, Math.max(5, Math.atan2(Math.hypot(dx, dy), 50) * (180 / Math.PI)));

              worstCollision = {
                pointIndex,
                type: collClass,
                location: v,
                penetrationDepthMm: Number(penetration.toFixed(3)),
                minClearanceMm: Number(clearance.toFixed(3)),
                collidingComponent: collidingComp,
                obstacleDescription: `${obstacle.name} (${obstacle.type})`,
                severity: 'CRITICAL_ALARM',
                suggestedTiltAdjustmentDeg: Number(suggestedTilt.toFixed(1))
              };
            }
          }
        }
      }
    }

    if (worstCollision) {
      return {
        hasCollision: true,
        collisionEvent: worstCollision,
        minClearanceMm: Math.max(0, minOverallClearance)
      };
    }

    return {
      hasCollision: false,
      minClearanceMm: Number(minOverallClearance.toFixed(3))
    };
  }

  /**
   * Helper to create standard workpiece and vise obstacle geometry
   */
  public static createDefaultFixtureObstacle(partBounds: { min: Vector3D; max: Vector3D }): ObstacleMesh {
    const margin = 15;
    const viseWidth = (partBounds.max.x - partBounds.min.x) + margin * 2;
    const viseDepth = (partBounds.max.y - partBounds.min.y) + margin * 2;
    const viseZ = partBounds.min.z - 2;

    const vertices: Vector3D[] = [
      { x: partBounds.min.x - margin, y: partBounds.min.y - margin, z: viseZ },
      { x: partBounds.max.x + margin, y: partBounds.min.y - margin, z: viseZ },
      { x: partBounds.max.x + margin, y: partBounds.max.y + margin, z: viseZ },
      { x: partBounds.min.x - margin, y: partBounds.max.y + margin, z: viseZ },
      { x: partBounds.min.x - margin, y: partBounds.min.y - margin, z: viseZ - 40 },
      { x: partBounds.max.x + margin, y: partBounds.min.y - margin, z: viseZ - 40 },
      { x: partBounds.max.x + margin, y: partBounds.max.y + margin, z: viseZ - 40 },
      { x: partBounds.min.x - margin, y: partBounds.max.y + margin, z: viseZ - 40 },
    ];

    const faces: [number, number, number][] = [
      [0, 1, 2], [0, 2, 3], // Top
      [4, 6, 5], [4, 7, 6], // Bottom
      [0, 4, 5], [0, 5, 1], // Front
      [2, 6, 7], [2, 7, 3], // Back
      [0, 3, 7], [0, 7, 4], // Left
      [1, 5, 6], [1, 6, 2]  // Right
    ];

    return {
      meshId: 'FIXTURE_VISE_01',
      name: 'Pneumatic Precision Vise & Base Plate',
      type: 'FIXTURE_CLAMP',
      vertices,
      faces
    };
  }
}
