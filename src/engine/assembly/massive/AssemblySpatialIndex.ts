/**
 * SECP Industrial OS v3 — PATCH-180: Assembly Spatial Index & BVH
 * High-performance Bounding Volume Hierarchy supporting incremental updates,
 * fast frustum rejection, and sub-millisecond raycast selection for 50,000+ parts.
 */

import { Vector3D } from '../../cadKernel';
import { 
  InstanceID, 
  BoundingBox3D, 
  Ray3D, 
  RaycastHit, 
  CameraFrustum 
} from './MassiveAssemblyTypes';
import { AssemblyMath } from './AssemblyMath';
import { AssemblyInstanceGraph } from './AssemblyInstanceGraph';

export interface BVHNode {
  bounds: BoundingBox3D;
  left?: BVHNode;
  right?: BVHNode;
  instanceIds?: InstanceID[];
  isLeaf: boolean;
}

export class AssemblySpatialIndex {
  private root: BVHNode | null = null;
  private instanceBoundsMap: Map<InstanceID, BoundingBox3D> = new Map();
  private maxLeafSize: number = 16;

  /**
   * Builds a balanced spatial BVH tree from all registered assembly instances
   */
  public buildIndex(instances: { instanceId: InstanceID; bounds: BoundingBox3D }[]): void {
    this.instanceBoundsMap.clear();
    instances.forEach(inst => this.instanceBoundsMap.set(inst.instanceId, inst.bounds));

    const items = instances.map(i => ({ id: i.instanceId, bounds: i.bounds }));
    this.root = this.buildRecursive(items);
  }

  private buildRecursive(items: { id: InstanceID; bounds: BoundingBox3D }[]): BVHNode {
    if (items.length === 0) {
      return {
        bounds: AssemblyMath.createAABB({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
        isLeaf: true,
        instanceIds: []
      };
    }

    // Compute bounding box of current group
    let groupBounds = items[0].bounds;
    for (let i = 1; i < items.length; i++) {
      groupBounds = AssemblyMath.unionAABB(groupBounds, items[i].bounds);
    }

    if (items.length <= this.maxLeafSize) {
      return {
        bounds: groupBounds,
        isLeaf: true,
        instanceIds: items.map(i => i.id)
      };
    }

    // Split along the largest axis extent
    const ex = groupBounds.extents.x;
    const ey = groupBounds.extents.y;
    const ez = groupBounds.extents.z;
    let axis: 'x' | 'y' | 'z' = 'x';
    if (ey > ex && ey > ez) axis = 'y';
    else if (ez > ex && ez > ey) axis = 'z';

    // Sort items along chosen centroid axis
    items.sort((a, b) => a.bounds.center[axis] - b.bounds.center[axis]);

    const mid = Math.floor(items.length / 2);
    const leftItems = items.slice(0, mid);
    const rightItems = items.slice(mid);

    return {
      bounds: groupBounds,
      isLeaf: false,
      left: this.buildRecursive(leftItems),
      right: this.buildRecursive(rightItems)
    };
  }

  /**
   * Incremental Spatial Update: updates a single instance bounds without rebuilding the full tree
   */
  public updateInstanceBounds(instanceId: InstanceID, newBounds: BoundingBox3D): void {
    this.instanceBoundsMap.set(instanceId, newBounds);
    // Refresh node bounds along traversal
    if (this.root) {
      this.refreshNodeBounds(this.root, instanceId, newBounds);
    }
  }

  private refreshNodeBounds(node: BVHNode, targetId: InstanceID, newBounds: BoundingBox3D): boolean {
    if (node.isLeaf) {
      if (node.instanceIds && node.instanceIds.includes(targetId)) {
        node.bounds = AssemblyMath.unionAABB(node.bounds, newBounds);
        return true;
      }
      return false;
    }

    let modified = false;
    if (node.left && this.refreshNodeBounds(node.left, targetId, newBounds)) modified = true;
    if (node.right && this.refreshNodeBounds(node.right, targetId, newBounds)) modified = true;

    if (modified) {
      const leftBox = node.left ? node.left.bounds : node.bounds;
      const rightBox = node.right ? node.right.bounds : node.bounds;
      node.bounds = AssemblyMath.unionAABB(leftBox, rightBox);
    }

    return modified;
  }

  /**
   * Frustum Culling Query: Traverses spatial BVH and returns all visible instance candidates
   */
  public queryFrustumCandidates(frustum: CameraFrustum): InstanceID[] {
    const visible: InstanceID[] = [];
    if (!this.root) return visible;

    this.traverseFrustum(this.root, frustum, visible);
    return visible;
  }

  private traverseFrustum(node: BVHNode, frustum: CameraFrustum, out: InstanceID[]): void {
    // Test node AABB against frustum. If outside, reject entire subtree!
    if (!AssemblyMath.testAABBFrustum(node.bounds, frustum)) {
      return;
    }

    if (node.isLeaf) {
      if (node.instanceIds) {
        for (let i = 0; i < node.instanceIds.length; i++) {
          const id = node.instanceIds[i];
          const instBox = this.instanceBoundsMap.get(id);
          if (instBox && AssemblyMath.testAABBFrustum(instBox, frustum)) {
            out.push(id);
          }
        }
      }
      return;
    }

    if (node.left) this.traverseFrustum(node.left, frustum, out);
    if (node.right) this.traverseFrustum(node.right, frustum, out);
  }

  /**
   * Raycast Query: Selects closest component instance along ray in $O(\log N)$ time
   */
  public raycast(ray: Ray3D, graph: AssemblyInstanceGraph): RaycastHit | null {
    if (!this.root) return null;

    let closestHit: { id: InstanceID; distance: number } | null = null;
    this.traverseRaycast(this.root, ray, (id, dist) => {
      if (!closestHit || dist < closestHit.distance) {
        closestHit = { id, distance: dist };
      }
    });

    if (!closestHit) return null;

    const inst = graph.getInstance((closestHit as any).id);
    if (!inst) return null;

    const hitPoint: Vector3D = {
      x: ray.origin.x + ray.direction.x * (closestHit as any).distance,
      y: ray.origin.y + ray.direction.y * (closestHit as any).distance,
      z: ray.origin.z + ray.direction.z * (closestHit as any).distance
    };

    return {
      instanceId: inst.instanceId,
      definitionId: inst.definitionId,
      path: inst.path,
      point: hitPoint,
      distance: (closestHit as any).distance,
      normal: { x: 0, y: 0, z: 1 }
    };
  }

  private traverseRaycast(
    node: BVHNode,
    ray: Ray3D,
    onHit: (id: InstanceID, distance: number) => void
  ): void {
    const boxHit = AssemblyMath.raycastAABB(ray, node.bounds);
    if (!boxHit.hit) return;

    if (node.isLeaf) {
      if (node.instanceIds) {
        for (const id of node.instanceIds) {
          const instBox = this.instanceBoundsMap.get(id);
          if (instBox) {
            const hit = AssemblyMath.raycastAABB(ray, instBox);
            if (hit.hit) {
              onHit(id, hit.distance);
            }
          }
        }
      }
      return;
    }

    if (node.left) this.traverseRaycast(node.left, ray, onHit);
    if (node.right) this.traverseRaycast(node.right, ray, onHit);
  }
}
