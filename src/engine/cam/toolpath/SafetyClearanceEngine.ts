/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-256 — Safety Clearance, Collision Verification & Gouge Detection
 */

import { Vector3D, CuttingTool, ToolPosition, ToolpathSegment, MotionType, CollisionEvent, GougeEvent, ToolpathValidationReport } from './ToolpathTypes';

export interface BRepFaceMesh {
  faceId: string;
  isFloor: boolean;
  isWall: boolean;
  minZ: number;
  maxZ: number;
  vertices: Vector3D[];
  normal: Vector3D;
}

export class SafetyClearanceEngine {
  /**
   * Evaluates collision against part body, stock, and holder
   */
  public static checkCollisions(
    segments: ToolpathSegment[],
    tool: CuttingTool,
    safeRetractZ: number,
    partBounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
    fixtureBounds?: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
  ): CollisionEvent[] {
    const collisions: CollisionEvent[] = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const p = seg.endPoint;

      // 1. Rapid moves must never penetrate below safe/retract plane when crossing part envelope
      if (seg.motionType === MotionType.RAPID) {
        const isInsidePartFootprint =
          p.x >= partBounds.minX && p.x <= partBounds.maxX &&
          p.y >= partBounds.minY && p.y <= partBounds.maxY;

        if (isInsidePartFootprint && p.z < partBounds.maxZ - 0.05) {
          collisions.push({
            segmentIndex: i,
            toolPosition: p,
            collisionType: 'RAPID_STOCK_COLLISION',
            penetrationDepthMm: partBounds.maxZ - p.z,
            description: `Rapid motion G0 penetrated part envelope at Z=${p.z.toFixed(2)}mm below max stock top Z=${partBounds.maxZ.toFixed(2)}mm`,
          });
        }
      }

      // 2. Tool Holder & Shank Collision check
      // Holder starts at Z = toolTip.z + tool.fluteLengthMm (or overallLengthMm)
      const holderBottomZ = p.z + tool.fluteLengthMm;
      if (holderBottomZ < partBounds.maxZ) {
        // Check if holder radius overlaps part boundaries
        const holderRadius = tool.holderDiameterMm / 2;
        const holderInterferes =
          p.x + holderRadius > partBounds.minX && p.x - holderRadius < partBounds.maxX &&
          p.y + holderRadius > partBounds.minY && p.y - holderRadius < partBounds.maxY;

        if (holderInterferes && holderBottomZ < partBounds.maxZ) {
          collisions.push({
            segmentIndex: i,
            toolPosition: p,
            collisionType: 'TOOL_HOLDER_PART',
            penetrationDepthMm: partBounds.maxZ - holderBottomZ,
            description: `Tool holder collided with part top surface at Z=${holderBottomZ.toFixed(2)}mm (tool depth ${p.z.toFixed(2)}mm)`,
          });
        }
      }

      // 3. Fixture collision
      if (fixtureBounds) {
        const toolRadius = tool.diameterMm / 2;
        const insideFixture =
          p.x + toolRadius >= fixtureBounds.minX && p.x - toolRadius <= fixtureBounds.maxX &&
          p.y + toolRadius >= fixtureBounds.minY && p.y - toolRadius <= fixtureBounds.maxY &&
          p.z <= fixtureBounds.maxZ;

        if (insideFixture) {
          collisions.push({
            segmentIndex: i,
            toolPosition: p,
            collisionType: 'TOOL_FIXTURE',
            penetrationDepthMm: fixtureBounds.maxZ - p.z,
            description: `Tool collided with machine clamping fixture at [${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}]`,
          });
        }
      }
    }

    return collisions;
  }

  /**
   * Evaluates gouging against part faces (e.g. cutting deeper than feature floor or through wall boundary)
   */
  public static checkGouging(
    segments: ToolpathSegment[],
    targetFloorZ: number,
    tool: CuttingTool,
    stockToLeaveFloor: number = 0
  ): GougeEvent[] {
    const gouges: GougeEvent[] = [];
    const absoluteMinAllowedZ = targetFloorZ + stockToLeaveFloor - 0.005; // 5 micron numerical guard

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (seg.motionType === MotionType.FEED || seg.motionType === MotionType.PLUNGE || seg.motionType === MotionType.RAMP) {
        if (seg.endPoint.z < absoluteMinAllowedZ) {
          gouges.push({
            segmentIndex: i,
            toolPosition: seg.endPoint,
            surfaceId: 'FEATURE_FLOOR_FACE',
            gougeDepthMm: absoluteMinAllowedZ - seg.endPoint.z,
            description: `Gouge detected: Tool cut to Z=${seg.endPoint.z.toFixed(3)}mm which violates floor datum Z=${targetFloorZ.toFixed(3)}mm`,
          });
        }
      }
    }

    return gouges;
  }
}
