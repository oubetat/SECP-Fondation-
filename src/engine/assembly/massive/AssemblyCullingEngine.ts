/**
 * SECP Industrial OS v3 — PATCH-180: Assembly Culling & Visibility Engine
 * Hierarchical Frustum Culling, Occlusion Culling against major structures,
 * and dual Logical vs Render Visibility Graph.
 */

import { Vector3D } from '../../cadKernel';
import { 
  InstanceID, 
  BoundingBox3D, 
  CameraFrustum, 
  OccluderVolume, 
  VisibilityLogicalState 
} from './MassiveAssemblyTypes';
import { AssemblyMath } from './AssemblyMath';
import { AssemblyInstanceGraph } from './AssemblyInstanceGraph';
import { AssemblySpatialIndex } from './AssemblySpatialIndex';

export class VisibilityGraph {
  private logicalStates: Map<InstanceID, VisibilityLogicalState> = new Map();
  private renderVisibleSet: Set<InstanceID> = new Set();

  public setLogicalState(id: InstanceID, state: VisibilityLogicalState): void {
    this.logicalStates.set(id, state);
  }

  public getLogicalState(id: InstanceID): VisibilityLogicalState {
    return this.logicalStates.get(id) || 'VISIBLE';
  }

  public isLogicallyVisible(id: InstanceID): boolean {
    const state = this.getLogicalState(id);
    return state === 'VISIBLE' || state === 'SELECTED' || state === 'ISOLATED' || state === 'HIGHLIGHTED';
  }

  public setRenderVisibleSet(visibleIds: InstanceID[]): void {
    this.renderVisibleSet = new Set(visibleIds);
  }

  public isRenderVisible(id: InstanceID): boolean {
    return this.renderVisibleSet.has(id);
  }

  public getRenderVisibleCount(): number {
    return this.renderVisibleSet.size;
  }
}

export class OcclusionCullingEngine {
  private occluders: OccluderVolume[] = [];

  public registerOccluder(occluder: OccluderVolume): void {
    this.occluders.push(occluder);
  }

  public clearOccluders(): void {
    this.occluders = [];
  }

  /**
   * Tests if a target bounding box is occluded from camera perspective by any registered occluder volume
   */
  public isOccluded(box: BoundingBox3D, cameraPos: Vector3D): boolean {
    if (this.occluders.length === 0) return false;

    const boxDist = Math.hypot(
      box.center.x - cameraPos.x,
      box.center.y - cameraPos.y,
      box.center.z - cameraPos.z
    );

    for (const occluder of this.occluders) {
      const occluderDist = Math.hypot(
        occluder.bounds.center.x - cameraPos.x,
        occluder.bounds.center.y - cameraPos.y,
        occluder.bounds.center.z - cameraPos.z
      );

      // Occluder must be in front of the object
      if (occluderDist >= boxDist) continue;

      // Check if ray from camera to box center passes through occluder
      const dir = {
        x: (box.center.x - cameraPos.x) / (boxDist || 1),
        y: (box.center.y - cameraPos.y) / (boxDist || 1),
        z: (box.center.z - cameraPos.z) / (boxDist || 1)
      };

      const hit = AssemblyMath.raycastAABB({ origin: cameraPos, direction: dir }, occluder.bounds);
      if (hit.hit && hit.distance < boxDist * 0.95) {
        // Also check if the occluder is substantially larger than the target box
        if (
          occluder.bounds.extents.x > box.extents.x * 1.5 &&
          occluder.bounds.extents.y > box.extents.y * 1.5 &&
          occluder.bounds.extents.z > box.extents.z * 1.5
        ) {
          return true;
        }
      }
    }

    return false;
  }
}

export class AssemblyCullingEngine {
  private occlusionEngine = new OcclusionCullingEngine();
  private visibilityGraph = new VisibilityGraph();

  public getVisibilityGraph(): VisibilityGraph {
    return this.visibilityGraph;
  }

  public getOcclusionEngine(): OcclusionCullingEngine {
    return this.occlusionEngine;
  }

  /**
   * Executes integrated Hierarchical Frustum + Occlusion + Logical Culling pipeline
   */
  public executeCulling(
    graph: AssemblyInstanceGraph,
    spatialIndex: AssemblySpatialIndex,
    frustum: CameraFrustum
  ): {
    visibleInstances: InstanceID[];
    frustumCulledCount: number;
    occlusionCulledCount: number;
    suppressedCount: number;
  } {
    const totalInstances = graph.getAllInstances();
    let suppressedCount = 0;

    // 1. Spatial Frustum Candidates
    const frustumCandidates = spatialIndex.queryFrustumCandidates(frustum);
    const frustumCandidatesSet = new Set(frustumCandidates);

    const visibleInstances: InstanceID[] = [];
    let occlusionCulledCount = 0;

    for (const inst of totalInstances) {
      if (inst.isSuppressed) {
        suppressedCount++;
        continue;
      }

      if (!this.visibilityGraph.isLogicallyVisible(inst.instanceId)) {
        continue;
      }

      // Check Frustum
      if (!frustumCandidatesSet.has(inst.instanceId)) {
        continue;
      }

      // Check Occlusion
      if (this.occlusionEngine.isOccluded(inst.worldBounds, frustum.position)) {
        occlusionCulledCount++;
        continue;
      }

      visibleInstances.push(inst.instanceId);
    }

    const frustumCulledCount = totalInstances.length - frustumCandidates.length - suppressedCount;
    this.visibilityGraph.setRenderVisibleSet(visibleInstances);

    return {
      visibleInstances,
      frustumCulledCount: Math.max(0, frustumCulledCount),
      occlusionCulledCount,
      suppressedCount
    };
  }
}
