/**
 * SECP Industrial OS v3 — PATCH-180: Assembly LOD Manager & Hysteresis
 * Calculates screen-space error, applies dual-threshold LOD hysteresis,
 * and biases importance for selected or critical structural parts.
 */

import { Vector3D } from '../../cadKernel';
import { 
  InstanceID, 
  LODLevel, 
  ComponentInstance, 
  CameraFrustum, 
  MassiveAssemblyConfig 
} from './MassiveAssemblyTypes';
import { AssemblyInstanceGraph } from './AssemblyInstanceGraph';
import { GeometryInstanceManager } from './GeometryInstanceManager';

export class AssemblyLODManager {
  // Screen pixel thresholds for transitioning LODs
  // [LOD0 -> LOD1, LOD1 -> LOD2, LOD2 -> LOD3, LOD3 -> LOD4]
  private basePixelThresholds = [180, 80, 25, 6];

  /**
   * Computes appropriate LOD for each visible instance using screen-space metrics and hysteresis
   */
  public evaluateLODs(
    visibleInstanceIds: InstanceID[],
    graph: AssemblyInstanceGraph,
    definitionManager: GeometryInstanceManager,
    frustum: CameraFrustum,
    config: MassiveAssemblyConfig
  ): {
    lodDistribution: {
      lod0Full: number;
      lod1Reduced: number;
      lod2Simplified: number;
      lod3Proxy: number;
      lod4Bounds: number;
    };
    totalTrianglesRendered: number;
    totalTrianglesCulled: number;
  } {
    const distribution = {
      lod0Full: 0,
      lod1Reduced: 0,
      lod2Simplified: 0,
      lod3Proxy: 0,
      lod4Bounds: 0
    };

    let totalTrianglesRendered = 0;
    let totalTrianglesCulled = 0;

    const fovRad = (frustum.fovDeg * Math.PI) / 180;
    const fovFactor = 1.0 / Math.tan(fovRad * 0.5);
    const vpHeight = frustum.viewportHeightPx || 800;

    for (const instId of visibleInstanceIds) {
      const inst = graph.getInstance(instId);
      if (!inst) continue;

      const def = definitionManager.getDefinition(inst.definitionId);
      if (!def) continue;

      // Distance from camera to bounding sphere center
      const dx = inst.worldSphere.center.x - frustum.position.x;
      const dy = inst.worldSphere.center.y - frustum.position.y;
      const dz = inst.worldSphere.center.z - frustum.position.z;
      const distance = Math.max(0.1, Math.hypot(dx, dy, dz));

      // Screen space projected pixel radius
      const pixelSize = (inst.worldSphere.radius / distance) * vpHeight * fovFactor;

      inst.lastVisibleDistance = distance;
      inst.lastScreenPixelSize = pixelSize;

      let chosenLOD: LODLevel = 'LOD4_BOUNDS';

      // Selection or high importance bias
      if (inst.isSelected || inst.isHighlighted) {
        chosenLOD = 'LOD0_FULL';
      } else {
        // Effective pixel size weighted by importance
        const effectivePixelSize = pixelSize * (inst.importanceWeight || 1.0);

        chosenLOD = this.determineLODWithHysteresis(
          inst.currentLOD,
          effectivePixelSize,
          config.lodHysteresisBandPct
        );
      }

      inst.currentLOD = chosenLOD;

      // Accumulate metrics
      switch (chosenLOD) {
        case 'LOD0_FULL':
          distribution.lod0Full++;
          break;
        case 'LOD1_REDUCED':
          distribution.lod1Reduced++;
          break;
        case 'LOD2_SIMPLIFIED':
          distribution.lod2Simplified++;
          break;
        case 'LOD3_PROXY':
          distribution.lod3Proxy++;
          break;
        case 'LOD4_BOUNDS':
          distribution.lod4Bounds++;
          break;
      }

      const activeTriangles = def.lods[chosenLOD].triangleCount;
      const fullTriangles = def.lods.LOD0_FULL.triangleCount;

      totalTrianglesRendered += activeTriangles;
      totalTrianglesCulled += Math.max(0, fullTriangles - activeTriangles);
    }

    return {
      lodDistribution: distribution,
      totalTrianglesRendered,
      totalTrianglesCulled
    };
  }

  /**
   * Dual-threshold hysteresis logic to prevent flip-flopping at boundaries
   */
  private determineLODWithHysteresis(
    currentLOD: LODLevel,
    pixelSize: number,
    hysteresisBandPct: number = 15
  ): LODLevel {
    const band = 1.0 + hysteresisBandPct / 100.0;
    const bandLow = 1.0 - hysteresisBandPct / 100.0;

    const t0 = this.basePixelThresholds[0];
    const t1 = this.basePixelThresholds[1];
    const t2 = this.basePixelThresholds[2];
    const t3 = this.basePixelThresholds[3];

    if (currentLOD === 'LOD0_FULL') {
      if (pixelSize < t0 * bandLow) return 'LOD1_REDUCED';
      return 'LOD0_FULL';
    } else if (currentLOD === 'LOD1_REDUCED') {
      if (pixelSize > t0 * band) return 'LOD0_FULL';
      if (pixelSize < t1 * bandLow) return 'LOD2_SIMPLIFIED';
      return 'LOD1_REDUCED';
    } else if (currentLOD === 'LOD2_SIMPLIFIED') {
      if (pixelSize > t1 * band) return 'LOD1_REDUCED';
      if (pixelSize < t2 * bandLow) return 'LOD3_PROXY';
      return 'LOD2_SIMPLIFIED';
    } else if (currentLOD === 'LOD3_PROXY') {
      if (pixelSize > t2 * band) return 'LOD2_SIMPLIFIED';
      if (pixelSize < t3 * bandLow) return 'LOD4_BOUNDS';
      return 'LOD3_PROXY';
    } else {
      // LOD4_BOUNDS
      if (pixelSize > t3 * band) return 'LOD3_PROXY';
      return 'LOD4_BOUNDS';
    }
  }
}
