import {
  ClearanceRequirement,
  ClearanceState,
  CollisionDetectionReport,
  CollisionEvent,
  CollisionFingerprint,
  CollisionHierarchyType,
  CollisionModel,
  CollisionObject,
  CollisionObjectType,
  CollisionPair,
  CollisionSeverity,
  CollisionTolerancePolicy,
  DistanceQueryResult,
  FiveAxisPoint,
  FiveAxisToolpath,
  NarrowPhaseVerdict,
  PenetrationDepthResult,
  Point3D,
  SamplingPolicy,
  TrueCollisionVerdict,
  Vector3D
} from "./types";
import { BroadPhaseCollisionEngine } from "./BroadPhaseCollisionEngine";
import { NarrowPhaseCollisionEngine } from "./NarrowPhaseCollisionEngine";
import { AdaptiveCollisionSampling } from "./AdaptiveCollisionSampling";
import { CollisionClassifier } from "./CollisionClassifier";
import { SweptVolumeEngine } from "./SweptVolumeEngine";

export class CollisionDetector {
  /**
   * Evaluates a full 5-Axis toolpath against a comprehensive collision model with continuous motion checking.
   */
  public static evaluateToolpath(
    toolpath: FiveAxisToolpath,
    collisionModel: CollisionModel
  ): CollisionDetectionReport {
    const reportId = `COL_REP_${Math.abs(Math.round(Math.sin(toolpath.points.length * 100) * 100000))}`;
    const timestamp = new Date().toISOString();
    const collisionEvents: CollisionEvent[] = [];

    let broadPhasePruned = 0;
    let narrowPhaseChecked = 0;
    let minOverallClearance = Number.POSITIVE_INFINITY;

    const points = toolpath.points;
    if (!points || points.length === 0) {
      return {
        reportId,
        timestamp,
        collisionModelId: collisionModel.collisionModelId,
        toolpathId: toolpath.toolpathId,
        verdict: TrueCollisionVerdict.COLLISION_UNDETERMINED,
        collisionEvents: [],
        minClearance: 0,
        broadPhasePruned: 0,
        narrowPhaseChecked: 0,
        samplingCoverage: 0,
        fingerprint: this.computeFingerprint(toolpath.toolpathId, collisionModel, []),
        provenSafe: false
      };
    }

    // Default active environment objects: Stock, Workpiece, Fixtures, CheckSurfaces, KeepOutVolumes
    const envObjects: CollisionObject[] = [
      collisionModel.stock,
      collisionModel.workpiece,
      ...collisionModel.fixture,
      ...collisionModel.checkSurfaces,
      ...collisionModel.keepOutVolumes
    ].filter(o => o && o.isActive);

    // Assembly objects: Tool Flute, Shank, Tool Holder, Spindle
    const assemblyObjects: CollisionObject[] = (collisionModel.toolAssembly && collisionModel.toolAssembly.length > 0)
      ? collisionModel.toolAssembly.filter(o => o.isActive)
      : [this.createDefaultToolObject(), this.createDefaultHolderObject()];

    // Validating tolerance contract: Fail-closed on invalid or negative tolerance
    const tol = collisionModel.tolerance;
    if (!tol || tol.collisionTolerance < 0 || tol.contactTolerance < 0 || tol.clearanceTolerance < 0 ||
        isNaN(tol.collisionTolerance) || isNaN(tol.contactTolerance) || isNaN(tol.clearanceTolerance)) {
      return {
        reportId,
        timestamp,
        collisionModelId: collisionModel.collisionModelId,
        toolpathId: toolpath.toolpathId,
        verdict: TrueCollisionVerdict.COLLISION_UNDETERMINED,
        collisionEvents: [],
        minClearance: 0,
        broadPhasePruned: 0,
        narrowPhaseChecked: 0,
        samplingCoverage: 0,
        fingerprint: this.computeFingerprint(toolpath.toolpathId, collisionModel, []),
        provenSafe: false
      };
    }

    let totalAdaptiveSamples = 0;
    let expectedAdaptiveSamples = 0;

    // Segment-by-segment continuous evaluation
    for (let segIdx = 0; segIdx < points.length; segIdx++) {
      const pCurrent = points[segIdx];
      const pNext = segIdx < points.length - 1 ? points[segIdx + 1] : points[segIdx];

      // Adaptive sampling plan for continuous swept motion
      const plan = AdaptiveCollisionSampling.evaluateSegmentSampling(
        { position: pCurrent.position, toolAxis: pCurrent.toolAxis },
        { position: pNext.position, toolAxis: pNext.toolAxis },
        collisionModel.samplingPolicy,
        minOverallClearance === Number.POSITIVE_INFINITY ? 50.0 : minOverallClearance
      );

      expectedAdaptiveSamples += plan.recommendedSteps;
      const samplePoses = AdaptiveCollisionSampling.generateSamplePoses(plan);
      totalAdaptiveSamples += samplePoses.length;

      for (let sIdx = 0; sIdx < samplePoses.length; sIdx++) {
        const pose = samplePoses[sIdx];

        // Position tool assembly at current continuous sample pose
        for (const asmObj of assemblyObjects) {
          const transformedAsmObj = this.transformAssemblyObject(asmObj, pose.position, pose.toolAxis);

          for (const envObj of envObjects) {
            // 1. Broad phase pruning
            const broadCheck = BroadPhaseCollisionEngine.evaluatePairAABB(transformedAsmObj, envObj, 5.0);
            if (broadCheck === "DISJOINT") {
              broadPhasePruned++;
              continue;
            }

            // 2. Narrow phase exact distance query
            narrowPhaseChecked++;
            const distQuery: DistanceQueryResult = NarrowPhaseCollisionEngine.queryDistance(transformedAsmObj, envObj);

            if (distQuery.minimumDistance < minOverallClearance) {
              minOverallClearance = distQuery.minimumDistance;
            }

            // Clearance requirement policy
            const req: ClearanceRequirement = this.getClearanceRequirement(transformedAsmObj.type, envObj.type, collisionModel);

            // 3. Classification
            const isCutting = (pCurrent.feedRate || 1000) < 5000; // rapid vs cutting feed
            const classRes = CollisionClassifier.classifyInteraction(
              transformedAsmObj,
              envObj,
              distQuery,
              req,
              collisionModel.tolerance,
              isCutting
            );

            if (classRes.severity === CollisionSeverity.CRITICAL || classRes.severity === CollisionSeverity.MAJOR || classRes.hierarchy === CollisionHierarchyType.GOUGE) {
              const penetration: PenetrationDepthResult = NarrowPhaseCollisionEngine.computePenetration(
                transformedAsmObj,
                envObj,
                distQuery
              );

              const eventId = `EVT_${toolpath.toolpathId}_S${segIdx}_K${sIdx}_${transformedAsmObj.type}_${envObj.type}`;
              const event: CollisionEvent = {
                eventId,
                toolpathId: toolpath.toolpathId,
                segmentId: `SEG_${segIdx}`,
                sampleIndex: sIdx,
                timestampOrSequence: segIdx * 100 + sIdx,
                objectA: transformedAsmObj,
                objectB: envObj,
                classification: classRes.hierarchy,
                severity: classRes.severity,
                minimumDistance: distQuery.minimumDistance,
                penetrationDepth: penetration.penetrationDepth,
                location: distQuery.closestPointB,
                machineState: {
                  machineRevision: "REV-103-V2",
                  jointPositions: {
                    X: pose.position.x,
                    Y: pose.position.y,
                    Z: pose.position.z,
                    A: Math.acos(Math.max(-1, Math.min(1, pose.toolAxis.z))) * 180 / Math.PI,
                    C: Math.atan2(pose.toolAxis.y, pose.toolAxis.x) * 180 / Math.PI
                  },
                  toolPose: {
                    position: pose.position,
                    toolAxis: pose.toolAxis
                  },
                  feedRate: pCurrent.feedRate || 1000,
                  spindleSpeed: pCurrent.spindleSpeed || 12000,
                  timestamp: new Date().toISOString()
                },
                contextMessage: classRes.message
              };

              collisionEvents.push(event);
            }
          }
        }
      }
    }

    const coverageMetric = AdaptiveCollisionSampling.calculateCoverageMetric(
      totalAdaptiveSamples,
      expectedAdaptiveSamples,
      collisionModel.samplingPolicy.continuousMotionEnabled
    );

    // Determine final true verdict - FAIL-CLOSED DEFAULT
    let overallVerdict = TrueCollisionVerdict.COLLISION_UNDETERMINED;
    let provenSafe = false;

    if (collisionEvents.length > 0) {
      // Find the most severe event
      const hasGouge = collisionEvents.some(e => e.classification === CollisionHierarchyType.GOUGE);
      const hasHolder = collisionEvents.some(e => e.objectA.type === CollisionObjectType.TOOL_HOLDER || e.objectB.type === CollisionObjectType.TOOL_HOLDER);
      const hasSpindle = collisionEvents.some(e => e.objectA.type === CollisionObjectType.SPINDLE || e.objectB.type === CollisionObjectType.SPINDLE);
      const hasFixture = collisionEvents.some(e => e.objectA.type === CollisionObjectType.FIXTURE || e.objectB.type === CollisionObjectType.FIXTURE);

      if (hasHolder) overallVerdict = TrueCollisionVerdict.HOLDER_COLLISION;
      else if (hasSpindle) overallVerdict = TrueCollisionVerdict.SPINDLE_COLLISION;
      else if (hasFixture) overallVerdict = TrueCollisionVerdict.FIXTURE_COLLISION;
      else if (hasGouge) overallVerdict = TrueCollisionVerdict.GOUGE;
      else overallVerdict = TrueCollisionVerdict.COLLISION_DETECTED;

      provenSafe = false;
    } else if (coverageMetric >= 0.8) {
      // Sufficient sampling coverage and NO collisions: PROVEN SAFE
      overallVerdict = TrueCollisionVerdict.COLLISION_FREE;
      provenSafe = true;
    } else {
      // Insufficient sampling coverage: DO NOT CLAIM COLLISION_FREE
      overallVerdict = TrueCollisionVerdict.COLLISION_UNDETERMINED;
      provenSafe = false;
    }

    const fingerprint = this.computeFingerprint(toolpath.toolpathId, collisionModel, collisionEvents);

    return {
      reportId,
      timestamp,
      collisionModelId: collisionModel.collisionModelId,
      toolpathId: toolpath.toolpathId,
      verdict: overallVerdict,
      collisionEvents,
      minClearance: minOverallClearance === Number.POSITIVE_INFINITY ? 50.0 : minOverallClearance,
      broadPhasePruned,
      narrowPhaseChecked,
      samplingCoverage: coverageMetric,
      fingerprint,
      provenSafe
    };
  }

  private static transformAssemblyObject(
    obj: CollisionObject,
    pos: Point3D,
    axis: Vector3D
  ): CollisionObject {
    if (obj.type === CollisionObjectType.TOOL || obj.type === CollisionObjectType.FIXTURE) {
      // Note: FIXTURE transformation is handled here IF the fixture is attached to the assembly (e.g. custom tool fixture)
      // Otherwise environment fixtures are expected to be static in WCS or pre-transformed.
      const length = obj.type === CollisionObjectType.TOOL ? 40 : 10;
      const radius = obj.capsule ? obj.capsule.radius : (obj.type === CollisionObjectType.TOOL ? 5 : 20);
      const tip: Point3D = { ...pos };
      const top: Point3D = { x: pos.x + axis.x * length, y: pos.y + axis.y * length, z: pos.z + axis.z * length };
      return {
        ...obj,
        capsule: { p1: tip, p2: top, radius },
        aabb: {
          min: { x: Math.min(tip.x, top.x) - radius, y: Math.min(tip.y, top.y) - radius, z: Math.min(tip.z, top.z) - radius },
          max: { x: Math.max(tip.x, top.x) + radius, y: Math.max(tip.y, top.y) + radius, z: Math.max(tip.z, top.z) + radius }
        }
      };
    } else if (obj.type === CollisionObjectType.TOOL_HOLDER) {
      const offset = 40; // starts above cutting flute
      const length = 60;
      const radius = obj.capsule ? obj.capsule.radius : 25;
      const base: Point3D = { x: pos.x + axis.x * offset, y: pos.y + axis.y * offset, z: pos.z + axis.z * offset };
      const top: Point3D = { x: pos.x + axis.x * (offset + length), y: pos.y + axis.y * (offset + length), z: pos.z + axis.z * (offset + length) };
      return {
        ...obj,
        capsule: { p1: base, p2: top, radius },
        aabb: {
          min: { x: Math.min(base.x, top.x) - radius, y: Math.min(base.y, top.y) - radius, z: Math.min(base.z, top.z) - radius },
          max: { x: Math.max(base.x, top.x) + radius, y: Math.max(base.y, top.y) + radius, z: Math.max(base.z, top.z) + radius }
        }
      };
    } else if (obj.type === CollisionObjectType.SPINDLE) {
      const offset = 100;
      const length = 120;
      const radius = obj.capsule ? obj.capsule.radius : 60;
      const base: Point3D = { x: pos.x + axis.x * offset, y: pos.y + axis.y * offset, z: pos.z + axis.z * offset };
      const top: Point3D = { x: pos.x + axis.x * (offset + length), y: pos.y + axis.y * (offset + length), z: pos.z + axis.z * (offset + length) };
      return {
        ...obj,
        capsule: { p1: base, p2: top, radius },
        aabb: {
          min: { x: Math.min(base.x, top.x) - radius, y: Math.min(base.y, top.y) - radius, z: Math.min(base.z, top.z) - radius },
          max: { x: Math.max(base.x, top.x) + radius, y: Math.max(base.y, top.y) + radius, z: Math.max(base.z, top.z) + radius }
        }
      };
    }

    return obj;
  }

  private static getClearanceRequirement(
    typeA: CollisionObjectType,
    typeB: CollisionObjectType,
    model: CollisionModel
  ): ClearanceRequirement {
    if (typeA === CollisionObjectType.TOOL_HOLDER || typeB === CollisionObjectType.TOOL_HOLDER) {
      return {
        minimumDistance: 3.0,
        objectPair: [typeA, typeB],
        tolerance: model.tolerance.clearanceTolerance,
        policy: "STRICT",
        source: "HOLDER_SAFETY_RULE"
      };
    }
    if (typeA === CollisionObjectType.SPINDLE || typeB === CollisionObjectType.SPINDLE) {
      return {
        minimumDistance: 10.0,
        objectPair: [typeA, typeB],
        tolerance: model.tolerance.clearanceTolerance,
        policy: "STRICT",
        source: "SPINDLE_ENVELOPE_RULE"
      };
    }
    return {
      minimumDistance: 1.0,
      objectPair: [typeA, typeB],
      tolerance: model.tolerance.clearanceTolerance,
      policy: "STRICT",
      source: "DEFAULT_CLEARANCE"
    };
  }

  private static computeFingerprint(
    toolpathId: string,
    model: CollisionModel,
    events: CollisionEvent[]
  ): CollisionFingerprint {
    const tpHash = `TP-FGP-${toolpathId}`;
    const modelHash = `MDL-FGP-${model.collisionModelId}-REV${model.revision}`;
    const sampHash = `SMP-FGP-S${model.samplingPolicy.sampleCount}-C${model.samplingPolicy.coverageMetric}`;
    const eventSetHash = `EVTS-${events.length}-${events.map(e => e.eventId).join("_").slice(0, 32)}`;
    const deterministicHash = `FGP-106-${tpHash}-${modelHash}-${eventSetHash}`;

    return {
      toolpathFingerprint: tpHash,
      collisionModelFingerprint: modelHash,
      samplingPolicyFingerprint: sampHash,
      engineRevision: "106.1.0",
      eventSetHash,
      deterministicHash
    };
  }

  public static createDefaultToolObject(radius: number = 5, length: number = 40): CollisionObject {
    return {
      objectId: "DEFAULT_TOOL_FLUTE",
      name: "Standard End Mill Flute",
      type: CollisionObjectType.TOOL,
      geometryType: "CYLINDER_CAPSULE" as any,
      capsule: { p1: { x: 0, y: 0, z: 0 }, p2: { x: 0, y: 0, z: length }, radius },
      aabb: { min: { x: -radius, y: -radius, z: 0 }, max: { x: radius, y: radius, z: length } },
      isActive: true
    };
  }

  public static createDefaultHolderObject(radius: number = 25, length: number = 60): CollisionObject {
    return {
      objectId: "DEFAULT_TOOL_HOLDER",
      name: "ER32 Collet Chuck Holder",
      type: CollisionObjectType.TOOL_HOLDER,
      geometryType: "CYLINDER_CAPSULE" as any,
      capsule: { p1: { x: 0, y: 0, z: 40 }, p2: { x: 0, y: 0, z: 40 + length }, radius },
      aabb: { min: { x: -radius, y: -radius, z: 40 }, max: { x: radius, y: radius, z: 40 + length } },
      isActive: true
    };
  }
}
