import { Naca0012SstBenchmark } from './src/engine/cfd3d/benchmarks/Naca0012SstBenchmark';

async function main() {
  console.log("Running Naca0012SstBenchmark...");
  const result = await Naca0012SstBenchmark.run();
  console.log("RESULT:", JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error("FATAL ERROR:", err);
});
