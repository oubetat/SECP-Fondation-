import { Point3D } from "../collision/types";
import { SimulationStock, RemovalRepresentation } from "./types";
import { ToolInstance } from "../toolLibrary/types";

export class MaterialRemovalEngine {
  private stock: SimulationStock;
  private voxelGrid: Uint8Array;
  private gridDims: { nx: number; ny: number; nz: number };
  private voxelSize: number;
  private totalRemovedVolume: number = 0;

  constructor(stock: SimulationStock) {
    this.stock = stock;
    this.voxelSize = stock.resolution || 1.0;
    
    // Calculate grid dimensions based on bounding box
    const dx = stock.boundingBox.max.x - stock.boundingBox.min.x;
    const dy = stock.boundingBox.max.y - stock.boundingBox.min.y;
    const dz = stock.boundingBox.max.z - stock.boundingBox.min.z;

    this.gridDims = {
      nx: Math.ceil(dx / this.voxelSize),
      ny: Math.ceil(dy / this.voxelSize),
      nz: Math.ceil(dz / this.voxelSize)
    };

    // Initialize voxel grid (1 = material present)
    const totalVoxels = this.gridDims.nx * this.gridDims.ny * this.gridDims.nz;
    this.voxelGrid = new Uint8Array(totalVoxels).fill(1);
  }

  public removeMaterial(toolPose: { position: Point3D; orientation: Point3D }, tool: ToolInstance): number {
    let removedThisStep = 0;
    const toolRadius = ((tool as any).geometry.diameter || 10) / 2;
    const toolHeight = (tool as any).geometry.fluteLength || 50;

    // Simplified removal: spherical or cylindrical swept volume approximation
    // Find voxels within the tool's volume at the current pose
    const minGrid = this.worldToGrid({
      x: toolPose.position.x - toolRadius,
      y: toolPose.position.y - toolRadius,
      z: toolPose.position.z - toolHeight
    });
    const maxGrid = this.worldToGrid({
      x: toolPose.position.x + toolRadius,
      y: toolPose.position.y + toolRadius,
      z: toolPose.position.z
    });

    for (let x = Math.max(0, minGrid.ix); x <= Math.min(this.gridDims.nx - 1, maxGrid.ix); x++) {
      for (let y = Math.max(0, minGrid.iy); y <= Math.min(this.gridDims.ny - 1, maxGrid.iy); y++) {
        for (let z = Math.max(0, minGrid.iz); z <= Math.min(this.gridDims.nz - 1, maxGrid.iz); z++) {
          const idx = this.getVoxelIndex(x, y, z);
          if (this.voxelGrid[idx] === 1) {
            const worldPt = this.gridToWorld(x, y, z);
            if (this.isPointInsideTool(worldPt, toolPose, toolRadius, toolHeight)) {
              this.voxelGrid[idx] = 0;
              removedThisStep += Math.pow(this.voxelSize, 3);
            }
          }
        }
      }
    }

    this.totalRemovedVolume += removedThisStep;
    return removedThisStep;
  }

  private isPointInsideTool(pt: Point3D, pose: { position: Point3D; orientation: Point3D }, radius: number, height: number): boolean {
    // Simple cylinder oriented in Z for now (can be expanded for 5-axis orientation)
    const dx = pt.x - pose.position.x;
    const dy = pt.y - pose.position.y;
    const dz = pt.z - pose.position.z;

    const r2 = dx * dx + dy * dy;
    if (r2 <= radius * radius) {
      if (dz >= -height && dz <= 0) {
        return true;
      }
    }
    return false;
  }

  private worldToGrid(pt: Point3D): { ix: number; iy: number; iz: number } {
    return {
      ix: Math.floor((pt.x - this.stock.boundingBox.min.x) / this.voxelSize),
      iy: Math.floor((pt.y - this.stock.boundingBox.min.y) / this.voxelSize),
      iz: Math.floor((pt.z - this.stock.boundingBox.min.z) / this.voxelSize)
    };
  }

  private gridToWorld(ix: number, iy: number, iz: number): Point3D {
    return {
      x: this.stock.boundingBox.min.x + (ix + 0.5) * this.voxelSize,
      y: this.stock.boundingBox.min.y + (iy + 0.5) * this.voxelSize,
      z: this.stock.boundingBox.min.z + (iz + 0.5) * this.voxelSize
    };
  }

  private getVoxelIndex(ix: number, iy: number, iz: number): number {
    return ix + iy * this.gridDims.nx + iz * this.gridDims.nx * this.gridDims.ny;
  }

  public getHash(): string {
    // Simplified hash of the grid state
    let hash = 0;
    for (let i = 0; i < this.voxelGrid.length; i += 100) { // Sample every 100th voxel for performance
      hash = (hash << 5) - hash + this.voxelGrid[i];
      hash |= 0;
    }
    return `STOCK_STATE_${hash.toString(16)}`;
  }

  public getStock(): SimulationStock {
    return {
      ...this.stock,
      volume: this.stock.volume - this.totalRemovedVolume
    };
  }

  public getVoxelData(): Uint8Array {
    return this.voxelGrid;
  }
}
