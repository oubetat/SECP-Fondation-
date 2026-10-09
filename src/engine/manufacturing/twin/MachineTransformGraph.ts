import { HomogeneousTransform } from "../kinematics/types";
import { KinematicMath } from "../kinematics/KinematicMath";
import { MachineTransformGraph, TransformEdge, StateProvenanceSource } from "./types";

export class MachineTransformGraphEngine {
  private graph: MachineTransformGraph;

  constructor() {
    this.graph = {
      frames: ["WORLD", "BASE", "MACHINE", "SPINDLE", "TOOL", "TABLE", "FIXTURE", "WORKPIECE"],
      transforms: []
    };
    this.initializeDefaultGraph();
  }

  private initializeDefaultGraph(): void {
    const now = Date.now();
    // Default transformations (Identities and standard offsets)
    this.addTransform("WORLD", "BASE", KinematicMath.createIdentity(), now, StateProvenanceSource.CONFIGURED);
    this.addTransform("BASE", "MACHINE", KinematicMath.createIdentity(), now, StateProvenanceSource.CONFIGURED);
    this.addTransform("MACHINE", "TABLE", KinematicMath.createTranslation(0, 0, 200), now, StateProvenanceSource.CONFIGURED);
    this.addTransform("TABLE", "FIXTURE", KinematicMath.createTranslation(0, 0, 50), now, StateProvenanceSource.CONFIGURED);
    this.addTransform("FIXTURE", "WORKPIECE", KinematicMath.createTranslation(0, 0, 20), now, StateProvenanceSource.CONFIGURED);
    this.addTransform("MACHINE", "SPINDLE", KinematicMath.createTranslation(0, 0, 500), now, StateProvenanceSource.DERIVED);
    this.addTransform("SPINDLE", "TOOL", KinematicMath.createTranslation(0, 0, -100), now, StateProvenanceSource.MEASURED);
  }

  public addTransform(
    sourceFrame: string,
    targetFrame: string,
    transform: HomogeneousTransform,
    timestamp: number,
    provenance: StateProvenanceSource
  ): void {
    if (!this.graph.frames.includes(sourceFrame)) this.graph.frames.push(sourceFrame);
    if (!this.graph.frames.includes(targetFrame)) this.graph.frames.push(targetFrame);

    // Remove existing edge if present
    this.graph.transforms = this.graph.transforms.filter(
      t => !(t.sourceFrame === sourceFrame && t.targetFrame === targetFrame)
    );

    this.graph.transforms.push({
      sourceFrame,
      targetFrame,
      transform,
      timestamp,
      revision: 1,
      provenance
    });
  }

  public getTransform(sourceFrame: string, targetFrame: string): HomogeneousTransform | null {
    if (sourceFrame === targetFrame) return KinematicMath.createIdentity();

    // Direct edge
    const direct = this.graph.transforms.find(t => t.sourceFrame === sourceFrame && t.targetFrame === targetFrame);
    if (direct) return direct.transform;

    // Inverse direct edge
    const inverse = this.graph.transforms.find(t => t.sourceFrame === targetFrame && t.targetFrame === sourceFrame);
    if (inverse) return KinematicMath.invert(inverse.transform);

    // Shortest path / BFS in transform tree
    const path = this.findPath(sourceFrame, targetFrame);
    if (!path || path.length < 2) return null;

    let composite = KinematicMath.createIdentity();
    for (let i = 0; i < path.length - 1; i++) {
      const u = path[i];
      const v = path[i + 1];
      const edge = this.graph.transforms.find(t => t.sourceFrame === u && t.targetFrame === v);
      if (edge) {
        composite = KinematicMath.multiply(composite, edge.transform);
      } else {
        const invEdge = this.graph.transforms.find(t => t.sourceFrame === v && t.targetFrame === u);
        if (invEdge) {
          composite = KinematicMath.multiply(composite, KinematicMath.invert(invEdge.transform));
        } else {
          return null;
        }
      }
    }

    return composite;
  }

  private findPath(start: string, goal: string): string[] | null {
    const queue: string[][] = [[start]];
    const visited = new Set<string>([start]);

    while (queue.length > 0) {
      const currentPath = queue.shift()!;
      const node = currentPath[currentPath.length - 1];

      if (node === goal) return currentPath;

      // Find neighbors
      const neighbors: string[] = [];
      for (const t of this.graph.transforms) {
        if (t.sourceFrame === node && !visited.has(t.targetFrame)) neighbors.push(t.targetFrame);
        if (t.targetFrame === node && !visited.has(t.sourceFrame)) neighbors.push(t.sourceFrame);
      }

      for (const neighbor of neighbors) {
        visited.add(neighbor);
        queue.push([...currentPath, neighbor]);
      }
    }
    return null;
  }

  public validateTransformChain(frameA: string, frameB: string, frameC: string, tolerance: number = 1e-4): { isValid: boolean; maxDeviation: number } {
    const tAB = this.getTransform(frameA, frameB);
    const tBC = this.getTransform(frameB, frameC);
    const tAC = this.getTransform(frameA, frameC);

    if (!tAB || !tBC || !tAC) {
      return { isValid: false, maxDeviation: Infinity };
    }

    const tAC_computed = KinematicMath.multiply(tAB, tBC);
    let maxDeviation = 0;

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const diff = Math.abs(tAC_computed.matrix[r][c] - tAC.matrix[r][c]);
        if (diff > maxDeviation) maxDeviation = diff;
      }
    }

    return {
      isValid: maxDeviation <= tolerance,
      maxDeviation
    };
  }

  public getGraphData(): MachineTransformGraph {
    return { ...this.graph };
  }
}
