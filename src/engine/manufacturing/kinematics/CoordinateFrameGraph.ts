import { HomogeneousTransform } from "./types";
import { KinematicMath } from "./KinematicMath";

export interface FrameParentRelation {
  parentId: string;
  transformToParent: HomogeneousTransform;
}

export interface FrameNode {
  id: string;
  parents: FrameParentRelation[];
}

export class CoordinateFrameGraph {
  private frames: Map<string, FrameNode> = new Map();
  private tolerance: number = 0.005;

  constructor(tolerance: number = 0.005) {
    this.tolerance = tolerance;
  }

  public addFrame(id: string, parentId?: string, transformToParent?: HomogeneousTransform): void {
    let node = this.frames.get(id);
    if (!node) {
      node = { id, parents: [] };
      this.frames.set(id, node);
    }
    // Also ensure parent is registered as a node if it is not already
    if (parentId && !this.frames.has(parentId)) {
      this.frames.set(parentId, { id: parentId, parents: [] });
    }
    if (parentId && transformToParent) {
      node.parents.push({ parentId, transformToParent });
    }
  }

  /**
   * Find all simple paths between two frames in an undirected graph sense.
   * Path is returned as a list of steps, where each step has the node ID and direction (true if moving to parent, false if moving to child)
   */
  public findAllPaths(fromId: string, toId: string): { id: string; toParent: boolean }[][] {
    const paths: { id: string; toParent: boolean }[][] = [];
    const visited = new Set<string>();

    const dfs = (current: string, target: string, currentPath: { id: string; toParent: boolean }[]) => {
      if (current === target) {
        paths.push([...currentPath]);
        return;
      }

      visited.add(current);

      const node = this.frames.get(current);
      if (node) {
        // Option 1: Move to parent
        for (const rel of node.parents) {
          if (!visited.has(rel.parentId)) {
            currentPath.push({ id: rel.parentId, toParent: true });
            dfs(rel.parentId, target, currentPath);
            currentPath.pop();
          }
        }

        // Option 2: Move to children
        for (const child of this.frames.values()) {
          const hasParent = child.parents.some(p => p.parentId === current);
          if (hasParent && !visited.has(child.id)) {
            currentPath.push({ id: child.id, toParent: false });
            dfs(child.id, target, currentPath);
            currentPath.pop();
          }
        }
      }

      visited.delete(current);
    };

    dfs(fromId, toId, []);
    return paths;
  }

  /**
   * Composes transform along a path.
   */
  public composePathTransform(fromId: string, path: { id: string; toParent: boolean }[]): HomogeneousTransform {
    let T = KinematicMath.createIdentity();
    let currentId = fromId;

    for (const step of path) {
      if (step.toParent) {
        const node = this.frames.get(currentId);
        if (node) {
          const rel = node.parents.find(p => p.parentId === step.id);
          if (rel) {
            T = KinematicMath.multiply(T, rel.transformToParent);
          }
        }
      } else {
        const childNode = this.frames.get(step.id);
        if (childNode) {
          const rel = childNode.parents.find(p => p.parentId === currentId);
          if (rel) {
            const inv = KinematicMath.invert(rel.transformToParent);
            T = KinematicMath.multiply(T, inv);
          }
        }
      }
      currentId = step.id;
    }

    return T;
  }

  /**
   * Solves the transform between two frames. If multiple paths exist, verifies consistency.
   */
  public getTransform(fromId: string, toId: string): { transform: HomogeneousTransform; isConsistent: boolean; errorMsg?: string } {
    if (!this.frames.has(fromId)) {
      return { transform: KinematicMath.createIdentity(), isConsistent: false, errorMsg: `Source frame '${fromId}' not found` };
    }
    if (!this.frames.has(toId)) {
      return { transform: KinematicMath.createIdentity(), isConsistent: false, errorMsg: `Target frame '${toId}' not found` };
    }

    if (fromId === toId) {
      return { transform: KinematicMath.createIdentity(), isConsistent: true };
    }

    const paths = this.findAllPaths(fromId, toId);
    if (paths.length === 0) {
      return { transform: KinematicMath.createIdentity(), isConsistent: false, errorMsg: `No path found between '${fromId}' and '${toId}' (disconnected graph)` };
    }

    // Compute transform along first path
    const primaryTransform = this.composePathTransform(fromId, paths[0]);

    // Check consistency across other paths
    for (let i = 1; i < paths.length; i++) {
      const altTransform = this.composePathTransform(fromId, paths[i]);
      if (!this.areTransformsEqual(primaryTransform, altTransform, this.tolerance)) {
        return {
          transform: primaryTransform,
          isConsistent: false,
          errorMsg: `FRAME_INCONSISTENCY: Multiple transform paths between '${fromId}' and '${toId}' yield different results`
        };
      }
    }

    return { transform: primaryTransform, isConsistent: true };
  }

  /**
   * Deep validation of the frame graph for cycles, disconnected frames, and transform path conflicts.
   */
  public validateGraph(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 1. Check for cycles/circular definitions
    const visitedSet = new Set<string>();
    const stackSet = new Set<string>();
    
    const checkCycle = (curr: string): boolean => {
      if (stackSet.has(curr)) return true;
      if (visitedSet.has(curr)) return false;

      visitedSet.add(curr);
      stackSet.add(curr);

      const node = this.frames.get(curr);
      if (node) {
        for (const p of node.parents) {
          if (checkCycle(p.parentId)) return true;
        }
      }

      stackSet.delete(curr);
      return false;
    };

    for (const frameId of this.frames.keys()) {
      if (checkCycle(frameId)) {
        errors.push(`Circular frame definition detected starting from frame '${frameId}'`);
        break;
      }
    }

    // 2. Check for missing parents
    for (const node of this.frames.values()) {
      for (const rel of node.parents) {
        if (!this.frames.has(rel.parentId)) {
          errors.push(`Frame '${node.id}' refers to non-existent parent '${rel.parentId}'`);
        }
      }
    }

    // 3. Multi-path agreement check
    const keys = Array.from(this.frames.keys());
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const solverRes = this.getTransform(keys[i], keys[j]);
        if (!solverRes.isConsistent && solverRes.errorMsg) {
          errors.push(solverRes.errorMsg);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private areTransformsEqual(A: HomogeneousTransform, B: HomogeneousTransform, tol: number): boolean {
    const a = A.matrix;
    const b = B.matrix;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (Math.abs(a[r][c] - b[r][c]) > tol) {
          return false;
        }
      }
    }
    return true;
  }
}
