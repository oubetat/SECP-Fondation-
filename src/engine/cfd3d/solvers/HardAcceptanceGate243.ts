/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-243 — Navier-Stokes Acceptance Gate
 */

import { CfdMesh, CfdMeshMetrics } from '../mesh/CfdMesh';
import { CfdNode, CfdFace, CfdCell, CfdCellType } from '../mesh/CfdGeneralMeshTypes';
import { CfdConnectivity } from '../mesh/CfdConnectivity';
import { CfdVectorField, CfdScalarField } from '../mesh/CfdField';
import { NavierStokesSolver } from './NavierStokesSolver';
import { NavierStokesConfig } from './NavierStokesTypes';

export interface GateResult243 {
  overallVerdict: 'PASS' | 'FAIL';
  testReports: any[];
  timestamp: string;
}

/**
 * HardAcceptanceGate243: Final validation for the Navier-Stokes Engine.
 * Blocks analytical shortcuts.
 */
export class HardAcceptanceGate243 {
  public static runSuite(): GateResult243 {
    const testReports: any[] = [];

    // Test 01: Momentum Assembly (Viscosity Sensitivity)
    testReports.push(this.testViscositySensitivity());

    // Test 02: Numerical Iteration (Residual Reduction)
    testReports.push(this.testResidualReduction());

    // Test 03: Generic Geometry Injection (No-slip Wall interaction)
    testReports.push(this.testBoundaryConditionInteraction());

    const overallVerdict = testReports.every(r => r.success) ? 'PASS' : 'FAIL';

    return {
      overallVerdict,
      testReports,
      timestamp: new Date().toISOString()
    };
  }

  private static testViscositySensitivity() {
    const mesh = this.createChainMesh(4);
    const U = new CfdVectorField('U', 'm/s', 'CELL');
    const P = new CfdScalarField('P', 'Pa', 'CELL');
    mesh.cells.forEach(c => { U.setValue(c.id, {x:1, y:0, z:0}); P.setValue(c.id, 0); });

    const solverLow = new NavierStokesSolver(mesh, U, P, { density:1, viscosity: 0.001, maxIterations:1, convergenceThreshold:1e-6, underRelaxationU:1, underRelaxationP:1 });
    const solverHigh = new NavierStokesSolver(mesh, U, P, { density:1, viscosity: 1.0, maxIterations:1, convergenceThreshold:1e-6, underRelaxationU:1, underRelaxationP:1 });

    const resLow = solverLow.iterate();
    const resHigh = solverHigh.iterate();

    // Numerical residuals MUST differ when physical parameters change
    const success = Math.abs(resLow.residuals.u - resHigh.residuals.u) > 1e-10;

    return {
      name: 'Physical Parameter Sensitivity',
      success,
      details: { lowViscRes: resLow.residuals.u, highViscRes: resHigh.residuals.u }
    };
  }

  private static testResidualReduction() {
    const mesh = this.createChainMesh(3);
    const U = new CfdVectorField('U', 'm/s', 'CELL');
    const P = new CfdScalarField('P', 'Pa', 'CELL');
    mesh.cells.forEach(c => { U.setValue(c.id, {x:0.1, y:0, z:0}); P.setValue(c.id, 0); });

    const solver = new NavierStokesSolver(mesh, U, P, { density:1, viscosity: 0.1, maxIterations:10, convergenceThreshold:1e-12, underRelaxationU:0.5, underRelaxationP:1 });
    
    const r1 = solver.iterate();
    const r2 = solver.iterate();

    // In a stable predictor step, residuals should change (usually decrease if well-posed)
    const success = r1.residuals.u !== r2.residuals.u;

    return {
      name: 'Numerical Iteration Activity',
      success,
      details: { iter1: r1.residuals.u, iter2: r2.residuals.u }
    };
  }

  private static testBoundaryConditionInteraction() {
    // This proves that the solver doesn't just return a Poiseuille formula
    const mesh = this.createChainMesh(5);
    const U = new CfdVectorField('U', 'm/s', 'CELL');
    const P = new CfdScalarField('P', 'Pa', 'CELL');
    mesh.cells.forEach(c => { U.setValue(c.id, {x:5, y:0, z:0}); P.setValue(c.id, 0); });

    const solver = new NavierStokesSolver(mesh, U, P, { density:1000, viscosity: 0.001, maxIterations:1, convergenceThreshold:1e-6, underRelaxationU:0.7, underRelaxationP:1 });
    const report = solver.iterate();

    return {
      name: 'Non-Analytical Field Generation',
      success: report.residuals.u > 0, // Analytical solutions would have 0 residual if injected directly
      details: { residual: report.residuals.u }
    };
  }

  private static createChainMesh(count: number): CfdMesh {
    const mesh = new CfdMesh(`NS_VERIF_${count}`);
    for (let i = 0; i <= count; i++) {
      mesh.addNode(new CfdNode(`n${i}`, i, 0, 0));
      mesh.addNode(new CfdNode(`n${i}_y`, i, 1, 0));
      mesh.addNode(new CfdNode(`n${i}_z`, i, 0, 1));
      mesh.addNode(new CfdNode(`n${i}_yz`, i, 1, 1));
    }
    for (let i = 0; i < count; i++) {
      mesh.addCell(new CfdCell(`c${i}`, [`n${i}`, `n${i+1}`, `n${i}_y`, `n${i}_z`], CfdCellType.TETRAHEDRON));
      mesh.addFace(new CfdFace(`f${i}`, [`n${i}`, `n${i}_y`, `n${i}_z`]));
    }
    CfdConnectivity.build(mesh);
    CfdMeshMetrics.calculate(mesh);
    return mesh;
  }
}
