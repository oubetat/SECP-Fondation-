/**
 * SECP Industrial OS v3 — CFD Truth Framework
 * Central Registry for CFD Benchmarks and Truth Ladder.
 */

import { 
  CFDTruthLevel, 
  CFDBenchmarkIdentity, 
  CFDBenchmarkContract, 
  CFDBenchmarkExecutionResult, 
  CFDBenchmarkRegistryEntry 
} from './CFDTruthTypes';

export class CFDTruthBenchmarkRegistry {
  private static benchmarks: Map<string, CFDBenchmarkRegistryEntry> = new Map();

  /**
   * Registers a new benchmark in the system.
   */
  public static register(entry: CFDBenchmarkRegistryEntry): void {
    if (this.benchmarks.has(entry.identity.id)) {
      console.warn(`[CFD-TRUTH] Overwriting existing benchmark: ${entry.identity.id}`);
    }
    this.benchmarks.set(entry.identity.id, entry);
    console.log(`[CFD-TRUTH] Registered benchmark ${entry.identity.id} at level ${entry.identity.level}`);
  }

  /**
   * Retrieves a benchmark entry by its ID.
   */
  public static getBenchmark(id: string): CFDBenchmarkRegistryEntry | undefined {
    return this.benchmarks.get(id);
  }

  /**
   * Returns all registered benchmarks.
   */
  public static getAllBenchmarks(): CFDBenchmarkRegistryEntry[] {
    return Array.from(this.benchmarks.values());
  }

  /**
   * Returns benchmarks filtered by truth level.
   */
  public static getBenchmarksByLevel(level: CFDTruthLevel): CFDBenchmarkRegistryEntry[] {
    return this.getAllBenchmarks().filter(b => b.identity.level === level);
  }

  /**
   * Executes a benchmark and returns its result.
   */
  public static async runBenchmark(id: string): Promise<CFDBenchmarkExecutionResult> {
    const entry = this.getBenchmark(id);
    if (!entry) {
      throw new Error(`[CFD-TRUTH] Benchmark not found: ${id}`);
    }

    console.log(`[CFD-TRUTH] Starting benchmark: ${entry.identity.name} (${id})`);
    try {
      const result = await entry.runner();
      console.log(`[CFD-TRUTH] Benchmark ${id} completed with verdict: ${result.verdict}`);
      return result;
    } catch (error) {
      console.error(`[CFD-TRUTH] Benchmark ${id} failed to execute:`, error);
      return {
        benchmarkId: id,
        timestamp: new Date().toISOString(),
        verdict: 'FAIL',
        verificationResults: [],
        convergenceReached: false,
        finalResiduals: {},
        hashes: { mesh: '', solution: '', execution: '' },
        evidencePath: ''
      };
    }
  }

  /**
   * Executes all benchmarks in the truth ladder up to a certain level.
   */
  public static async runLadder(maxLevel?: CFDTruthLevel): Promise<CFDBenchmarkExecutionResult[]> {
    const levels = Object.values(CFDTruthLevel);
    const results: CFDBenchmarkExecutionResult[] = [];
    
    for (const level of levels) {
      const levelBenchmarks = this.getBenchmarksByLevel(level);
      for (const benchmark of levelBenchmarks) {
        const result = await this.runBenchmark(benchmark.identity.id);
        results.push(result);
        
        if (result.verdict === 'FAIL' || result.verdict === 'NOT_PROVEN') {
          console.error(`[CFD-TRUTH] Ladder broken at level ${level} benchmark ${benchmark.identity.id}`);
          // In a real production system, we might stop here (fail-closed)
        }
      }
      
      if (maxLevel && level === maxLevel) break;
    }
    
    return results;
  }
}
