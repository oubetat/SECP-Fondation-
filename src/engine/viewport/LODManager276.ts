/**
 * PATCH-276: LOD Manager (Level of Detail)
 * Manages dynamic rendering resolution based on camera distance, screen size, and object complexity.
 */

import { SceneNode } from './ViewportTypes276';

export class LODManager {
  private distanceThresholds = {
    highToMedium: 300, // mm
    mediumToLow: 800,  // mm
    lowToBoundingBox: 2000, // mm
  };

  public evaluateLOD(
    node: SceneNode,
    cameraPosition: [number, number, number],
    screenHeightPx: number = 1080
  ): 'HIGH' | 'MEDIUM' | 'LOW' | 'BOUNDING_BOX' {
    // Extract node center (assumed 0,0,0 or transform offset)
    const nx = node.transformMatrix[12] || 0;
    const ny = node.transformMatrix[13] || 0;
    const nz = node.transformMatrix[14] || 0;

    const dx = cameraPosition[0] - nx;
    const dy = cameraPosition[1] - ny;
    const dz = cameraPosition[2] - nz;

    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance < this.distanceThresholds.highToMedium) {
      return 'HIGH';
    } else if (distance < this.distanceThresholds.mediumToLow) {
      return 'MEDIUM';
    } else if (distance < this.distanceThresholds.lowToBoundingBox) {
      return 'LOW';
    } else {
      return 'BOUNDING_BOX';
    }
  }

  public updateSceneLOD(
    rootNodes: SceneNode[],
    cameraPosition: [number, number, number]
  ): void {
    const traverse = (node: SceneNode) => {
      node.lodLevel = this.evaluateLOD(node, cameraPosition);
      for (const child of node.children) {
        traverse(child);
      }
    };

    for (const root of rootNodes) {
      traverse(root);
    }
  }
}
