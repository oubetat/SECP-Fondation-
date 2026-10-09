/**
 * SECP Industrial OS v3 — CFD Truth Framework
 * Bootstrap file to register all benchmarks in the registry.
 */

import { CFDTruthBenchmarkRegistry } from './CFDTruthBenchmarkRegistry';
import { PoiseuilleFlowBenchmark } from '../benchmarks/PoiseuilleFlowBenchmark';
import { LidDrivenCavityBenchmark } from '../benchmarks/LidDrivenCavityBenchmark';
import { ZpgFlatPlateBenchmark } from '../benchmarks/ZpgFlatPlateBenchmark';
import { MMSBenchmark } from '../benchmarks/MMSBenchmark';
import { Naca0012SstBenchmark } from '../benchmarks/Naca0012SstBenchmark';
import { BackwardFacingStepBenchmark } from '../benchmarks/BackwardFacingStepBenchmark';

export class CFDTruthBootstrap {
  private static bootstrapped = false;

  public static bootstrap(): void {
    if (this.bootstrapped) return;

    // L0 Benchmarks
    CFDTruthBenchmarkRegistry.register(PoiseuilleFlowBenchmark.getEntry());
    CFDTruthBenchmarkRegistry.register(MMSBenchmark.getEntry());

    // L1 Benchmarks
    CFDTruthBenchmarkRegistry.register(LidDrivenCavityBenchmark.getEntry());

    // L2 Benchmarks
    CFDTruthBenchmarkRegistry.register(ZpgFlatPlateBenchmark.getEntry());

    // L3 Benchmarks
    CFDTruthBenchmarkRegistry.register(BackwardFacingStepBenchmark.getEntry());

    // L4 Benchmarks
    CFDTruthBenchmarkRegistry.register(Naca0012SstBenchmark.getEntry());

    this.bootstrapped = true;
    console.log('[CFD-TRUTH] Truth Ladder bootstrapped with L0, L1, L2 benchmarks.');
  }
}
