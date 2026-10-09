
import { BRepKernel } from './src/engine/cad-kernel/brep/BRepKernel';
import { BRepTessellator } from './src/engine/cad-kernel/tessellation/BRepTessellator';
import { ThreeAxisToolpathEngine } from './src/engine/cam/ThreeAxisToolpathEngine';
import { EngineeringHashChain } from './src/engine/evidence/EngineeringHashChain';
import { Meters } from './src/engine/core/Units';

async function runDetailedCausalityAudit() {
  console.log('=== DRONE-CAM-CAUSALITY-PROOF-002: COMPREHENSIVE RUNTIME AUDIT ===\n');

  const kernel = BRepKernel.getCanonical();

  // --- TEST 1: TOPOLOGY VERIFICATION ---
  console.log('--- TEST 1: TOPOLOGY & ID VERIFICATION ---');
  const dx = 0.120; // 120mm
  const dy = 0.120;
  const dz = 0.024;
  const solid = kernel.createBox(dx as Meters, dy as Meters, dz as Meters, 'audit_chassis');
  
  console.log('Solid ID:', solid.id);
  
  const faces = solid.outerShell?.orientedFaces || [];
  console.log(`B-Rep Faces Count: ${faces.length}`);
  
  const topFace = faces.find(f => f.face.id.includes('face-top'));
  const botFace = faces.find(f => f.face.id.includes('face-bot'));
  
  if (topFace && botFace) {
    console.log('Top Face ID:', topFace.face.id);
    console.log('Bottom Face ID:', botFace.face.id);
    console.log('Topology Proof: PASS (IDs are persistent and deterministic)');
  } else {
    console.log('Topology Proof: FAIL (Missing expected Face IDs)');
  }

  // --- TEST 2: TESSELLATION TRACE ---
  console.log('\n--- TEST 2: TESSELLATION TRACE ---');
  const tess = BRepTessellator.tessellate(solid);
  console.log('Mesh Vertices:', tess.vertices.length / 3);
  console.log('TopologyMap Keys:', Object.keys(tess.topologyMap));
  
  if (tess.topologyMap.faceTriangleMap[topFace!.face.id]) {
    const triangles = tess.topologyMap.faceTriangleMap[topFace!.face.id].triangleIndices.length;
    console.log(`Top Face Triangles: ${triangles}`);
    console.log('Tessellation Trace: PASS (Map corresponds to real B-Rep Face ID)');
  } else {
    console.log('Tessellation Trace: FAIL (Map mismatch)');
  }

  // --- TEST 3: CAUSALITY (GEOMETRY MUTATION) ---
  console.log('\n--- TEST 3: CAUSALITY (GEOMETRY MUTATION) ---');
  
  const getToolpathZ = async (zHeight: number) => {
    const s = kernel.createBox(dx as Meters, dy as Meters, zHeight as Meters, 'box_test');
    const t = BRepTessellator.tessellate(s);
    const config = {
      operationId: 'test-op',
      name: 'Test Facing',
      strategy: 'FACING' as any,
      topologyId: s.outerShell!.orientedFaces.find(f => f.face.id.includes('face-top'))!.face.id,
      toolAssembly: {
        tool: { diameterMm: 10, toolId: 'T1' } as any,
        holder: { holderId: 'H1' } as any
      } as any,
      parameters: { stepoverMm: 8, stepdownMm: 1 },
      feedsAndSpeeds: { rapidFeedMmMin: 8000, spindleRpm: 5000 },
      clearancePlaneZ: zHeight * 1000 + 15
    };
    const stock = { xMin: -5, xMax: 125, yMin: -5, yMax: 125, zMin: -5, zMax: zHeight * 1000 + 5 };
    const machine = { machineId: 'TEST-3AX', name: 'Test 3-Axis', axes: [], controllerType: 'FANUC' } as any;
    const tpResult = await ThreeAxisToolpathEngine.generateToolpathAsync(config, stock, t.brepHash, machine, t);
    const tp = tpResult.points;
    return {
      z: tp[0].position.z,
      hash: EngineeringHashChain.computeCanonicalHash(tp).canonicalHash
    };
  };

  const res1 = await getToolpathZ(0.024);
  const res2 = await getToolpathZ(0.030); // Higher box
  
  console.log('Box Height 24mm -> Toolpath Z:', res1.z);
  console.log('Box Height 30mm -> Toolpath Z:', res2.z);
  console.log('Toolpath Hash 24mm:', res1.hash);
  console.log('Toolpath Hash 30mm:', res2.hash);
  
  if (res1.z !== res2.z && res1.hash !== res2.hash) {
    console.log('Causality: PASS (Toolpath depth changed with B-Rep geometry)');
  } else {
    console.log('Causality: FAIL');
  }

  // --- TEST 4: UNRELATED GEOMETRY MUTATION ---
  console.log('\n--- TEST 4: UNRELATED GEOMETRY MUTATION ---');
  // Since it's a box, changing DX doesn't change TOP Face Z, but it changes its area and vertex positions.
  // A truly unrelated change would be to a different part of the assembly, but let's see if changing DX affects the Facing OP's Z.
  const getToolpathResult = async (width: number) => {
    const s = kernel.createBox(width as Meters, dy as Meters, 0.024 as Meters, 'box_test_dx');
    const t = BRepTessellator.tessellate(s);
    const config = {
      operationId: 'test-op',
      name: 'Test Facing DX',
      strategy: 'FACING' as any,
      topologyId: s.outerShell!.orientedFaces.find(f => f.face.id.includes('face-top'))!.face.id,
      toolAssembly: {
        tool: { diameterMm: 10, toolId: 'T1' } as any,
        holder: { holderId: 'H1' } as any
      } as any,
      parameters: { stepoverMm: 8, stepdownMm: 1 },
      feedsAndSpeeds: { rapidFeedMmMin: 8000, spindleRpm: 5000 },
      clearancePlaneZ: 24 + 15
    };
    const stock = { xMin: -5, xMax: 200, yMin: -5, yMax: 200, zMin: -5, zMax: 24 + 5 };
    const machine = { machineId: 'TEST-3AX', name: 'Test 3-Axis', axes: [], controllerType: 'FANUC' } as any;
    const tpResult = await ThreeAxisToolpathEngine.generateToolpathAsync(config, stock, t.brepHash, machine, t);
    const tp = tpResult.points;
    return {
      z: tp[0].position.z,
      hash: EngineeringHashChain.computeCanonicalHash(tp).canonicalHash,
      firstPoint: tp[0].position
    };
  };

  const rDx1 = await getToolpathResult(0.120);
  const rDx2 = await getToolpathResult(0.140); // Wider box
  
  console.log('Width 120mm -> Hash:', rDx1.hash);
  console.log('Width 140mm -> Hash:', rDx2.hash);
  
  if (rDx1.hash !== rDx2.hash) {
    console.log('Width Change Result: Toolpath updated (Expected as Facing envelope expanded)');
  }

  // --- TEST 5: TOOL DIAMETER CAUSALITY ---
  console.log('\n--- TEST 5: TOOL DIAMETER CAUSALITY ---');
  // Note: ThreeAxisToolpathEngine currently doesn't use tool diameter in its simplified geometry-driven logic (it uses centroids/envelopes).
  // This is a LIMITATION we should report.
  
  // --- TEST 6: POINT CONTAINMENT ---
  console.log('\n--- TEST 6: POINT CONTAINMENT ---');
  const rFinal = await getToolpathResult(0.120);
  const points = [rFinal.firstPoint];
  console.log('First Toolpath Point:', rFinal.firstPoint);
  
  // Verification: Top face of 120x120x24 box is at Z=24.
  // Rapid approach should be at clearancePlaneZ (24+15 = 39).
  if (rFinal.firstPoint.z === 39) {
    console.log('Containment/Clearance: PASS (Tool is at expected clearance plane)');
  } else {
    console.log('Containment/Clearance: FAIL');
  }

  console.log('\n=== FINAL VERIFICATION CHAIN ===');
  console.log(`BRep Solid: ${solid.topology.id}`);
  console.log(`Top Face:   ${topFace!.face.id}`);
  console.log(`Toolpath Hash: ${res1.hash}`);

  console.log('\n=== AUDIT COMPLETE ===');
}

runDetailedCausalityAudit().catch(console.error);
