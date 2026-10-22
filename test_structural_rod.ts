import { StructuralAnalysisEngine } from './src/engine/structural-physics/StructuralAnalysisEngine';
import { FEAMesh, BoundaryCondition, LoadDefinition } from './src/engine/structural-physics/StructuralPhysicsTypes';

// Analytical rod test
async function runAnalyticalRodTest() {
  console.log('Running Structural Solver Analytical Rod Test...');

  const mesh: FEAMesh = {
    nodes: [
      { id: 1, x: 0, y: 0, z: 0, dofIndices: [0, 1, 2] },
      { id: 2, x: 1, y: 0, z: 0, dofIndices: [3, 4, 5] }
    ],
    elements: [
      { id: 1, type: 'BAR_1D', nodeIds: [1, 2], materialId: 'steel', crossSectionArea: 0.001 }
    ],
    qualityMetrics: { aspectRatioMin: 1, aspectRatioMax: 1, jacobianDeterminantMin: 1, isValid: true }
  };

  const bcs: BoundaryCondition[] = [
    { id: 'fix-1', nodeId: 1, type: 'FIXED', constrainedDOFs: [true, true, true] }
  ];

  const loads: LoadDefinition[] = [
    { id: 'load-2', nodeId: 2, forceVector: { x: 10000, y: 0, z: 0 } }
  ];

  const results = StructuralAnalysisEngine.runFEA('test-rod', mesh, bcs, loads);

  // Analytical delta = FL / AE = 10000 * 1.0 / (0.001 * 2.1e11) = 4.7619e-5 m
  const analyticalDisp = 4.7619e-5;
  const node2Result = results.nodes.find(n => n.nodeId === 2);
  const calculatedDisp = node2Result ? node2Result.displacement.x : 0;

  console.log('Analytical Displacement:', analyticalDisp);
  console.log('Calculated Displacement:', calculatedDisp);

  const error = Math.abs(calculatedDisp - analyticalDisp) / analyticalDisp;
  console.log('Error:', error);

  if (error < 0.01) {
    console.log('Qualification: PASS');
  } else {
    console.log('Qualification: FAIL');
  }
}

runAnalyticalRodTest();
