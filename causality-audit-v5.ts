
import { EngineeringHashChain } from './src/engine/evidence/EngineeringHashChain';
import { BRepKernel } from './src/engine/cad-kernel/brep/BRepKernel';
import { AssemblyPartExtractor } from './src/engine/assembly/AssemblyPartExtractor';
import { BRepTessellator } from './src/engine/cad-kernel/tessellation/BRepTessellator';
import { PersistentTopologyNaming } from './src/engine/cad-kernel/topology/PersistentTopologyNaming';
import { FeatureNode } from './src/engine/cad-kernel/history/FeatureNode';
import { BoxFactory } from './src/engine/boolean/BoxFactory';
import * as fs from 'fs';

async function runAudit() {
  console.log('--- DRONE-CAM-CAUSALITY-PROOF-003: DEEP GEOMETRY TRACE ---');

  const EXPECTED_LEGACY_HASH = '34199adc4e24085bfdccce12fbdbcffb46eb90ca720f8a61fd9554e04fe60c08';
  const DOC_ID = 'DOC_DRONE_001';
  const FEATURE_ID = 'DRONE-CHASSIS-001';

  // 1. Recreate the Chassis Solid precisely as a "Feature Result"
  // The chassis is 100x60x10 mm box.
  const kernel = BRepKernel.getCanonical();
  const chassisSolid = kernel.createBox(0.1 as any, 0.06 as any, 0.01 as any, 'chassis');
  
  // 2. Perform Persistent Topology Naming (this is what happens in FeatureNode.markValid)
  PersistentTopologyNaming.assignPersistentTopology(chassisSolid, FEATURE_ID);
  
  // 3. Mock the CAD Document exactly as AssemblyPartExtractor expects
  const mockDoc = {
    documentId: DOC_ID,
    id: DOC_ID,
    assembly: {
      instances: [
        {
          instanceId: FEATURE_ID,
          partId: 'CHASSIS_PART',
          name: 'Drone Chassis',
          geometryReference: 'FEAT_EXTRUDE_001',
          geometryStatus: 'MODELED',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          metadata: { material: 'CARBON_FIBER' }
        }
      ]
    },
    evaluatedShape: chassisSolid
  };

  // 4. Extract Part via AssemblyPartExtractor
  const extraction = AssemblyPartExtractor.extractPart(mockDoc, FEATURE_ID);
  
  if (extraction.status !== 'SUCCESS') {
    console.error('Extraction failed:', extraction.message);
    return;
  }

  const runtimeGeometryHash = extraction.hashes.geometryHash;
  console.log(`Runtime Geometry Hash: ${runtimeGeometryHash}`);
  console.log(`Expected Legacy Hash:  ${EXPECTED_LEGACY_HASH}`);
  console.log(`Match: ${runtimeGeometryHash === EXPECTED_LEGACY_HASH ? 'PASS' : 'FAIL'}`);

  // 5. DEEP DIVE: Trace the inputs to the geometry hash
  // AssemblyPartExtractor line 403:
  // const geometryHash = EngineeringHashChain.computeCanonicalHash({
  //   vertices: vertices.map(v => Number(v.toFixed(6))),
  //   indices,
  //   topologicalFaces,
  //   topologicalEdges,
  //   topologicalVertices
  // }).canonicalHash;

  const vertices = extraction.mesh.vertices;
  const indices = extraction.mesh.indices;
  const faces = extraction.solid.facesCount;
  const edges = extraction.solid.edgesCount;
  const verts = extraction.solid.verticesCount;

  console.log('\n--- Extraction Payload Stats ---');
  console.log(`Vertices Count: ${vertices.length / 3}`);
  console.log(`Indices Count: ${indices.length}`);
  console.log(`Topology: ${faces}F / ${edges}E / ${verts}V`);

  // 6. Test Hypothesis: Does changing vertex precision or topology counts reach the legacy hash?
  // We suspect the legacy hash might be from 6F/12E/8V (standard box) vs 10F/24E/16V (extruded polygon box)
  
  const payloadLegacyCounts = {
    vertices: vertices.map(v => Number(v.toFixed(6))),
    indices,
    topologicalFaces: 6,
    topologicalEdges: 12,
    topologicalVertices: 8
  };
  const legacyCountsHash = EngineeringHashChain.computeCanonicalHash(payloadLegacyCounts).canonicalHash;
  console.log(`\nHypothesis 1: Standard Box Counts (6F/12E/8V): ${legacyCountsHash}`);
  console.log(`Match: ${legacyCountsHash === EXPECTED_LEGACY_HASH ? 'PASS' : 'FAIL'}`);

  // Hypothesis 2: Different rounding?
  const payloadDifferentRounding = {
    vertices: vertices.map(v => Number(v.toFixed(5))), // 5 decimals instead of 6
    indices,
    topologicalFaces: faces,
    topologicalEdges: edges,
    topologicalVertices: verts
  };
  const diffRoundingHash = EngineeringHashChain.computeCanonicalHash(payloadDifferentRounding).canonicalHash;
  console.log(`Hypothesis 2: 5 Decimals Precision: ${diffRoundingHash}`);

  // 7. Identity Trace
  console.log('\n--- Identity Trace ---');
  const topFaceId = `DRONE-CHASSIS-001:FACE:CapEnd`;
  const auditFace = chassisSolid.outerShell.orientedFaces.find(of => of.face.persistentId === topFaceId);
  console.log(`Face ${topFaceId} found: ${!!auditFace}`);
  if (auditFace) {
     console.log(`Face Signature: ${auditFace.face.lineage?.geometricSignature}`);
  }

  // 8. Log the canonical string for the failing hash to compare manually if needed
  const serializationResult = (EngineeringHashChain as any).computeCanonicalHash({
      vertices: vertices.map(v => Number(v.toFixed(6))),
      indices,
      topologicalFaces: 6,
      topologicalEdges: 12,
      topologicalVertices: 8
  });
  console.log('\n--- Canonical Serialization Trace (Hypothesis 1) ---');
  console.log(`Canonical String Head: ${serializationResult.canonicalHash.substring(0, 64)}...`);
  // console.log(`Full String: ${serializationResult.canonicalString}`);

  // 9. Hypothesis 3: Raw numbers (no toFixed)
  const payloadRaw = {
    vertices: vertices,
    indices,
    topologicalFaces: 6,
    topologicalEdges: 12,
    topologicalVertices: 8
  };
  const rawHash = EngineeringHashChain.computeCanonicalHash(payloadRaw).canonicalHash;
  console.log(`Hypothesis 3: Raw Numbers (no toFixed): ${rawHash}`);
  console.log(`Match: ${rawHash === EXPECTED_LEGACY_HASH ? 'PASS' : 'FAIL'}`);

  // 10. Hypothesis 4: Meter coordinates (already meters, but maybe they were mm?)
  const payloadMM = {
    vertices: vertices.map(v => Number((v * 1000).toFixed(6))),
    indices,
    topologicalFaces: 6,
    topologicalEdges: 12,
    topologicalVertices: 8
  };
  const mmHash = EngineeringHashChain.computeCanonicalHash(payloadMM).canonicalHash;
  console.log(`Hypothesis 4: MM Coordinates: ${mmHash}`);
  console.log(`Match: ${mmHash === EXPECTED_LEGACY_HASH ? 'PASS' : 'FAIL'}`);
}

runAudit().catch(console.error);
