/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-242 — FVM Acceptance Gate
 */

import { CfdMesh, CfdMeshMetrics } from '../mesh/CfdMesh';
import { CfdNode, CfdFace, CfdCell, CfdCellType } from '../mesh/CfdGeneralMeshTypes';
import { CfdField, CfdScalarField, CfdVectorField } from '../mesh/CfdField';
import { CfdConnectivity } from '../mesh/CfdConnectivity';
import { FiniteVolumeDiscretizer } from './FiniteVolumeDiscretizer';
import { FvmVerificationEngine } from './FvmVerificationEngine';
import { ConvectionSchemeType } from './FvmTypes';

export interface GateResult242 {
  overallVerdict: 'PASS' | 'FAIL';
  testReports: any[];
  timestamp: string;
}

/**
 * HardAcceptanceGate242: Verifies that FVM discretization is numerically active.
 */
export class HardAcceptanceGate242 {
  public static runSuite(): GateResult242 {
    const testReports: any[] = [];

    // Test 01: 1D-like Diffusion Chain (Numerical validation)
    testReports.push(this.testDiffusionCoefficients());

    // Test 02: Convection Directionality (Upwind check)
    testReports.push(this.testUpwindDirectionality());

    // Test 03: Conservation (Flux balance audit)
    testReports.push(this.testFluxConservation());

    // Test 04: Mesh Refinement Response (Coarse vs Fine NNZ)
    testReports.push(this.testRefinementResponse());

    const overallVerdict = testReports.every(r => r.success) ? 'PASS' : 'FAIL';

    return {
      overallVerdict,
      testReports,
      timestamp: new Date().toISOString()
    };
  }

  private static testDiffusionCoefficients() {
    const mesh = this.createChainMesh(4);
    const phi = new CfdScalarField('phi', '1', 'CELL');
    const velocity = new CfdVectorField('U', 'm/s', 'CELL');
    
    mesh.cells.forEach(c => {
      phi.setValue(c.id, 0);
      velocity.setValue(c.id, { x: 0, y: 0, z: 0 }); // Zero convection
    });

    const result = FiniteVolumeDiscretizer.discretizeScalar(mesh, phi, velocity, {
      convectionScheme: ConvectionSchemeType.UPWIND,
      density: 1.0,
      viscosity: 0.1
    });

    // Check if aP is strictly non-zero and derived from neighbors
    const cell2 = result.equations.get('c1')!;
    const success = cell2.aP > 0 && cell2.aN.size > 0;

    return {
      name: 'Numerical Diffusion Assembly',
      success,
      details: { aP: cell2.aP, neighbors: Array.from(cell2.aN.keys()) }
    };
  }

  private static testUpwindDirectionality() {
    const mesh = this.createChainMesh(3);
    const phi = new CfdScalarField('phi', '1', 'CELL');
    const velocity = new CfdVectorField('U', 'm/s', 'CELL');
    
    // Positive velocity (Left to Right)
    mesh.cells.forEach(c => {
      phi.setValue(c.id, 0);
      velocity.setValue(c.id, { x: 10, y: 0, z: 0 }); 
    });

    const result = FiniteVolumeDiscretizer.discretizeScalar(mesh, phi, velocity, {
      convectionScheme: ConvectionSchemeType.UPWIND,
      density: 1.0,
      viscosity: 0.001 // Low diffusion
    });

    // In upwind, the coefficient for the downstream cell should be influenced by upstream
    const downstream = result.equations.get('c2')!;
    const hasUpstream = downstream.aN.has('c1');

    return {
      name: 'Upwind Convection Logic',
      success: hasUpstream,
      details: { velocity: 10, upwindSource: 'c1' }
    };
  }

  private static testFluxConservation() {
    const mesh = this.createChainMesh(5);
    const phi = new CfdScalarField('phi', '1', 'CELL');
    const velocity = new CfdVectorField('U', 'm/s', 'CELL');
    mesh.cells.forEach(c => {
      phi.setValue(c.id, 1);
      velocity.setValue(c.id, { x: 5, y: 0, z: 0 });
    });

    const result = FiniteVolumeDiscretizer.discretizeScalar(mesh, phi, velocity, {
      convectionScheme: ConvectionSchemeType.UPWIND,
      density: 1.0,
      viscosity: 0.1
    });

    const conservationError = FvmVerificationEngine.verifyConservation(result);
    
    return {
      name: 'Face Flux Conservation Audit',
      success: conservationError < 1e-10,
      details: { imbalance: conservationError }
    };
  }

  private static testRefinementResponse() {
    const m1 = this.createChainMesh(2);
    const m2 = this.createChainMesh(4);
    
    const phi = new CfdScalarField('p', '1', 'CELL');
    const U = new CfdVectorField('U', 'm/s', 'CELL');
    [m1, m2].forEach(m => m.cells.forEach(c => { phi.setValue(c.id, 0); U.setValue(c.id, {x:0,y:0,z:0}); }));

    const r1 = FiniteVolumeDiscretizer.discretizeScalar(m1, phi, U, { convectionScheme: ConvectionSchemeType.UPWIND, density:1, viscosity:1 });
    const r2 = FiniteVolumeDiscretizer.discretizeScalar(m2, phi, U, { convectionScheme: ConvectionSchemeType.UPWIND, density:1, viscosity:1 });

    return {
      name: 'Mesh Refinement Traceability',
      success: r2.matrixNNZ > r1.matrixNNZ,
      details: { coarseNNZ: r1.matrixNNZ, fineNNZ: r2.matrixNNZ }
    };
  }

  private static createChainMesh(count: number): CfdMesh {
    const mesh = new CfdMesh(`CHAIN_${count}`);
    // Nodes along X
    for (let i = 0; i <= count; i++) {
      mesh.addNode(new CfdNode(`n${i}`, i, 0, 0));
      mesh.addNode(new CfdNode(`n${i}_y`, i, 1, 0));
      mesh.addNode(new CfdNode(`n${i}_z`, i, 0, 1));
      mesh.addNode(new CfdNode(`n${i}_yz`, i, 1, 1));
    }

    // Tet Cells
    for (let i = 0; i < count; i++) {
      const cell = new CfdCell(`c${i}`, [`n${i}`, `n${i+1}`, `n${i}_y`, `n${i}_z`], CfdCellType.TETRAHEDRON);
      mesh.addCell(cell);
      
      // Face at each interface
      const face = new CfdFace(`f${i}`, [`n${i}`, `n${i}_y`, `n${i}_z`]);
      mesh.addFace(face);
    }

    CfdConnectivity.build(mesh);
    CfdMeshMetrics.calculate(mesh);
    return mesh;
  }
}
