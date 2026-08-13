/**
 * SECP High-Performance Assembly Renderer
 * Handles massive component counts using GPU Instancing,
 * geometry batching, and mapped instance transform buffers.
 */

import { VisualizationMesh } from './GpuGeometryPipeline';

export interface PartDefinition {
  partId: string;
  name: string;
  mesh: VisualizationMesh;
  materialColor: { r: number; g: number; b: number };
}

export interface PartInstance {
  instanceId: string;
  partId: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number }; // Euler angles
  scale: { x: number; y: number; z: number };
}

export interface CADAssembly {
  id: string;
  assemblyName: string;
  parts: Map<string, PartDefinition>;
  instances: PartInstance[];
}

export class AssemblyRenderer {
  /**
   * Translates massive CAD repetition numbers into high-performance GPU batches
   */
  public static compileAssemblyBatches(assembly: CADAssembly): {
    batches: Array<{
      partId: string;
      partName: string;
      instanceCount: number;
      triangleCount: number;
      drawCallsUsingStandardRenderer: number;
      drawCallsUsingGpuInstancing: number;
      instancedBufferBytes: number;
    }>;
    totalInstances: number;
    totalTriangles: number;
    nonInstancedDrawCalls: number;
    instancedDrawCalls: number;
    vramSavingsPercentage: number;
  } {
    const batches: Array<any> = [];
    let totalInstances = 0;
    let totalTriangles = 0;

    // Count repetitive instances of each unique Part ID
    const counts = new Map<string, number>();
    for (const inst of assembly.instances) {
      counts.set(inst.partId, (counts.get(inst.partId) || 0) + 1);
    }

    counts.forEach((count, partId) => {
      const part = assembly.parts.get(partId);
      if (!part) return;

      const singleTriangles = part.mesh.triangleCount;
      const batchTriangles = singleTriangles * count;
      totalInstances += count;
      totalTriangles += batchTriangles;

      // Each instance requires a 4x4 matrix (16 floats * 4 bytes = 64 bytes)
      const instancedBufferBytes = count * 64;

      batches.push({
        partId,
        partName: part.name,
        instanceCount: count,
        triangleCount: batchTriangles,
        drawCallsUsingStandardRenderer: count, // 1 draw call per part
        drawCallsUsingGpuInstancing: 1,       // 1 single Draw Call per part TYPE
        instancedBufferBytes,
      });
    });

    const nonInstancedDrawCalls = totalInstances;
    const instancedDrawCalls = batches.length; // 1 draw call per unique part batch
    const vramSavingsPercentage = Number(
      (((nonInstancedDrawCalls - instancedDrawCalls) / nonInstancedDrawCalls) * 100).toFixed(2)
    );

    return {
      batches,
      totalInstances,
      totalTriangles,
      nonInstancedDrawCalls,
      instancedDrawCalls,
      vramSavingsPercentage,
    };
  }

  /**
   * Mock generation of a massive industrial assembly (Parts A, B, C, D)
   * with the quantities specified in the patch rules (100, 500, 2000, 10000)
   */
  public static generateIndustrialAssembly(): CADAssembly {
    const parts = new Map<string, PartDefinition>();

    // Standard CAD Geometry definitions
    const cylinderMesh: VisualizationMesh = {
      id: 'vis-part-a',
      vertices: new Float32Array(36 * 3),
      normals: new Float32Array(36 * 3),
      indices: new Uint32Array(34 * 3),
      triangleCount: 34,
      memoryBytes: 3000
    };

    const boltMesh: VisualizationMesh = {
      id: 'vis-part-b',
      vertices: new Float32Array(72 * 3),
      normals: new Float32Array(72 * 3),
      indices: new Uint32Array(68 * 3),
      triangleCount: 68,
      memoryBytes: 6000
    };

    const rivetMesh: VisualizationMesh = {
      id: 'vis-part-c',
      vertices: new Float32Array(16 * 3),
      normals: new Float32Array(16 * 3),
      indices: new Uint32Array(12 * 3),
      triangleCount: 12,
      memoryBytes: 1100
    };

    const washerMesh: VisualizationMesh = {
      id: 'vis-part-d',
      vertices: new Float32Array(24 * 3),
      normals: new Float32Array(24 * 3),
      indices: new Uint32Array(20 * 3),
      triangleCount: 20,
      memoryBytes: 1800
    };

    parts.set('part-a', {
      partId: 'part-a',
      name: 'Flange Joint Connector A',
      mesh: cylinderMesh,
      materialColor: { r: 0.38, g: 0.40, b: 0.94 }
    });

    parts.set('part-b', {
      partId: 'part-b',
      name: 'High-Tensile Steel Hex Bolt B',
      mesh: boltMesh,
      materialColor: { r: 0.94, g: 0.38, b: 0.40 }
    });

    parts.set('part-c', {
      partId: 'part-c',
      name: 'Threaded Anchor Rivet C',
      mesh: rivetMesh,
      materialColor: { r: 0.38, g: 0.94, b: 0.40 }
    });

    parts.set('part-d', {
      partId: 'part-d',
      name: 'Anti-Vibration Sealing Washer D',
      mesh: washerMesh,
      materialColor: { r: 0.94, g: 0.94, b: 0.38 }
    });

    const instances: PartInstance[] = [];

    // Inject exact rep quantities from user guidelines
    // Part A: 100
    for (let i = 0; i < 100; i++) {
      instances.push({
        instanceId: `inst-a-${i}`,
        partId: 'part-a',
        position: { x: Math.cos(i) * 15, y: Math.sin(i) * 15, z: i * 0.1 },
        rotation: { x: 0, y: 0, z: i },
        scale: { x: 1, y: 1, z: 1 }
      });
    }

    // Part B: 500
    for (let i = 0; i < 500; i++) {
      instances.push({
        instanceId: `inst-b-${i}`,
        partId: 'part-b',
        position: { x: Math.cos(i) * 25, y: Math.sin(i) * 25, z: i * 0.05 },
        rotation: { x: i * 0.01, y: 0, z: 0 },
        scale: { x: 0.8, y: 0.8, z: 0.8 }
      });
    }

    // Part C: 2000
    for (let i = 0; i < 2000; i++) {
      instances.push({
        instanceId: `inst-c-${i}`,
        partId: 'part-c',
        position: { x: Math.cos(i * 0.1) * 35, y: Math.sin(i * 0.1) * 35, z: Math.sin(i) * 5 },
        rotation: { x: 0, y: i, z: 0 },
        scale: { x: 0.5, y: 0.5, z: 0.5 }
      });
    }

    // Part D: 10000
    for (let i = 0; i < 10000; i++) {
      instances.push({
        instanceId: `inst-d-${i}`,
        partId: 'part-d',
        position: { x: (Math.random() - 0.5) * 100, y: (Math.random() - 0.5) * 100, z: (Math.random() - 0.5) * 40 },
        rotation: { x: Math.random(), y: Math.random(), z: Math.random() },
        scale: { x: 0.4, y: 0.4, z: 0.4 }
      });
    }

    return {
      id: 'assembly-industrial-boiler-031',
      assemblyName: 'Industrial Boiler Fluid-Manifold Assembly',
      parts,
      instances
    };
  }
}
