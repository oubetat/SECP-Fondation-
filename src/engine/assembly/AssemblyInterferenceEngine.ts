/**
 * PATCH-SECP-043 — Assembly Interference Engine
 * Performs pair-wise collision and clash detection using the Real OCCT Geometry Kernel:
 *   - Broad Phase: 3D Axis-Aligned Bounding Box (AABB) intersection check in world space
 *   - Narrow Phase: True 3D B-Rep Boolean Intersect (OCCT Common / Intersect)
 *   - Outputs: Intersection Volume (mm3), Intersection Location (Centroid), Severity
 *   - Classifications: NO_INTERFERENCE, INTERFERENCE, TOUCHING, UNKNOWN
 */

import { GeometryKernel } from '../geometry/GeometryKernel';
import { GeometryKernelManager } from '../geometry/GeometryKernelManager';
import { ShapeHandle } from '../geometry/ShapeHandle';
import { Vector3D } from '../cadKernel';
import {
  AssemblyComponent,
  PartDefinition,
  AssemblyClash,
  AssemblyInterferenceReport,
  InterferenceStatus
} from './AssemblyConstraintTypes';
import { CollisionAuthority, CanonicalCollisionInput } from '../collision-authority';
import { AssemblyCollisionProvider } from '../collision-authority/adapters/CanonicalDomainProviders';

export class AssemblyInterferenceEngine {
  private static readonly CLASH_VOLUME_THRESHOLD_MM3 = 0.001; // 1e-3 mm3
  private static readonly TOUCHING_DISTANCE_THRESHOLD_MM = 0.05; // 50 microns

  /**
   * Performs full collision / interference detection across all active assembly components
   * using the real OCCT Geometry Kernel.
   */
  public static async analyzeInterference(
    components: AssemblyComponent[],
    parts: Map<string, PartDefinition>,
    kernelInstance?: GeometryKernel
  ): Promise<AssemblyInterferenceReport> {
    const kernel = kernelInstance || await GeometryKernelManager.getKernel();
    const manifest = kernel.getManifest();

    const activeComponents = components.filter(c => !c.suppressed && (c.visible !== false));
    const clashes: AssemblyClash[] = [];
    let totalClashVolume = 0;
    let evaluatedPairs = 0;
    let hasInterference = false;
    let hasTouching = false;
    let evaluationFailed = false;
    let failureReason = '';

    // Route top-level query through Canonical CollisionAuthority
    const canonicalInput: CanonicalCollisionInput = {
      domain: 'ASSEMBLY',
      coordinateFrame: 'WCS',
      units: 'MILLIMETERS',
      toleranceProfile: { linearToleranceMm: 0.005, angularToleranceDeg: 0.5, clearanceWarningMarginMm: 2.0, safeClearanceMarginMm: 0.5 },
      cadRevisionId: 'ASSEMBLY_INTERFERENCE_JOB'
    };
    const canonicalResult = CollisionAuthority.evaluateSync(canonicalInput, AssemblyCollisionProvider.PROVIDER_ID);

    for (let i = 0; i < activeComponents.length; i++) {
      for (let j = i + 1; j < activeComponents.length; j++) {
        const compA = activeComponents[i];
        const compB = activeComponents[j];
        evaluatedPairs++;

        const partA = parts.get(compA.partId);
        const partB = parts.get(compB.partId);

        if (!partA || !partB) continue;

        try {
          // 1. Get or create base shapes for Part A and Part B
          const shapeA = await this.resolveShapeHandle(partA, kernel);
          const shapeB = await this.resolveShapeHandle(partB, kernel);

          if (!shapeA || !shapeB) continue;

          // 2. Transform shapes to world space using OCCT transformations
          const worldShapeA = await this.transformShapeToWorld(shapeA, compA, kernel);
          const worldShapeB = await this.transformShapeToWorld(shapeB, compB, kernel);

          // 3. Broad-phase Bounding Box check
          const bboxA = await worldShapeA.getBoundingBox();
          const bboxB = await worldShapeB.getBoundingBox();

          const overlapX = bboxA.max.x >= bboxB.min.x && bboxA.min.x <= bboxB.max.x;
          const overlapY = bboxA.max.y >= bboxB.min.y && bboxA.min.y <= bboxB.max.y;
          const overlapZ = bboxA.max.z >= bboxB.min.z && bboxA.min.z <= bboxB.max.z;

          if (!overlapX || !overlapY || !overlapZ) {
            // No bounding box intersection -> definitely no clash
            continue;
          }

          // 4. Narrow-phase: Real OCCT Boolean Common / Intersect
          let intersectSolid: ShapeHandle | null = null;
          try {
            intersectSolid = await kernel.booleanIntersect(worldShapeA, worldShapeB);
          } catch (e: any) {
            try {
              intersectSolid = await kernel.common(worldShapeA, worldShapeB);
            } catch {
              intersectSolid = null;
              evaluationFailed = true;
              failureReason = `Kernel boolean failed for pair ${compA.instanceId} vs ${compB.instanceId}: ${e?.message || 'BooleanException'}`;
            }
          }

          if (intersectSolid) {
            const props = await intersectSolid.getProperties();
            const rawVolume = props.volume || 0;
            // OCCT dimensions are in mm, so volume is in mm3
            const volumeMm3 = rawVolume;

            if (volumeMm3 > this.CLASH_VOLUME_THRESHOLD_MM3) {
              hasInterference = true;
              totalClashVolume += volumeMm3;

              const posXA = compA.worldTransform?.position?.x ?? 0;
              const posYA = compA.worldTransform?.position?.y ?? 0;
              const posZA = compA.worldTransform?.position?.z ?? 0;
              const posXB = compB.worldTransform?.position?.x ?? 0;
              const posYB = compB.worldTransform?.position?.y ?? 0;
              const posZB = compB.worldTransform?.position?.z ?? 0;

              const center = props.centerOfMass || {
                x: (posXA + posXB) / 2,
                y: (posYA + posYB) / 2,
                z: (posZA + posZB) / 2
              };

              clashes.push({
                id: `clash-${compA.instanceId}-${compB.instanceId}`,
                componentAId: compA.instanceId,
                componentAName: compA.name,
                componentBId: compB.instanceId,
                componentBName: compB.name,
                intersectionVolumeMm3: parseFloat(volumeMm3.toFixed(4)),
                intersectionLocation: {
                  x: parseFloat(center.x.toFixed(3)),
                  y: parseFloat(center.y.toFixed(3)),
                  z: parseFloat(center.z.toFixed(3))
                },
                severity: volumeMm3 > 100 ? 'CRITICAL_COLLISION' : 'CLEARANCE_WARNING',
                clashDetails: `Volumetric clash of ${volumeMm3.toFixed(2)} mm³ detected between ${compA.name} and ${compB.name}.`
              });
            } else if (volumeMm3 > 0 || (props.faceCount && props.faceCount > 0)) {
              hasTouching = true;
              const posXA = compA.worldTransform?.position?.x ?? 0;
              const posYA = compA.worldTransform?.position?.y ?? 0;
              const posZA = compA.worldTransform?.position?.z ?? 0;
              const posXB = compB.worldTransform?.position?.x ?? 0;
              const posYB = compB.worldTransform?.position?.y ?? 0;
              const posZB = compB.worldTransform?.position?.z ?? 0;
              clashes.push({
                id: `touch-${compA.instanceId}-${compB.instanceId}`,
                componentAId: compA.instanceId,
                componentAName: compA.name,
                componentBId: compB.instanceId,
                componentBName: compB.name,
                intersectionVolumeMm3: 0,
                intersectionLocation: {
                  x: (posXA + posXB) / 2,
                  y: (posYA + posYB) / 2,
                  z: (posZA + posZB) / 2
                },
                severity: 'SURFACE_CONTACT',
                clashDetails: `Surface contact / touching detected between ${compA.name} and ${compB.name}.`
              });
            }
          }
        } catch (err: any) {
          console.warn(`[Interference] Error analyzing pair ${compA.name} x ${compB.name}:`, err);
        }
      }
    }

    let status: InterferenceStatus = 'NO_INTERFERENCE';
    if (evaluationFailed && !hasInterference) {
      status = 'UNKNOWN'; // Fail-closed on kernel failure
    } else if (hasInterference) {
      status = 'INTERFERENCE';
    } else if (hasTouching) {
      status = 'TOUCHING';
    }

    return {
      status,
      clashes,
      totalClashVolumeMm3: parseFloat(totalClashVolume.toFixed(4)),
      evaluatedPairsCount: evaluatedPairs,
      timestamp: new Date().toISOString(),
      kernelUsed: manifest.kernel
    };
  }

  /**
   * Helper: Resolves or creates an OCCT ShapeHandle for a PartDefinition
   */
  private static async resolveShapeHandle(part: PartDefinition, kernel: GeometryKernel): Promise<ShapeHandle> {
    if (part.shapeHandle) {
      return part.shapeHandle;
    }

    throw new Error(`UNAVAILABLE: Component ${part.id} has no valid B-Rep geometry for interference detection. Refusing to fabricate synthetic geometry.`);
  }

  /**
   * Helper: Applies world translation and rotation to an OCCT ShapeHandle
   */
  private static async transformShapeToWorld(
    shape: ShapeHandle,
    component: AssemblyComponent,
    kernel: GeometryKernel
  ): Promise<ShapeHandle> {
    const pos = component.worldTransform?.position || { x: 0, y: 0, z: 0 };
    const rawRot = component.worldTransform?.rotation;
    const rot = Array.isArray(rawRot)
      ? { x: rawRot[0] || 0, y: rawRot[1] || 0, z: rawRot[2] || 0 }
      : (rawRot || { x: 0, y: 0, z: 0 });

    let result = shape;

    // Apply rotation if non-zero
    if (Math.abs(rot.x) > 1e-4) {
      result = await kernel.rotate(result, { x: 1, y: 0, z: 0 }, (rot.x * Math.PI) / 180);
    }
    if (Math.abs(rot.y) > 1e-4) {
      result = await kernel.rotate(result, { x: 0, y: 1, z: 0 }, (rot.y * Math.PI) / 180);
    }
    if (Math.abs(rot.z) > 1e-4) {
      result = await kernel.rotate(result, { x: 0, y: 0, z: 1 }, (rot.z * Math.PI) / 180);
    }

    // Apply translation
    if (pos.x !== 0 || pos.y !== 0 || pos.z !== 0) {
      result = await kernel.translate(result, { x: pos.x, y: pos.y, z: pos.z });
    }

    return result;
  }
}
