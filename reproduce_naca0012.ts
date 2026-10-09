
import { Naca0012SstBenchmark } from './src/engine/cfd3d/benchmarks/Naca0012SstBenchmark';
import * as fs from 'fs';

async function reproduce() {
  console.log("Starting NACA0012 Baseline Reproduction...");
  
  // Baseline settings from forensic report:
  // Fine (1): 120 x 60, Cells: 7,260
  // AoA = 10, Re = 6e6, Mach = 0.15
  
  const options = {
    nx: 120,
    ny: 60,
    aoa: 10,
    re: 6e6,
    mach: 0.15
  };

  try {
    const report = await Naca0012SstBenchmark.run(options);
    
    console.log("REPRODUCTION RESULTS:");
    console.log(`Verdict: ${report.verdict}`);
    console.log(`Status: ${report.results.status}`);
    console.log(`CL: ${report.results.cl}`);
    console.log(`CD: ${report.results.cd}`);
    console.log(`Cm: ${report.results.cm}`);
    console.log(`Iterations: ${report.results.iterations}`);
    
    if (report.results.convergence) {
        console.log(`Momentum L-inf: ${report.results.convergence.momentumLinf}`);
    }

    fs.writeFileSync('reproduction_report.json', JSON.stringify(report, null, 2));
    console.log("Report saved to reproduction_report.json");
  } catch (error) {
    console.error("Reproduction failed:", error);
  }
}

reproduce();
