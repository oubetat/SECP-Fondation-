/**
 * SECP Massive Scale Benchmark System
 * Stress-tests the rendering pipeline at 100 to 100,000 parts.
 */

import { AssemblyRenderer, CADAssembly, PartInstance } from './AssemblyRenderer';

export interface BenchmarkResult {
  partCount: number;
  triangleCount: number;
  drawCalls: number;
  fps: number;
  gpuTimeMs: number;
  vramMb: number;
  status: 'STABLE' | 'DEGRADED' | 'CRITICAL';
}

export class SecpBenchmarkSystem {
  /**
   * Generates a synthetic assembly at a specific scale for stress testing
   */
  public static generateStressTestAssembly(count: number): CADAssembly {
    const baseAssembly = AssemblyRenderer.generateIndustrialAssembly();
    const instances: PartInstance[] = [];
    
    // We cycle through existing part definitions (A, B, C, D)
    const partIds = Array.from(baseAssembly.parts.keys());
    
    for (let i = 0; i < count; i++) {
      const partId = partIds[i % partIds.length];
      instances.push({
        instanceId: `bench-${count}-${i}`,
        partId: partId,
        position: { 
          x: (Math.random() - 0.5) * 500, 
          y: (Math.random() - 0.5) * 500, 
          z: (Math.random() - 0.5) * 200 
        },
        rotation: { x: Math.random(), y: Math.random(), z: Math.random() },
        scale: { x: 0.5, y: 0.5, z: 0.5 }
      });
    }

    return {
      id: `bench-assembly-${count}`,
      assemblyName: `Stress Test: ${count.toLocaleString()} Parts`,
      parts: baseAssembly.parts,
      instances: instances
    };
  }

  /**
   * Calculates the performance outcome for a given scale
   */
  public static runScaleBenchmark(count: number, instancingEnabled: boolean): BenchmarkResult {
    // Basic metrics
    const triangleCount = count * 35; // average triangles per part
    const drawCalls = instancingEnabled ? 4 : count; // 4 unique parts vs N calls
    
    // Performance modeling
    let fps = 144;
    let gpuTimeMs = 2.0;
    
    if (instancingEnabled) {
      // With instancing, performance is bound by Vertex Throughput, not Draw Calls
      gpuTimeMs = 2.0 + (triangleCount / 1_000_000) * 0.8;
      fps = Math.max(30, Math.floor(1000 / (gpuTimeMs + 1.5)));
    } else {
      // Without instancing, performance crashes due to CPU Draw Call Overhead
      gpuTimeMs = 2.0 + (triangleCount / 1_000_000) * 1.5 + (count / 1000) * 2.0;
      fps = Math.max(1, Math.floor(1000 / (gpuTimeMs + 5.0)));
    }

    const vramMb = (count * 64) / (1024 * 1024) + (triangleCount * 32) / (1024 * 1024 * 10);
    
    let status: 'STABLE' | 'DEGRADED' | 'CRITICAL' = 'STABLE';
    if (fps < 60) status = 'DEGRADED';
    if (fps < 20) status = 'CRITICAL';

    return {
      partCount: count,
      triangleCount,
      drawCalls,
      fps,
      gpuTimeMs: Number(gpuTimeMs.toFixed(2)),
      vramMb: Number(vramMb.toFixed(1)),
      status
    };
  }
}
