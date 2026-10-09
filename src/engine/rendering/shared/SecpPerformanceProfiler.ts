/**
 * SECP Performance Profiler Engine
 * Aggregates hardware-level metrics from all rendering subsystems.
 */

export interface PerformanceMetrics {
  fps: number;
  gpuFrameTimeMs: number;
  cpuFrameTimeMs: number;
  drawCalls: number;
  triangles: number;
  visibleObjects: number;
  loadedObjects: number;
  gpuMemoryBytes: number;
  geometryLoadTimeMs: number;
  tessellationTimeMs: number;
  pickingTimeMs: number;
}

export class SecpPerformanceProfiler {
  private static lastTimestamp: number = 0;
  private static frameCount: number = 0;
  private static currentFps: number = 0;

  /**
   * Calculates FPS and simulated frame times based on scene complexity
   */
  public static calculateFrameStats(
    visibleTriangles: number,
    visibleDrawCalls: number
  ): { fps: number; gpuMs: number; cpuMs: number } {
    // Simulate GPU load: base 2ms + 1ms per 1M triangles
    const gpuMs = 2.0 + (visibleTriangles / 1_000_000) * 1.5;
    
    // Simulate CPU load: base 1ms + 0.5ms per 100 draw calls
    const cpuMs = 1.0 + (visibleDrawCalls / 100) * 0.5;
    
    // Total frame time
    const totalMs = Math.max(gpuMs, cpuMs) + 1.2; // overhead
    
    // Calculate FPS
    const fps = Math.min(144, Math.floor(1000 / totalMs));

    return { fps, gpuMs: Number(gpuMs.toFixed(2)), cpuMs: Number(cpuMs.toFixed(2)) };
  }

  public static formatMemory(bytes: number): string {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return gb.toFixed(2) + ' GB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
