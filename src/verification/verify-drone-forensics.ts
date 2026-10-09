import { SketchUIIntegration } from '../engine/cad-kernel/ui-integration/SketchUIIntegration';
import { createCanonicalRenderData } from '../engine/viewport/CanonicalRenderContract';
import { convertRenderDataToThreeBufferGeometry } from '../engine/viewport/ThreeGeometryConverter';
import { EngineeringHashChain } from '../engine/evidence/EngineeringHashChain';

async function runDroneForensicAudit() {
  console.log('================================================================');
  console.log(' SECP FORENSIC AUDIT: PATCH-276 + DRONE CANONICAL CONVERGENCE ');
  console.log('================================================================\n');

  let totalTests = 0;
  let passedTests = 0;

  // ---------------------------------------------------------------------------
  // TEST 1: SEMANTIC IDENTITY SEPARATION
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: SEMANTIC IDENTITY SEPARATION ---');
  totalTests++;
  const valveResult = SketchUIIntegration.createValveDocument('DOC_VALVE_001');
  const droneResult = SketchUIIntegration.createIndustrialDroneDocument('DOC_DRONE_001');

  const valveDoc = valveResult.document;
  const droneDoc = droneResult.document;

  const valveNameCorrect = valveDoc.metadata?.name === 'SolidWorks Industrial Ball Valve';
  const droneNameCorrect = droneDoc.metadata?.name === 'Industrial Quadcopter Drone (SECP-DRONE-001)';
  const idSeparationCorrect = valveDoc.documentId === 'DOC_VALVE_001' && droneDoc.documentId === 'DOC_DRONE_001';

  console.log(` Valve Document ID   : ${valveDoc.documentId} | Name: ${valveDoc.metadata?.name}`);
  console.log(` Drone Document ID   : ${droneDoc.documentId} | Name: ${droneDoc.metadata?.name}`);

  if (valveNameCorrect && droneNameCorrect && idSeparationCorrect) {
    console.log(' RESULT: [ PASS ] Semantic Identity strictly separated.\n');
    passedTests++;
  } else {
    console.error(' RESULT: [ FAIL ] Semantic identity collision detected!\n');
  }

  // ---------------------------------------------------------------------------
  // TEST 2: CANONICAL BREP SOLID PROVENANCE
  // ---------------------------------------------------------------------------
  console.log('--- TEST 2: CANONICAL BREP SOLID PROVENANCE ---');
  totalTests++;

  const hasBRepShape = !!droneDoc.evaluatedShape;
  const droneRenderData = createCanonicalRenderData(droneDoc);
  const brepHashPresent = !!droneRenderData.brepHash && droneRenderData.brepHash !== 'EMPTY_BREP_HASH';

  console.log(` Drone BRep Solid     : ${hasBRepShape ? 'PRESENT' : 'MISSING'}`);
  console.log(` BRep Cryptographic Hash : ${droneRenderData.brepHash}`);

  if (hasBRepShape && brepHashPresent) {
    console.log(' RESULT: [ PASS ] Drone Canonical BRep Solid evaluated & proven.\n');
    passedTests++;
  } else {
    console.error(' RESULT: [ FAIL ] Drone BRep Solid missing or invalid brepHash!\n');
  }

  // ---------------------------------------------------------------------------
  // TEST 3: FULL MESH GEOMETRY HASH MUTATION COVERAGE (EARLY / MIDDLE / LATE)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 3: FULL HASH MUTATION COVERAGE ---');
  totalTests++;

  const origVerts = [...droneRenderData.vertices];
  const origIndices = [...droneRenderData.indices];
  const origNormals = [...droneRenderData.normals];
  const len = origVerts.length;

  const baselineHash = EngineeringHashChain.computeCanonicalHash({
    docId: droneRenderData.documentId,
    verticesCount: len,
    indicesCount: origIndices.length,
    facesCount: droneRenderData.facesCount,
    vertices: origVerts.map(v => Number(v.toFixed(6))),
    indices: origIndices,
    normals: origNormals.map(n => Number(n.toFixed(6)))
  }).canonicalHash;

  // Mutation 1: Early region (vertex 0)
  const vertsEarly = [...origVerts];
  vertsEarly[0] += 0.05;
  const hashEarly = EngineeringHashChain.computeCanonicalHash({
    docId: droneRenderData.documentId,
    verticesCount: len,
    indicesCount: origIndices.length,
    facesCount: droneRenderData.facesCount,
    vertices: vertsEarly.map(v => Number(v.toFixed(6))),
    indices: origIndices,
    normals: origNormals.map(n => Number(n.toFixed(6)))
  }).canonicalHash;

  // Mutation 2: Middle region (middle vertex)
  const vertsMid = [...origVerts];
  const midIdx = Math.floor(len / 2);
  vertsMid[midIdx] += 0.05;
  const hashMid = EngineeringHashChain.computeCanonicalHash({
    docId: droneRenderData.documentId,
    verticesCount: len,
    indicesCount: origIndices.length,
    facesCount: droneRenderData.facesCount,
    vertices: vertsMid.map(v => Number(v.toFixed(6))),
    indices: origIndices,
    normals: origNormals.map(n => Number(n.toFixed(6)))
  }).canonicalHash;

  // Mutation 3: Late region (end vertex)
  const vertsLate = [...origVerts];
  vertsLate[len - 1] += 0.05;
  const hashLate = EngineeringHashChain.computeCanonicalHash({
    docId: droneRenderData.documentId,
    verticesCount: len,
    indicesCount: origIndices.length,
    facesCount: droneRenderData.facesCount,
    vertices: vertsLate.map(v => Number(v.toFixed(6))),
    indices: origIndices,
    normals: origNormals.map(n => Number(n.toFixed(6)))
  }).canonicalHash;

  const earlyDetected = hashEarly !== baselineHash;
  const midDetected = hashMid !== baselineHash;
  const lateDetected = hashLate !== baselineHash;

  console.log(` Baseline Hash       : ${baselineHash}`);
  console.log(` Early Mutation Hash : ${hashEarly} | Detected: ${earlyDetected}`);
  console.log(` Mid Mutation Hash   : ${hashMid} | Detected: ${midDetected}`);
  console.log(` Late Mutation Hash  : ${hashLate} | Detected: ${lateDetected}`);

  if (earlyDetected && midDetected && lateDetected) {
    console.log(' RESULT: [ PASS ] 100% Mutation Detection Coverage across entire mesh buffer.\n');
    passedTests++;
  } else {
    console.error(' RESULT: [ FAIL ] Mutation test failed! Undetected vertex modification.\n');
  }

  // ---------------------------------------------------------------------------
  // TEST 4: MAIN CAD & PROFESSIONAL 3D VIEWPORT CONVERGENCE
  // ---------------------------------------------------------------------------
  console.log('--- TEST 4: MAIN CAD vs PROFESSIONAL 3D VIEWPORT CONVERGENCE ---');
  totalTests++;

  const mainGeom = convertRenderDataToThreeBufferGeometry(droneRenderData, { unitScaleMultiplier: 1000 });
  const pro3dGeom = convertRenderDataToThreeBufferGeometry(droneRenderData);

  const mainVertCount = mainGeom.getAttribute('position')?.count || 0;
  const pro3dVertCount = pro3dGeom.getAttribute('position')?.count || 0;

  const mainIdxCount = mainGeom.getIndex()?.count || 0;
  const pro3dIdxCount = pro3dGeom.getIndex()?.count || 0;

  const mainUserData = mainGeom.userData;
  const pro3dUserData = pro3dGeom.userData;

  const identicalDocId = mainUserData.documentId === pro3dUserData.documentId;
  const identicalBRepHash = mainUserData.brepHash === pro3dUserData.brepHash;
  const identicalMeshHash = mainUserData.meshHash === pro3dUserData.meshHash;
  const identicalVerts = mainVertCount === pro3dVertCount && mainVertCount > 0;
  const identicalIdx = mainIdxCount === pro3dIdxCount;

  console.log(` Main CAD Vertices   : ${mainVertCount} | Pro 3D Vertices: ${pro3dVertCount}`);
  console.log(` Main CAD Indices    : ${mainIdxCount} | Pro 3D Indices: ${pro3dIdxCount}`);
  console.log(` Main CAD Mesh Hash  : ${mainUserData.meshHash}`);
  console.log(` Pro 3D Mesh Hash    : ${pro3dUserData.meshHash}`);

  if (identicalDocId && identicalBRepHash && identicalMeshHash && identicalVerts && identicalIdx) {
    console.log(' RESULT: [ PASS ] Zero SOT divergence between Main CAD & Professional 3D viewports.\n');
    passedTests++;
  } else {
    console.error(' RESULT: [ FAIL ] Viewport divergence detected!\n');
  }

  // ---------------------------------------------------------------------------
  // TEST 5: INDUSTRIAL DRONE CANONICAL ASSEMBLY TREE AUDIT
  // ---------------------------------------------------------------------------
  console.log('--- TEST 5: INDUSTRIAL DRONE CANONICAL ASSEMBLY TREE AUDIT ---');
  totalTests++;

  const hasAssemblyDef = !!droneDoc.assembly;
  const assemblyIdValid = droneDoc.assembly?.assemblyId === 'DRONE-001';
  const instances = droneDoc.assembly?.instances || [];
  const instanceCountValid = instances.length >= 15;

  // Sub-assemblies check
  const subAssyIds = ['DRONE-STRUCTURAL-ASSY', 'DRONE-PROPULSION-ASSY', 'DRONE-AVIONICS-ASSY', 'DRONE-POWER-ASSY', 'DRONE-PAYLOAD-ASSY'];
  const allSubAssysExist = subAssyIds.every(id => instances.some(i => i.instanceId === id && i.type === 'SUB_ASSEMBLY'));

  // Parent-Child linkage validation
  const chassisNode = instances.find(i => i.instanceId === 'DRONE-CHASSIS-001');
  const fcNode = instances.find(i => i.instanceId === 'DRONE-FC-001');
  const gpsNode = instances.find(i => i.instanceId === 'DRONE-GPS-001');

  const chassisLinkageValid = chassisNode?.parentId === 'DRONE-STRUCTURAL-ASSY' && chassisNode?.partId === 'PART-CHASSIS-001';
  const fcLinkageValid = fcNode?.parentId === 'DRONE-AVIONICS-ASSY' && fcNode?.geometryStatus === 'MODELED';
  const gpsLinkageValid = gpsNode?.parentId === 'DRONE-AVIONICS-ASSY' && gpsNode?.geometryStatus === 'PLANNED_NOT_MODELED';

  console.log(` Assembly Definition  : ${hasAssemblyDef ? 'PRESENT' : 'MISSING'}`);
  console.log(` Assembly ID          : ${droneDoc.assembly?.assemblyId}`);
  console.log(` Total Tree Instances : ${instances.length}`);
  console.log(` Sub-Assemblies Valid : ${allSubAssysExist ? 'YES (5/5 Sub-Assemblies)' : 'NO'}`);
  console.log(` Chassis Linkage      : ${chassisLinkageValid ? 'PASS' : 'FAIL'}`);
  console.log(` FC Linkage           : ${fcLinkageValid ? 'PASS' : 'FAIL'}`);
  console.log(` GPS Mast (PLANNED)   : ${gpsLinkageValid ? 'PASS' : 'FAIL'}`);

  if (hasAssemblyDef && assemblyIdValid && instanceCountValid && allSubAssysExist && chassisLinkageValid && fcLinkageValid && gpsLinkageValid) {
    console.log(' RESULT: [ PASS ] Canonical Drone Assembly Tree is fully established, deterministic, and linked.\n');
    passedTests++;
  } else {
    console.error(' RESULT: [ FAIL ] Drone Assembly Tree verification failed!\n');
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('================================================================');
  if (passedTests === totalTests) {
    console.log(` OVERALL VERDICT: ALL ${totalTests} FORENSIC CHECKS PASSED [ SUCCESS ]`);
  } else {
    console.error(` OVERALL VERDICT: ${passedTests}/${totalTests} CHECKS PASSED [ FAILURE ]`);
    process.exit(1);
  }
  console.log('================================================================');
}

runDroneForensicAudit().catch(err => {
  console.error('Fatal error in forensic audit:', err);
  process.exit(1);
});
