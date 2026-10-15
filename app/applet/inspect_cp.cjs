const { Naca0012SstBenchmark } = require('./src/engine/cfd3d/benchmarks/Naca0012SstBenchmark');

async function main() {
  console.log("=== INSPECTING NACA 0012 CP DISTRIBUTION ===");
  const benchmarkResult = Naca0012SstBenchmark.solveGridLevel('Fine', 40, 20, {
    nx: 40,
    ny: 20,
    aoa: 2.0,
    re: 3000000,
    mach: 0.15
  });

  const evidence = benchmarkResult.evidence;
  console.log(`CL: ${evidence.CL.toFixed(4)}, CD: ${evidence.CD.toFixed(4)}`);
  console.log(`Converged: ${evidence.converged}, Iterations: ${evidence.iterations}`);
  
  console.log("\nCp Distribution Sample:");
  const sampleX = [0.005, 0.05, 0.25, 0.50, 0.75, 0.95];
  for (const sx of sampleX) {
    const upperPt = evidence.cpDistribution.find(d => d.side === 'upper' && Math.abs(d.x - sx) < 0.03);
    const lowerPt = evidence.cpDistribution.find(d => d.side === 'lower' && Math.abs(d.x - sx) < 0.03);
    console.log(`x/c ≈ ${sx}: Upper Cp = ${upperPt ? upperPt.cp.toFixed(4) : 'N/A'}, Lower Cp = ${lowerPt ? lowerPt.cp.toFixed(4) : 'N/A'}`);
  }

  console.log("\nForces breakdown:");
  console.log(JSON.stringify(benchmarkResult.solution.monitors.forces, null, 2));
}

main().catch(console.error);
