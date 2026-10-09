
import { EngineeringDocument } from './src/engine/cad-kernel/document/CADDocument';
import { AssemblyPartExtractor } from './src/engine/assembly/AssemblyPartExtractor';
import { DroneCAMAdapter } from './src/engine/cam/DroneCAMAdapter';
import { BRepTessellator } from './src/engine/cad-kernel/tessellation/BRepTessellator';
import { EngineeringHashChain } from './src/engine/evidence/EngineeringHashChain';
import { CanonicalSerializer } from './src/engine/serialization/CanonicalSerializer';
import { BRepKernel } from './src/engine/cad-kernel/brep/BRepKernel';
import { BRepSolid as BRepSolidWrapper } from './src/engine/cad-kernel/brep/BRepContracts';

async function runAudit() {
  console.log('=== DRONE-CAM-CAUSALITY-PROOF-003: FORENSIC RUNTIME AUDIT ===\n');

  // 1. INSTANTIATE REAL DOCUMENT
  const doc: EngineeringDocument = {
    documentId: 'DOC_DRONE_001',
    revision: 1,
    units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
    sketches: [],
    constraints: [],
    features: [],
    parameters: [],
    assembly: { assemblyId: 'DRONE-001', instances: [] },
    topologyMap: { version: 1 },
    derived: {},
    evidence: []
  };
  
  const kernel = new BRepKernel();
  
  // Create the chassis solid - creating a 120x120x24 box
  // Note: BRepKernel.createBox uses meters, so we pass 0.12, 0.12, 0.024
  const wrappedSolid: BRepSolidWrapper = kernel.createBox(0.12 as any, 0.12 as any, 0.024 as any, 'audit_chassis');
  doc.evaluatedShape = wrappedSolid;
  
  // Setup assembly
  doc.assembly!.instances.push({
    instanceId: 'DRONE-CHASSIS-001',
    partId: 'PART-CHASSIS-001',
    name: 'Drone Chassis',
    documentId: 'DOC_DRONE_001',
    geometryReference: 'FEAT_DRONE_CHASSIS',
    geometryStatus: 'MODELED',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    metadata: { material: 'CARBON_FIBER' }
  } as any);

  console.log('--- PHASE A: BREP CONTRACT INSPECTION ---');
  const solidWrapper = doc.evaluatedShape as BRepSolidWrapper;
  // Ensure we handle both BRepSolid wrapper and direct Solid
  const solid = solidWrapper.topology || (solidWrapper as any);
  console.log('SOLID:');
  console.log('  id:', solid.id);
  console.log('  shapeType:', solid.shapeType);
  console.log('  persistentId:', solid.persistentId);

  const faces = (solid as any).outerShell?.orientedFaces || [];
  console.log(`\nFACES (${faces.length}):`);
  faces.forEach((of: any, idx: number) => {
    const f = of.face;
    console.log(`  Face ${idx}:`);
    console.log(`    id: ${f.id}`);
    console.log(`    persistentId: ${f.persistentId}`);
    console.log(`    shapeType: ${f.shapeType}`);
    console.log(`    geometry.type: ${f.geometry?.type}`);
    console.log(`    outerLoop.id: ${f.outerLoop?.id}`);
    console.log(`    orientedEdges: ${f.outerLoop?.orientedEdges?.length}`);
  });

  console.log('\n--- PHASE B: HASH CONTRADICTION INVESTIGATION ---');
  const tessResult = BRepTessellator.tessellate(solid);
  const extractionResult = AssemblyPartExtractor.extractPart(doc, 'DRONE-CHASSIS-001') as any;
  
  const hashes = {
    'BRepTessellator.computeBRepHash': BRepTessellator.computeBRepHash(solid),
    'Extraction geometryHash': extractionResult.hashes.geometryHash,
    'Tessellation meshHash': tessResult.meshHash,
    'Tessellation brepHash': tessResult.brepHash,
    'Adapter Expected Hash': '34199adc4e24085bfdccce12fbdbcffb46eb90ca720f8a61fd9554e04fe60c08'
  };

  Object.entries(hashes).forEach(([name, val]) => {
    console.log(`${name}: ${val}`);
  });

  // Deep inspection of Canonical Serialization
  const canonicalBRep = {
    faces: (solid.outerShell?.orientedFaces || []).map((of: any) => ({
      vertices: (of?.face?.outerLoop?.orientedEdges || []).map((oe: any) => {
        const vert = oe?.orientation === 'FORWARD' ? oe?.edge?.startVertex : oe?.edge?.endVertex;
        const p = vert?.geometry || { x: 0, y: 0, z: 0 };
        return {
          x: Number((p.x || 0).toFixed(6)),
          y: Number((p.y || 0).toFixed(6)),
          z: Number((p.z || 0).toFixed(6))
        };
      })
    }))
  };
  const serBRep = CanonicalSerializer.serialize(canonicalBRep);
  console.log('\nCanonical BRep String (truncated):', serBRep.canonicalString.substring(0, 200) + '...');

  const extractionPayload = {
    vertices: extractionResult.mesh.vertices.map((v: any) => Number(v.toFixed(6))),
    indices: extractionResult.mesh.indices,
    topologicalFaces: extractionResult.solid.facesCount,
    topologicalEdges: extractionResult.solid.edgesCount,
    topologicalVertices: extractionResult.solid.verticesCount
  };
  const serExt = CanonicalSerializer.serialize(extractionPayload);
  console.log('Extraction Payload String (truncated):', serExt.canonicalString.substring(0, 200) + '...');

  console.log('\n--- PHASE C: REAL ADAPTER EXECUTION ---');
  try {
    // We need to fix the doc ID for the adapter check
    (doc as any).id = 'DOC_DRONE_001';
    await DroneCAMAdapter.processChassisCAM(doc, 'DRONE-CHASSIS-001');
    console.log('ADAPTER_INTEGRITY = PASS');
  } catch (e: any) {
    console.log('ADAPTER_INTEGRITY = FAIL');
    console.log('Error:', e.message);
  }

  console.log('\n--- PHASE D: TOPOLOGY IDENTITY PROOF ---');
  const topFaceId = faces.find((of: any) => {
    const f = of.face;
    return f.geometry?.normal?.z === 1;
  })?.face.id;

  console.log('Detected Top Face ID:', topFaceId);
  const adapterExpectedTopFaceId = 'DOC_DRONE_001_chassis-face-top';
  console.log('Adapter Expected Top Face ID:', adapterExpectedTopFaceId);
  console.log('Identity Match:', topFaceId === adapterExpectedTopFaceId ? 'PASS' : 'FAIL');

  console.log('\n--- PHASE E: FEATURE -> OPERATION CHAIN ---');
  const mesh = extractionResult.mesh;
  const topologyMap = mesh.topologyMap;
  
  if (topFaceId && topologyMap?.faceTriangleMap[topFaceId]) {
    const fMap = topologyMap.faceTriangleMap[topFaceId];
    console.log(`Face ${topFaceId} maps to ${fMap.triangleIndices.length} triangle indices.`);
    console.log('Sample indices:', fMap.triangleIndices.slice(0, 6));
  } else {
    console.log('ERROR: Topology map link broken for', topFaceId);
  }

  console.log('\n--- PHASES F-I: MUTATION & CONTAINMENT ---');
  console.log('Skipping detailed mutation steps in diagnostic summary.');
}

runAudit().catch(console.error);
