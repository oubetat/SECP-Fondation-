/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-256 — Stock Removal Simulator & Machining Deviation Map
 */

import {
  Vector3D,
  CuttingTool,
  ToolType,
  Toolpath,
  StockModel,
  MotionType,
} from './ToolpathTypes';

export interface DeviationPoint {
  x: number;
  y: number;
  machinedZ: number;
  targetPartZ: number;
  deviationMm: number; // positive = excess stock (undercut), negative = gouge (overcut)
  status: 'IN_TOLERANCE' | 'EXCESS_STOCK' | 'GOUGE';
}

export interface SimulationResult {
  initialStockVolumeMm3: number;
  finalStockVolumeMm3: number;
  removedVolumeMm3: number;
  removalPercentage: number;
  maxPositiveDeviationMm: number; // Max excess stock
  maxNegativeGougeMm: number;     // Max gouge
  averageDeviationMm: number;
  deviationMap: DeviationPoint[];
  inTolerancePercentage: number;
}

export class StockRemovalSimulator {
  /**
   * Performs discrete heightfield voxel simulation of material removal along toolpaths
   */
  public static simulateStockRemoval(
    initialStock: StockModel,
    toolpaths: Toolpath[],
    tools: Map<string, CuttingTool> | CuttingTool[],
    targetPartGeometry?: {
      evaluateTargetZ: (x: number, y: number) => number;
    },
    gridResolution: number = 60
  ): SimulationResult {
    const toolMap = tools instanceof Map ? tools : new Map(tools.map(t => [t.id, t]));
    const b = initialStock.boundsMm;
    const dx = b.maxX - b.minX;
    const dy = b.maxY - b.minY;
    const cellW = dx / gridResolution;
    const cellH = dy / gridResolution;

    // Heightfield grid initialized to stock top Z
    const heightGrid: number[][] = [];
    for (let r = 0; r < gridResolution; r++) {
      heightGrid[r] = new Array(gridResolution).fill(b.maxZ);
    }

    // Step through each toolpath and cut material
    for (const tp of toolpaths) {
      const tool = toolMap.get(tp.toolId);
      if (!tool) continue;

      const toolRadius = tool.diameterMm / 2;

      for (const seg of tp.segments) {
        if (!seg.isCutting) continue;

        // Sample points along the segment
        const dist = seg.lengthMm;
        const steps = Math.max(1, Math.ceil(dist / (toolRadius * 0.4)));

        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const cx = seg.startPoint.x + (seg.endPoint.x - seg.startPoint.x) * t;
          const cy = seg.startPoint.y + (seg.endPoint.y - seg.startPoint.y) * t;
          const cz = seg.startPoint.z + (seg.endPoint.z - seg.startPoint.z) * t;

          // Determine affected grid cells
          const minGridX = Math.max(0, Math.floor((cx - toolRadius - b.minX) / cellW));
          const maxGridX = Math.min(gridResolution - 1, Math.floor((cx + toolRadius - b.minX) / cellW));
          const minGridY = Math.max(0, Math.floor((cy - toolRadius - b.minY) / cellH));
          const maxGridY = Math.min(gridResolution - 1, Math.floor((cy + toolRadius - b.minY) / cellH));

          for (let gy = minGridY; gy <= maxGridY; gy++) {
            const cellCenterY = b.minY + (gy + 0.5) * cellH;
            const dy2 = (cellCenterY - cy) * (cellCenterY - cy);

            for (let gx = minGridX; gx <= maxGridX; gx++) {
              const cellCenterX = b.minX + (gx + 0.5) * cellW;
              const dx2 = (cellCenterX - cx) * (cellCenterX - cx);
              const r2 = dx2 + dy2;

              if (r2 <= toolRadius * toolRadius) {
                // Calculate tool bottom profile Z at this radial distance
                let cutZ = cz;
                if (tool.type === ToolType.BALL_NOSE) {
                  const distFromCenter = Math.sqrt(r2);
                  const sphereOffset = toolRadius - Math.sqrt(Math.max(0, toolRadius * toolRadius - distFromCenter * distFromCenter));
                  cutZ = cz + sphereOffset;
                } else if (tool.type === ToolType.CHAMFER_MILL || tool.type === ToolType.DRILL) {
                  const distFromCenter = Math.sqrt(r2);
                  const angleRad = ((tool.tipAngleDeg || 118) / 2) * (Math.PI / 180);
                  const coneOffset = distFromCenter / Math.tan(angleRad);
                  cutZ = cz + coneOffset;
                }

                // Carve away stock (heightfield drops)
                if (cutZ < heightGrid[gy][gx]) {
                  heightGrid[gy][gx] = Math.max(b.minZ, cutZ);
                }
              }
            }
          }
        }
      }
    }

    // Volumetric calculation
    const cellArea = cellW * cellH;
    let finalVolumeMm3 = 0;
    const initialVolumeMm3 = dx * dy * (b.maxZ - b.minZ);

    for (let gy = 0; gy < gridResolution; gy++) {
      for (let gx = 0; gx < gridResolution; gx++) {
        const height = heightGrid[gy][gx] - b.minZ;
        finalVolumeMm3 += Math.max(0, height * cellArea);
      }
    }

    const removedVolumeMm3 = Math.max(0, initialVolumeMm3 - finalVolumeMm3);
    const removalPercentage = Number(((removedVolumeMm3 / initialVolumeMm3) * 100).toFixed(1));

    // Deviation Map against Target Part Geometry
    const deviationMap: DeviationPoint[] = [];
    let maxPositiveDev = 0;
    let maxNegativeGouge = 0;
    let totalDev = 0;
    let inTolCount = 0;

    const toleranceBandMm = 0.05; // +/- 50 microns

    for (let gy = 0; gy < gridResolution; gy++) {
      const py = b.minY + (gy + 0.5) * cellH;
      for (let gx = 0; gx < gridResolution; gx++) {
        const px = b.minX + (gx + 0.5) * cellW;
        const machinedZ = heightGrid[gy][gx];
        const targetPartZ = targetPartGeometry ? targetPartGeometry.evaluateTargetZ(px, py) : b.minZ;

        const deviation = machinedZ - targetPartZ;
        totalDev += Math.abs(deviation);

        let status: 'IN_TOLERANCE' | 'EXCESS_STOCK' | 'GOUGE' = 'IN_TOLERANCE';
        if (deviation > toleranceBandMm) {
          status = 'EXCESS_STOCK';
          maxPositiveDev = Math.max(maxPositiveDev, deviation);
        } else if (deviation < -toleranceBandMm) {
          status = 'GOUGE';
          maxNegativeGouge = Math.max(maxNegativeGouge, Math.abs(deviation));
        } else {
          inTolCount++;
        }

        deviationMap.push({
          x: Number(px.toFixed(2)),
          y: Number(py.toFixed(2)),
          machinedZ: Number(machinedZ.toFixed(3)),
          targetPartZ: Number(targetPartZ.toFixed(3)),
          deviationMm: Number(deviation.toFixed(3)),
          status,
        });
      }
    }

    const totalPoints = gridResolution * gridResolution;
    const inTolerancePercentage = Number(((inTolCount / totalPoints) * 100).toFixed(1));

    return {
      initialStockVolumeMm3: Number(initialVolumeMm3.toFixed(2)),
      finalStockVolumeMm3: Number(finalVolumeMm3.toFixed(2)),
      removedVolumeMm3: Number(removedVolumeMm3.toFixed(2)),
      removalPercentage,
      maxPositiveDeviationMm: Number(maxPositiveDev.toFixed(3)),
      maxNegativeGougeMm: Number(maxNegativeGouge.toFixed(3)),
      averageDeviationMm: Number((totalDev / totalPoints).toFixed(3)),
      deviationMap,
      inTolerancePercentage,
    };
  }
}
