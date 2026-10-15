import { Naca0012SstBenchmark } from './src/engine/cfd3d/benchmarks/Naca0012SstBenchmark';
import { GaussSeidelSolver } from './src/engine/cfd3d/linear-solvers/GaussSeidelSolver';
import { SolverConfiguration } from './src/engine/cfd3d/linear-solvers/SolverConfiguration';

console.log('=== PRODUCTION SST SYSTEM FORENSIC INSPECTION ===');

// Run benchmark setup or solver step to capture kSystem and omegaSystem
try {
  const benchmark = new Naca0012SstBenchmark();
  const mesh = benchmark.generateMesh(10, 8); // small coarse mesh
  const solver = benchmark.createSolver(mesh);
  
  // We can execute one step or inspect how solver initializes and solves
  console.log('Benchmark mesh cells:', mesh.cells.length);
  console.log('Running benchmark simulation steps...');
  const result = benchmark.run();
  console.log('Benchmark run result status:', result.converged ? 'CONVERGED' : 'NOT_CONVERGED');
  
  // Also check if we can inspect captured diagnostics
  const diagCapture = (solver as any).constructor.sstDiagnosticCapture || (globalThis as any).sstDiagnosticCapture;
  console.log('Diagnostics captured:', diagCapture);

} catch (err: any) {
  console.log('Caught benchmark error/log:', err.message);
}
