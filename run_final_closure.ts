
import { Naca0012SstBenchmark } from './src/engine/cfd3d/benchmarks/Naca0012SstBenchmark';
import * as fs from 'fs';

async function runFinal() {
  console.log("Running High-Fidelity 180x90 NACA0012 Verification & Validation Closure...");
  const options = {
    nx: 180,
    ny: 90,
    aoa: 10,
    re: 6e6,
    mach: 0.15
  };
  try {
    const report = await Naca0012SstBenchmark.run(options);
    console.log("FINAL REPORT VERDICT:", report.verdict);
    console.log("FINAL GCI STATUS:", JSON.stringify(report.results.gci, null, 2));
    console.log("FINAL Telemetry / Status:", report.results.status);
    console.log("Fine Grid Converged:", report.results.multiGridComparison.fine.converged);
    console.log("Fine Grid CL:", report.results.multiGridComparison.fine.CL);
    console.log("Fine Grid CD:", report.results.multiGridComparison.fine.CD);
    console.log("Fine Grid Momentum L-inf:", report.results.continuity?.local?.linf);
    
    fs.writeFileSync('final_closure_report.json', JSON.stringify(report, null, 2));
    console.log("Saved final_closure_report.json");
  } catch (err) {
    console.error("Execution failed:", err);
  }
}

runFinal();
