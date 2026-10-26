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
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
  
  // Phase 2: Material Sensitivity
  console.log('\n[Phase 2] Material Sensitivity Analysis...');
  const baseMesh = Fvm3DMeshGenerator.generateBoxMesh(1.0, 1.0, 0.5, 6, 6, 3);
  const pressures = new Array(baseMesh.cells.length).fill(101325.0);
  
  const stiffnessValues = [1.0e10, 2.1e11, 5.0e11];
  const sensitivityResults = stiffnessValues.map(E => {
    const res = TwoWayFSICouplingEngine.solveTwoWayFSI(baseMesh, pressures, E, 1e-4, 15);
    return {
      E,
      maxDisp: Math.max(...res.structuralDisplacements.map(d => Math.abs(d.dy))),
      converged: res.isConverged,
      iterations: res.fsiIterCompleted
    };
  });

  const sensitivityPass = sensitivityResults.every(r => r.converged) &&
    sensitivityResults[0].maxDisp > sensitivityResults[1].maxDisp &&
    sensitivityResults[1].maxDisp > sensitivityResults[2].maxDisp;

  // Phase 4: Convergence & Failure Detection
  console.log('[Phase 4] Convergence & Failure Detection...');
  const divergedCase = TwoWayFSICouplingEngine.solveTwoWayFSI(baseMesh, pressures, 100, 1e-12, 2); // Force exhaustion
  const failureCase = { converged: divergedCase.isConverged, iterations: divergedCase.fsiIterCompleted, stopReason: divergedCase.stopReason };

  // Phase 5: Conservation Audit (Real Physics without synthetic stiffness)
  console.log('[Phase 5] Conservation Audit...');
  const auditRes = TwoWayFSICouplingEngine.solveTwoWayFSI(baseMesh, pressures, 2.1e11, 1e-4, 10);
  const conservation = FSIConservationAudit.auditCoupling(
    auditRes.fluidBoundaryForces,
    auditRes.structuralDisplacements,
    {
      totalAppliedLoad: auditRes.totalAppliedLoad,
      totalReaction: auditRes.totalReaction,
      residualDisplacement: auditRes.residualDisplacementM,
      tolerance: 1e-4
    }
  );

  console.log('  Conservation status:', conservation.status);
  console.log('  Force transfer error:', conservation.forceTransferBalance.transferErrorPct.toFixed(4) + '%');
  console.log('  Equilibrium error:', conservation.structuralEquilibrium.equilibriumErrorPct.toFixed(6) + '%');

  // Write Evidence
  fs.writeFileSync(path.join(baseDir, 'fsi-sensitivity-evidence.json'), JSON.stringify(sensitivityResults, null, 2));
  fs.writeFileSync(path.join(baseDir, 'fsi-convergence-evidence.json'), JSON.stringify(failureCase, null, 2));
  fs.writeFileSync(path.join(baseDir, 'fsi-conservation-evidence.json'), JSON.stringify(conservation, null, 2));

  // Closure Verdict
  const allCriteriaPassed = sensitivityPass && !failureCase.converged && conservation.status === 'VERIFIED';
  const verdict = {
    testId: 'FSI-GATE-001',
    verdict: allCriteriaPassed
             ? 'QUALIFIED_WITHIN_DECLARED_SCOPE' 
             : 'STOP / INSUFFICIENT_EVIDENCE',
    criteria: {
      sensitivityPass,
      failureDetectionPass: !failureCase.converged,
      conservationPass: conservation.status === 'VERIFIED'
    },
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(path.join(baseDir, 'fsi-closure-verdict.json'), JSON.stringify(verdict, null, 2));

  console.log('\nIndependent Acceptance Gate completed.');
  console.log('Verdict:', verdict.verdict);
}

runFSIIndependentGate().catch(console.error);
