/**
 * SECP Industrial OS — Engineering Truth OS
 * run_fsi_independent_acceptance_gate.ts
 *
 * SECP-ENGINE-QUALIFICATION-002-FSI-INDEPENDENT-ACCEPTANCE-GATE
 * Executes rigorous independent qualification of PATCH-254 FSI integration.
 */

import * as fs from 'fs';
import * as path from 'path';

import { TwoWayFSICouplingEngine } from './src/engine/cfd3d/coupling/TwoWayFSICouplingEngine';
import { Fvm3DMeshGenerator } from './src/engine/cfd3d/Fvm3DMeshGenerator';
import { FSIConservationAudit } from './src/engine/cfd3d/solvers/fsi/FSIConservationAudit';

async function runFSIIndependentGate() {
  console.log('========================================================================');
  console.log('SECP-ENGINE-QUALIFICATION-002-FSI-INDEPENDENT-ACCEPTANCE-GATE');
  console.log('========================================================================');

  const baseDir = path.resolve('qualification-002/fsi');
  
  // Phase 2: Material Sensitivity
  console.log('\n[Phase 2] Material Sensitivity Analysis...');
  const baseMesh = Fvm3DMeshGenerator.generateBoxMesh(1.0, 1.0, 0.5, 10, 10, 5);
  const pressures = new Array(baseMesh.cells.length).fill(101325);
  
  const stiffnessValues = [1.0e10, 2.1e11, 5.0e11];
  const sensitivityResults = stiffnessValues.map(E => {
    const res = TwoWayFSICouplingEngine.solveTwoWayFSI(baseMesh, pressures, E, 1e-4, 15);
    return { E, maxDisp: Math.max(...res.structuralDisplacements.map(d => Math.abs(d.dy))), converged: res.isConverged };
  });

  // Phase 4: Convergence & Failure Detection
  console.log('[Phase 4] Convergence & Failure Detection...');
  const divergedCase = TwoWayFSICouplingEngine.solveTwoWayFSI(baseMesh, pressures, 1e2, 1e-12, 2); // Force exhaustion
  const failureCase = { converged: divergedCase.isConverged, iterations: divergedCase.fsiIterCompleted };

  // Phase 5: Conservation Audit
  console.log('[Phase 5] Conservation Audit...');
  const stiffness = 2.1e11 * 1e-7;
  const auditRes = TwoWayFSICouplingEngine.solveTwoWayFSI(baseMesh, pressures, 2.1e11, 1e-4, 5);
  const conservation = FSIConservationAudit.auditCoupling(auditRes.fluidBoundaryForces, auditRes.structuralDisplacements, stiffness);

  // Write Evidence
  fs.writeFileSync(path.join(baseDir, 'fsi-sensitivity-evidence.json'), JSON.stringify(sensitivityResults, null, 2));
  fs.writeFileSync(path.join(baseDir, 'fsi-convergence-evidence.json'), JSON.stringify(failureCase, null, 2));
  fs.writeFileSync(path.join(baseDir, 'fsi-conservation-evidence.json'), JSON.stringify(conservation, null, 2));

  // Closure Verdict
  const verdict = {
    testId: 'FSI-GATE-001',
    verdict: (sensitivityResults.every(r => r.converged) && !failureCase.converged && conservation.status === 'VERIFIED') 
             ? 'QUALIFIED_WITHIN_DECLARED_SCOPE' 
             : 'STOP / INSUFFICIENT_EVIDENCE',
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(path.join(baseDir, 'fsi-closure-verdict.json'), JSON.stringify(verdict, null, 2));

  console.log('\nIndependent Acceptance Gate completed.');
  console.log('Verdict:', verdict.verdict);
}

runFSIIndependentGate().catch(console.error);
