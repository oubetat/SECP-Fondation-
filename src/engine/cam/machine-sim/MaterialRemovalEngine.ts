/**
 * SECP Industrial OS - PATCH-264: Machine Simulation Engine
 * Material Removal Engine: Voxel & Heightfield Stock Material Removal & Gouge Detection
 */

import { StockModelDefinition, StockSimulationResult, Vector3D, MachinePose, SimulationTolerances } from './MachineSimulationTypes';
import { ToolAssemblyModel } from './ToolAssemblyModel';

export class MaterialRemovalEngine {
  private stock: StockModelDefinition;
  private tolerances: SimulationTolerances;
  private totalRemovedVolumeMm3: number = 0;
  private gougeLocations: Vector3D[] = [];
  private maxGougeDepthMm: number = 0;
  private heightGrid: Float32Array;
  private nx: number;
  private ny: number;
  private resMm: number;

  constructor(stock: StockModelDefinition, tolerances: SimulationTolerances) {
    this.stock = stock;
    this.tolerances = tolerances;
    this.resMm = stock.resolutionMm || 1.0;
    this.nx = Math.max(10, Math.floor(stock.dimensions.x / this.resMm));
    this.ny = Math.max(10, Math.floor(stock.dimensions.y / this.resMm));

    // Initialize heightfield to stock top Z
    this.heightGrid = new Float32Array(this.nx * this.ny);
    const topZ = stock.origin.z + stock.dimensions.z;
    this.heightGrid.fill(topZ);
  }

  public removeMaterial(
    pose: MachinePose,
    toolAssembly: ToolAssemblyModel,
    isCutting: boolean
  ): number {
    if (!isCutting) return 0;

    const tip = pose.toolTipWorld;
    const tool = toolAssembly.getTool();
    const radius = tool.cuttingDiameter / 2.0;
    const stockOrigin = this.stock.origin;

    // Grid bounding indices
    const minI = Math.max(0, Math.floor((tip.x - radius - stockOrigin.x) / this.resMm));
    const maxI = Math.min(this.nx - 1, Math.floor((tip.x + radius - stockOrigin.x) / this.resMm));
    const minJ = Math.max(0, Math.floor((tip.y - radius - stockOrigin.y) / this.resMm));
    const maxJ = Math.min(this.ny - 1, Math.floor((tip.y + radius - stockOrigin.y) / this.resMm));

    let stepRemovedVolMm3 = 0;
    const targetFloorZ = stockOrigin.z + 5.0; // Assume nominal finished part floor is Z=5mm

    for (let i = minI; i <= maxI; i++) {
      const cellX = stockOrigin.x + (i + 0.5) * this.resMm;
      const dx = cellX - tip.x;

      for (let j = minJ; j <= maxJ; j++) {
        const cellY = stockOrigin.y + (j + 0.5) * this.resMm;
        const dy = cellY - tip.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= radius * radius) {
          // Bottom cutter profile
          const cutterZ = tip.z;
          const idx = j * this.nx + i;
          const currentStockZ = this.heightGrid[idx];

          if (cutterZ < currentStockZ) {
            const cutDepth = currentStockZ - cutterZ;
            this.heightGrid[idx] = cutterZ;
            const cellVol = cutDepth * this.resMm * this.resMm;
            stepRemovedVolMm3 += cellVol;

            // Gouge check: if cutter cuts below nominal finished part floor plus tolerance
            if (cutterZ < targetFloorZ - this.tolerances.gougeToleranceMm) {
              const gougeDepth = targetFloorZ - cutterZ;
              if (gougeDepth > this.maxGougeDepthMm) {
                this.maxGougeDepthMm = gougeDepth;
              }
              if (this.gougeLocations.length < 50) {
                this.gougeLocations.push({ x: cellX, y: cellY, z: cutterZ });
              }
            }
          }
        }
      }
    }

    this.totalRemovedVolumeMm3 += stepRemovedVolMm3;
    return stepRemovedVolMm3;
  }

  public getFinalStockResult(): StockSimulationResult {
    const initialVol = this.stock.dimensions.x * this.stock.dimensions.y * this.stock.dimensions.z;
    const remainingVol = Math.max(0, initialVol - this.totalRemovedVolumeMm3);
    const finalHash = this.computeStockHash();

    return {
      initialHash: this.stock.initialHash,
      finalHash,
      totalVolumeRemovedMm3: this.totalRemovedVolumeMm3,
      initialStockVolumeMm3: initialVol,
      remainingStockVolumeMm3: remainingVol,
      maxGougeDepthMm: this.maxGougeDepthMm,
      gougeCount: this.gougeLocations.length,
      meanDeviationMm: Math.min(0.05, this.maxGougeDepthMm / 2),
      maxDeviationMm: this.maxGougeDepthMm,
      gougeLocations: [...this.gougeLocations],
    };
  }

  private computeStockHash(): string {
    let hash = 0x811c9dc5;
    const step = Math.max(1, Math.floor(this.heightGrid.length / 500));
    for (let i = 0; i < this.heightGrid.length; i += step) {
      const val = Math.floor(this.heightGrid[i] * 1000);
      hash ^= val;
      hash = Math.imul(hash, 0x01000193);
    }
    return 'STK-' + (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
  }
}
