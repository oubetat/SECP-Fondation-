const { Naca0012SstBenchmark } = require('./src/engine/cfd3d/benchmarks/Naca0012SstBenchmark.ts');

async function main() {
  console.log("=== SECP CFD FORENSIC AUDIT: NACA 0012 ===");
  const result = await Naca0012SstBenchmark.run({
    nx: 40,
    ny: 20,
    aoa: 2.0,
    re: 3000000,
    mach: 0.15
  });
  console.log(JSON.stringify(result.results, null, 2));
}

main().catch(console.error);
