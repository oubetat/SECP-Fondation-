
import { SketchUIIntegration } from './src/engine/cad-kernel/ui-integration/SketchUIIntegration';
import { DroneCAMAdapter } from './src/engine/cam/DroneCAMAdapter';
import { AssemblyPartExtractor } from './src/engine/assembly/AssemblyPartExtractor';
import { EngineeringHashChain } from './src/engine/evidence/EngineeringHashChain';

async function runCausalityAudit() {
  console.log('=== DRONE-CAM-CAUSALITY-PROOF-002: RUNTIME EXPERIMENT ===\n');

  // 1. BASE CASE INITIALIZATION
  const baseResult = SketchUIIntegration.createIndustrialDroneDocument('DOC_DRONE_001');
  const baseDoc = baseResult.document;
  
  console.log('--- TEST 1: BASE CHAIN IDENTIFICATION ---');
  const baseCam = await DroneCAMAdapter.processChassisCAM(baseDoc, 'DRONE-CHASSIS-001');
  
  const baseReport = {
    brepSolidId: baseDoc.evaluatedShape.solidId,
    topFaceId: baseCam.operations[0].topologyId,
    featureId: baseCam.features[0].featureId,
    operationId: baseCam.operations[0].operationId,
    toolId: baseCam.operations[0].toolAssembly.tool.id,
    brepHash: baseDoc.derived.mesh.brepHash,
    geomHash: baseCam.hashes.geometryHash,
    toolpathHash: baseCam.operations[0].provenance.toolpathHash
  };
  console.log(JSON.stringify(baseReport, null, 2));

  // 2. TEST 2: TARGET GEOMETRY MUTATION (TOP FACE)
  console.log('\n--- TEST 2: TARGET GEOMETRY MUTATION (TOP FACE) ---');
  // Mutate the chassis by scaling the Z-axis (height)
  const mutTargetCam = await DroneCAMAdapter.processChassisCAM(baseDoc, 'DRONE-CHASSIS-001', {
    geometryMutationMultiplier: 1.2
  });
  
  console.log('Base Geom Hash:', baseCam.hashes.geometryHash);
  console.log('Mutated Geom Hash:', mutTargetCam.hashes.geometryHash);
  console.log('Base Toolpath Hash:', baseCam.operations[0].provenance.toolpathHash);
  console.log('Mutated Toolpath Hash:', mutTargetCam.operations[0].provenance.toolpathHash);
  
  if (baseCam.hashes.geometryHash !== mutTargetCam.hashes.geometryHash && 
      baseCam.operations[0].provenance.toolpathHash !== mutTargetCam.operations[0].provenance.toolpathHash) {
    console.log('RESULT: PASS (Geometry Change Propagated to Toolpath)');
  } else {
    console.log('RESULT: FAIL (No Causality Detected)');
  }

  // 3. TEST 4: WCS MUTATION ONLY
  console.log('\n--- TEST 4: WCS MUTATION ONLY ---');
  const mutWcsCam = await DroneCAMAdapter.processChassisCAM(baseDoc, 'DRONE-CHASSIS-001', {
    wcsOffsetMm: 50.0
  });
  
  console.log('Base Geom Hash:', baseCam.hashes.geometryHash);
  console.log('WCS Mutated Geom Hash:', mutWcsCam.hashes.geometryHash);
  console.log('Base Toolpath Hash:', baseCam.operations[0].provenance.toolpathHash);
  console.log('WCS Mutated Toolpath Hash:', mutWcsCam.operations[0].provenance.toolpathHash);
  
  if (baseCam.hashes.geometryHash === mutWcsCam.hashes.geometryHash && 
      baseCam.operations[0].provenance.toolpathHash !== mutWcsCam.operations[0].provenance.toolpathHash) {
    console.log('RESULT: PASS (WCS Change Shifted Toolpath while Geometry Hash Remained Identical)');
  } else {
    console.log('RESULT: FAIL (WCS Interaction Violation)');
  }

  // 4. TEST 5: CUTTER DIAMETER MUTATION ONLY
  console.log('\n--- TEST 5: CUTTER DIAMETER MUTATION ONLY ---');
  const mutToolCam = await DroneCAMAdapter.processChassisCAM(baseDoc, 'DRONE-CHASSIS-001', {
    toolDiameterMm: 12.0 // Base is 10.0
  });
  
  console.log('Base Geom Hash:', baseCam.hashes.geometryHash);
  console.log('Tool Mutated Geom Hash:', mutToolCam.hashes.geometryHash);
  console.log('Base Toolpath Hash:', baseCam.operations[0].provenance.toolpathHash);
  console.log('Tool Mutated Toolpath Hash:', mutToolCam.operations[0].provenance.toolpathHash);

  if (baseCam.hashes.geometryHash === mutToolCam.hashes.geometryHash && 
      baseCam.operations[0].provenance.toolpathHash !== mutToolCam.operations[0].provenance.toolpathHash) {
    console.log('RESULT: PASS (Tool Change Updated Toolpath while Geometry Hash Remained Identical)');
  } else {
    console.log('RESULT: FAIL (Tool Interaction Violation)');
  }

  // 5. TEST 6: GEOMETRIC CONTAINMENT PROOF
  console.log('\n--- TEST 6: GEOMETRIC CONTAINMENT PROOF ---');
  const op0 = baseCam.operations[0];
  const points = op0.trajectory.points;
  const stock = baseCam.camSetup.stock.stockBoundingBox;
  
  let allPointsInStock = true;
  for (const pt of points) {
    const pos = pt.position || pt;
    if (pos.x < stock.min[0] || pos.x > stock.max[0] ||
        pos.y < stock.min[1] || pos.y > stock.max[1] ||
        pos.z < stock.min[2] || pos.z > stock.max[2]) {
      allPointsInStock = false;
      console.log(`Point Out of Bounds: (${pos.x}, ${pos.y}, ${pos.z})`);
    }
  }
  
  if (allPointsInStock && points.length > 0) {
    console.log(`RESULT: PASS (${points.length} points verified within Stock Bounding Box)`);
  } else {
    console.log('RESULT: FAIL (Toolpath Violation Detected)');
  }

  console.log('\n=== AUDIT COMPLETE ===');
}

runCausalityAudit().catch(err => {
  console.error('AUDIT FATAL ERROR:', err);
  process.exit(1);
});
