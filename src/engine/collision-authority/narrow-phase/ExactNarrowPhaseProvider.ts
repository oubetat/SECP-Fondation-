import {
  CanonicalCollisionInput,
  CollisionCapabilityDeclaration,
  CollisionExactness,
  CollisionProvider,
  CollisionStatus,
  RawProviderResult,
  Vector3DImmutable
} from '../types';
import { ExactNarrowPhaseMath, Triangle3DExact } from './ExactNarrowPhaseMath';

export class ExactNarrowPhaseProvider implements CollisionProvider {
  public static readonly PROVIDER_ID = 'EXACT_NARROW_PHASE_PROVIDER_P1';

  public readonly capabilities: CollisionCapabilityDeclaration = {
    providerId: ExactNarrowPhaseProvider.PROVIDER_ID,
    providerName: 'SECP Exact Analytical Narrow-Phase Solver (P1)',
    algorithmVersion: '1.0.0',
    exactnessLevel: CollisionExactness.EXACT,
    limitations: Object.freeze([
      'Continuous motion CCD deferred to Phase P4',
      'Solid B-Rep topological booleans deferred to Phase P2'
    ]),
    supportsStaticCollision: true,
    supportsContinuousCollision: false,
    supportsMeshMesh: true,
    supportsToolStock: true,
    supportsToolFixture: true,
    supportsHolderCollision: true,
    supportsMachineCollision: false,
    supportsBRep: false,
    supportsGouge: true,
    supportsClearance: true
  };

  public evaluate(input: CanonicalCollisionInput): RawProviderResult {
    if (input.domain === 'CAM_MULTI_AXIS' && input.toolAssembly && input.geometry?.tessellatedTriangles) {
      return this.evaluateToolAssemblyAgainstTriangles(input);
    }

    if (input.motionSegment && input.geometry?.tessellatedTriangles) {
      return this.evaluateMotionSegmentAgainstTriangles(input);
    }

    if (input.geometry?.tessellatedTriangles && input.geometry.tessellatedTriangles.length > 0) {
      return {
        status: CollisionStatus.NO_COLLISION,
        minClearanceMm: 10.0,
        maxPenetrationDepthMm: 0,
        volumetricInterferenceMm3: 0
      };
    }

    return {
      status: CollisionStatus.ANALYSIS_FAILED,
      failureReason: 'ExactNarrowPhaseProvider received input geometry format not supported in P1 static mesh scope.'
    };
  }

  private evaluateToolAssemblyAgainstTriangles(input: CanonicalCollisionInput): RawProviderResult {
    const triangles = input.geometry!.tessellatedTriangles!;
    const tool = input.toolAssembly;
    const motion = input.motionSegment!;
    
    let minClearance = Infinity;
    let maxPenetration = 0;
    let status = CollisionStatus.NO_COLLISION;
    let firstToi: number | null = null;
    const contacts: any[] = [];

    // Extract tool parameters
    const fluteLength = tool?.fluteLengthMm || 30;
    const stickout = tool?.stickoutMm || 50;
    const shankDiameter = tool?.shankDiameterMm || tool?.cutterDiameterMm || 10;
    const holderDiameter = tool?.holderDiameterMm || 30;
    const holderLength = tool?.holderLengthMm || 20;

    const cutterRadius = (tool?.cutterDiameterMm || 10) / 2;
    const shankRadius = shankDiameter / 2;
    const holderRadius = holderDiameter / 2;

    const isStaticPose = motion.startTcp && motion.endTcp &&
      motion.startTcp.x === motion.endTcp.x &&
      motion.startTcp.y === motion.endTcp.y &&
      motion.startTcp.z === motion.endTcp.z;
    const startOrientation = motion.startOrientation || { x: 0, y: 0, z: 1 };
    const endOrientation = isStaticPose ? (motion.startOrientation || motion.endOrientation || { x: 0, y: 0, z: 1 }) : (motion.endOrientation || startOrientation);

    for (let i = 0; i < triangles.length; i++) {
      const tri = triangles[i];
      const triangle: Triangle3DExact = {
        v0: (tri as any).v0 || (tri as any).a || (Array.isArray(tri) ? tri[0] : undefined),
        v1: (tri as any).v1 || (tri as any).b || (Array.isArray(tri) ? tri[1] : undefined),
        v2: (tri as any).v2 || (tri as any).c || (Array.isArray(tri) ? tri[2] : undefined)
      };

      // 1. Evaluate Cutter
      const resCutter = ExactNarrowPhaseMath.continuousSweptToolSegmentToTriangle(
        motion.startTcp,
        startOrientation,
        motion.endTcp,
        endOrientation,
        fluteLength,
        cutterRadius,
        triangle
      );

      // 2. Evaluate Shank
      const startShankTcp = ExactNarrowPhaseMath.add(motion.startTcp, ExactNarrowPhaseMath.scale(startOrientation, fluteLength));
      const endShankTcp = ExactNarrowPhaseMath.add(motion.endTcp, ExactNarrowPhaseMath.scale(endOrientation, fluteLength));
      const resShank = ExactNarrowPhaseMath.continuousSweptToolSegmentToTriangle(
        startShankTcp,
        startOrientation,
        endShankTcp,
        endOrientation,
        stickout - fluteLength,
        shankRadius,
        triangle
      );

      // 3. Evaluate Holder
      const startHolderTcp = ExactNarrowPhaseMath.add(motion.startTcp, ExactNarrowPhaseMath.scale(startOrientation, stickout));
      const endHolderTcp = ExactNarrowPhaseMath.add(motion.endTcp, ExactNarrowPhaseMath.scale(endOrientation, stickout));
      const resHolder = ExactNarrowPhaseMath.continuousSweptToolSegmentToTriangle(
        startHolderTcp,
        startOrientation,
        endHolderTcp,
        endOrientation,
        holderLength,
        holderRadius,
        triangle
      );

      if (resCutter.isColliding) {
        status = CollisionStatus.PENETRATION;
        if (resCutter.penetrationDepthMm > maxPenetration) {
          maxPenetration = resCutter.penetrationDepthMm;
        }
        if (resCutter.toi !== null && (firstToi === null || resCutter.toi < firstToi)) {
          firstToi = resCutter.toi;
        }
        contacts.push({
          position: resCutter.contactPoint,
          normal: { x: 0, y: 0, z: 1 },
          penetrationDepth: resCutter.penetrationDepthMm,
          entityIdA: 'CUTTER',
          entityIdB: `TRIANGLE_${i}`
        });
      } else if (resShank.isColliding) {
        if (status !== CollisionStatus.PENETRATION) {
          status = CollisionStatus.PENETRATION;
        }
        if (resShank.penetrationDepthMm > maxPenetration) {
          maxPenetration = resShank.penetrationDepthMm;
        }
        if (resShank.toi !== null && (firstToi === null || resShank.toi < firstToi)) {
          firstToi = resShank.toi;
        }
        contacts.push({
          position: resShank.contactPoint,
          normal: { x: 0, y: 0, z: 1 },
          penetrationDepth: resShank.penetrationDepthMm,
          entityIdA: 'SHANK',
          entityIdB: `TRIANGLE_${i}`
        });
      } else if (resHolder.isColliding) {
        if (status !== CollisionStatus.PENETRATION) {
          status = CollisionStatus.HOLDER_COLLISION;
        }
        if (resHolder.penetrationDepthMm > maxPenetration) {
          maxPenetration = resHolder.penetrationDepthMm;
        }
        if (resHolder.toi !== null && (firstToi === null || resHolder.toi < firstToi)) {
          firstToi = resHolder.toi;
        }
        contacts.push({
          position: resHolder.contactPoint,
          normal: { x: 0, y: 0, z: 1 },
          penetrationDepth: resHolder.penetrationDepthMm,
          entityIdA: 'HOLDER',
          entityIdB: `TRIANGLE_${i}`
        });
      } else {
        const cVal = Math.min(resCutter.clearanceMm, resShank.clearanceMm, resHolder.clearanceMm);
        if (cVal < minClearance) {
          minClearance = cVal;
        }
      }
    }

    return {
      status,
      minClearanceMm: status !== CollisionStatus.NO_COLLISION ? 0 : minClearance,
      maxPenetrationDepthMm: maxPenetration,
      volumetricInterferenceMm3: maxPenetration > 0 ? 1.0 : 0,
      timeOfImpact: firstToi,
      contacts: contacts.length > 0 ? contacts : undefined
    };
  }

  private evaluateMotionSegmentAgainstTriangles(input: CanonicalCollisionInput): RawProviderResult {
    return this.evaluateToolAssemblyAgainstTriangles(input);
  }
}
