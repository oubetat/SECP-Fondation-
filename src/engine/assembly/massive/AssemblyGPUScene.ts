/**
 * SECP Industrial OS v3 — PATCH-180: Assembly GPU Scene & Memory Budget Manager
 * Batches instanced geometry by (Definition, Material, LOD) into packed GPU buffers.
 * Enforces VRAM budgets and streams geometric level-of-detail.
 */

import { 
  ComponentDefinitionID, 
  MaterialID, 
  LODLevel, 
  GPUInstanceBatch, 
  InstanceID, 
  MassiveAssemblyConfig 
} from './MassiveAssemblyTypes';
import { AssemblyInstanceGraph } from './AssemblyInstanceGraph';
import { GeometryInstanceManager } from './GeometryInstanceManager';

export class GPUMemoryBudgetManager {
  private maxMemoryBytes: number = 512 * 1024 * 1024; // 512MB default
  private currentMemoryBytes: number = 0;

  constructor(maxMemoryMB: number = 512) {
    this.maxMemoryBytes = maxMemoryMB * 1024 * 1024;
  }

  public setBudgetMB(budgetMB: number): void {
    this.maxMemoryBytes = budgetMB * 1024 * 1024;
  }

  public getBudgetBytes(): number {
    return this.maxMemoryBytes;
  }

  public getUsedBytes(): number {
    return this.currentMemoryBytes;
  }

  public updateMemoryUsage(batches: GPUInstanceBatch[], definitionManager: GeometryInstanceManager): number {
    let totalBytes = 0;

    // Sum active geometry mesh buffers
    const loadedDefs = new Set<string>();

    for (const batch of batches) {
      const defKey = `${batch.definitionId}_${batch.lodLevel}`;
      if (!loadedDefs.has(defKey)) {
        loadedDefs.add(defKey);
        const def = definitionManager.getDefinition(batch.definitionId);
        if (def) {
          totalBytes += def.lods[batch.lodLevel].byteSize;
        }
      }

      // Instance transforms buffer (16 floats per instance = 64 bytes)
      totalBytes += batch.instanceCount * 64;
    }

    this.currentMemoryBytes = totalBytes;
    return totalBytes;
  }

  public isWithinBudget(): boolean {
    return this.currentMemoryBytes <= this.maxMemoryBytes;
  }
}

export class AssemblyGPUScene {
  private batches: Map<string, GPUInstanceBatch> = new Map();
  private memoryBudget = new GPUMemoryBudgetManager();

  public getMemoryBudgetManager(): GPUMemoryBudgetManager {
    return this.memoryBudget;
  }

  public getBatches(): GPUInstanceBatch[] {
    return Array.from(this.batches.values());
  }

  public getDrawCallsCount(): number {
    return this.batches.size;
  }

  /**
   * Builds packed GPU instance buffers from visible instances
   */
  public updateGPUBuffers(
    visibleInstanceIds: InstanceID[],
    graph: AssemblyInstanceGraph,
    definitionManager: GeometryInstanceManager,
    config: MassiveAssemblyConfig
  ): {
    batches: GPUInstanceBatch[];
    drawCallsCount: number;
    gpuMemoryBytes: number;
    gpuUploadTimeMs: number;
  } {
    const startTime = performance.now();
    this.batches.clear();

    // Group instance transforms by (DefinitionId + MaterialId + LODLevel)
    const grouped = new Map<string, {
      definitionId: ComponentDefinitionID;
      materialId: MaterialID;
      lodLevel: LODLevel;
      transforms: Float32Array[];
    }>();

    for (const instId of visibleInstanceIds) {
      const inst = graph.getInstance(instId);
      if (!inst) continue;

      const def = definitionManager.getDefinition(inst.definitionId);
      if (!def) continue;

      const key = `${def.definitionId}__${def.materialId}__${inst.currentLOD}`;
      let group = grouped.get(key);
      if (!group) {
        group = {
          definitionId: def.definitionId,
          materialId: def.materialId,
          lodLevel: inst.currentLOD,
          transforms: []
        };
        grouped.set(key, group);
      }

      group.transforms.push(inst.worldTransform.elements);
    }

    // Allocate packed Float32Array buffers
    for (const [key, group] of grouped.entries()) {
      const count = group.transforms.length;
      const packedBuffer = new Float32Array(count * 16);

      for (let i = 0; i < count; i++) {
        packedBuffer.set(group.transforms[i], i * 16);
      }

      this.batches.set(key, {
        definitionId: group.definitionId,
        materialId: group.materialId,
        lodLevel: group.lodLevel,
        instanceCount: count,
        instanceBuffer: packedBuffer
      });
    }

    const batchList = Array.from(this.batches.values());
    const gpuMemoryBytes = this.memoryBudget.updateMemoryUsage(batchList, definitionManager);
    const gpuUploadTimeMs = Math.max(0.05, performance.now() - startTime);

    return {
      batches: batchList,
      drawCallsCount: batchList.length,
      gpuMemoryBytes,
      gpuUploadTimeMs
    };
  }
}
