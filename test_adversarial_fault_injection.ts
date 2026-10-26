import { ElementFormulationEngine } from './src/engine/structural-physics/ElementFormulationEngine';
import { TwoWayFSICouplingEngine } from './src/engine/cfd3d/coupling/TwoWayFSICouplingEngine';
import { DynamicMeshManager } from './src/engine/cfd3d/solvers/fsi/DynamicMeshManager';
import { Fvm3DMeshGenerator } from './src/engine/cfd3d/Fvm3DMeshGenerator';
import { GaussQuadratureEngine } from './src/engine/structural-physics/GaussQuadratureEngine';
import { ConstitutiveMatrixEngine } from './src/engine/structural-physics/ConstitutiveMatrixEngine';
import { ShapeFunctionIsoparametricEngine } from './src/engine/structural-physics/ShapeFunctionIsoparametricEngine';

function runFaultInjectionSuite() {
  console.log('=== ADVERSARIAL FAULT INJECTION & SENSITIVITY BATTERY ===');

  const L = 1.0, b = 0.1, h = 0.1, E = 70e9;
  const fluidMesh = Fvm3DMeshGenerator.generateBoxMesh(L, b, h, 5, 5, 2);
  const pressures = new Array(fluidMesh.cells.length).fill(101325.0);

  // Fault 1: Test sensitivity to full 2x2 Gauss integration (Shear Locking Injection)
  function computeLockedK(elem: any, nodes: any) {
    const quadNodes = elem.nodeIds.map((nid: number) => nodes.find((n: any) => n.id === nid));
    const mat = { youngsModulus: E, poissonsRatio: 0.3, yieldStrength: 500e6, density: 7850 };
    const D = ConstitutiveMatrixEngine.getPlaneStressMatrix(mat as any);
    const gauss2x2 = GaussQuadratureEngine.getQuadPoints(2);
    const K = Array.from({ length: 8 }, () => Array(8).fill(0));

    for (const pt of gauss2x2) {
      const { detJ, B } = ShapeFunctionIsoparametricEngine.evaluateQuad4(pt.xi, pt.eta, quadNodes);
      const factor = detJ * pt.weight * b;
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          let s = 0;
          for (let r = 0; r < 3; r++) {
            for (let k = 0; k < 3; k++) {
              s += B[r][i] * D[r][k] * B[k][j];
            }
          }
          K[i][j] += s * factor;
        }
      }
    }
    return K;
  }

  // Temporarily override formulateElementStiffness to inject shear locking
  const originalFormulate = ElementFormulationEngine.formulateElementStiffness;
  ElementFormulationEngine.formulateElementStiffness = function(elem: any, nodes: any) {
    if (elem.type === 'QUAD_2D') {
      return computeLockedK(elem, nodes);
    }
    return originalFormulate.call(ElementFormulationEngine, elem, nodes);
  };

  const resLocked = TwoWayFSICouplingEngine.solveTwoWayFSI(fluidMesh, pressures, E, 1e-4, 15, 10);
  const lockedError = (Math.abs(resLocked.maxDisplacementM - 0.00217125) / 0.00217125) * 100;

  console.log(`1. Shear Locking Fault Injection:`);
  console.log(`   Displacement with 2x2 Full Integration: ${(resLocked.maxDisplacementM * 1000).toFixed(4)} mm`);
  console.log(`   Error vs Analytical: ${lockedError.toFixed(2)}%`);
  console.log(`   Test Suite Sensitivity: ${lockedError > 30 ? 'PASSED (Detected Shear Locking, Error > 30%)' : 'FAILED'}`);

  // Restore SRI
  ElementFormulationEngine.formulateElementStiffness = originalFormulate;

  // Fault 2: Inverted Mesh Injection (faceId 12 is bottom WALL face, normal (0, -1, 0). dy = +0.1 pushes into cell causing negative volume)
  const testMesh = Fvm3DMeshGenerator.generateBoxMesh(L, b, h, 2, 2, 2);
  const invertedDisp = [{ faceId: 12, dx: 0, dy: 0.1, dz: 0 }]; 
  const morphRes = DynamicMeshManager.deformMesh(testMesh, invertedDisp as any);

  console.log(`\n2. Inverted Mesh Fault Injection:`);
  console.log(`   Morphing Result Success: ${morphRes.success}`);
  console.log(`   Error Reported: ${morphRes.error}`);
  console.log(`   Test Suite Sensitivity: ${!morphRes.success ? 'PASSED (Inversion Safely Blocked)' : 'FAILED'}`);

  // Fault 3: NaN Input Injection
  const nanDisp = [{ faceId: 0, dx: NaN, dy: 0, dz: 0 }];
  const nanMorphRes = DynamicMeshManager.deformMesh(testMesh, nanDisp as any);

  console.log(`\n3. Non-Finite (NaN) Fault Injection:`);
  console.log(`   Morphing Result Success: ${nanMorphRes.success}`);
  console.log(`   Error Reported: ${nanMorphRes.error}`);
  console.log(`   Test Suite Sensitivity: ${!nanMorphRes.success ? 'PASSED (NaN Input Safely Blocked)' : 'FAILED'}`);
}

runFaultInjectionSuite();
