
import { Naca0012SstBenchmark } from './src/engine/cfd3d/benchmarks/Naca0012SstBenchmark';
import { Fvm3DNavierStokesSolver } from './src/engine/cfd3d/Fvm3DNavierStokesSolver';

async function inspectSst() {
  console.log("Inspecting SST equations...");
  const options = {
    nx: 20,
    ny: 10,
    aoa: 10,
    re: 1e5,
    mach: 0.15
  };
  
  // We can just run a mini test to print diagnostics
  const report = await Naca0012SstBenchmark.run(options);
  
  // Let's print out what we captured in sstDiagnosticCapture
  console.log("Captured diagnostics keys (iterations):", Object.keys(Fvm3DNavierStokesSolver.sstDiagnosticCapture));
  const iter10 = Fvm3DNavierStokesSolver.sstDiagnosticCapture[10];
  if (iter10) {
    console.log("Iteration 10 diagnostics:", JSON.stringify(iter10, null, 2));
  }
}

inspectSst();
