import { Naca0012SstBenchmark } from './src/engine/cfd3d/benchmarks/Naca0012SstBenchmark';

async function main() {
  try {
    const report = await Naca0012SstBenchmark.run({
      nx: 120, // 120 points on surface
      ny: 60,  // 60 layers
      aoa: 10.0,
      re: 6.0e6,
      mach: 0.15
    });
    console.log('--- BENCHMARK EVIDENCE START ---');
    console.log(JSON.stringify(report, null, 2));
    console.log('--- BENCHMARK EVIDENCE END ---');
  } catch (err) {
    console.error('Benchmark failed:', err);
    process.exit(1);
  }
}

main();
