
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { loadOcct } from './src/engine/kernels/occt/loader';
import { TopologyAdversarialSuite } from './src/engine/topology/TopologyAdversarialSuite';
import { ForensicTopologyValidator } from './src/engine/topology/ForensicTopologyValidator';
import { OcctShape } from './src/engine/kernels/occt/OcctShape';
import { ShapeIdentity, ShapeType } from './src/engine/geometry/GeometryTypes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runClosure() {
  console.log('=== SECP-096 B-REP / TOPOLOGY INTEGRITY CLOSURE GATE ===\n');

  // 1. Load Kernel
  const oc = await loadOcct();
  if (!oc) {
    console.error('FAIL: Could not initialize OCCT kernel.');
    process.exit(1);
  }
  console.log('Kernel Loaded Successfully.\n');

  // 2. Artifact Provenance
  const wasmPath = path.resolve(process.cwd(), 'node_modules/opencascade.js/dist/opencascade.wasm.wasm');
  const wasmBinary = fs.readFileSync(wasmPath);
  const wasmHash = crypto.createHash('sha256').update(wasmBinary).digest('hex');
  console.log(`Artifact SHA-256: ${wasmHash}\n`);

  // 3. Adversarial Suite
  const suite = new TopologyAdversarialSuite(oc);
  const suiteResults = await suite.runSuite();

  // 4. Detailed Forensic check on a Canonical Shape (Cube)
  console.log('\n--- Canonical Shape Forensic Analysis (Cube) ---');
  const cubeMaker = new oc.BRepPrimAPI_MakeBox_1(10, 10, 10);
  const cubeShape = cubeMaker.Shape();
  const identity: ShapeIdentity = { shapeId: 'cube', featureId: 'test', revision: 0, kernel: 'OCCT', geometryHash: 'cube_geo', topologyHash: 'cube_topo' };
  const handle = new OcctShape('cube', identity, ShapeType.SOLID, cubeShape, oc);
  
  const forensicResult = await ForensicTopologyValidator.validate(handle);
  
  console.log(`Status: ${forensicResult.isValid ? 'VALID' : 'INVALID'}`);
  console.log(`Manifoldness: ${forensicResult.manifoldness}`);
  console.log(`Euler Characteristic: ${forensicResult.eulerCharacteristic}`);
  console.log(`Genus: ${forensicResult.genus}`);
  console.log(`Counts: V=${forensicResult.counts.vertices}, E=${forensicResult.counts.edges}, F=${forensicResult.counts.faces}`);
  
  // 5. Final Decision
  const allInvariantsPassed = Object.values(forensicResult.invariants).every(v => v === true);
  const adversarialPassed = suiteResults.overall === 'PASS';
  
  const finalDecision = (forensicResult.isValid && allInvariantsPassed && adversarialPassed) ? 'PASS' : 'FAIL';
  
  console.log('\n-------------------------------------------');
  console.log(`FINAL SECP-096 CLOSURE DECISION: ${finalDecision}`);
  console.log('-------------------------------------------');

  if (finalDecision !== 'PASS') {
    console.error('\nReasons for failure:');
    if (!forensicResult.isValid) console.error('- Canonical shape validation failed.');
    if (!allInvariantsPassed) console.error('- One or more topological invariants violated.');
    if (!adversarialPassed) console.error('- Adversarial mutation suite failed (false negatives detected).');
    process.exit(1);
  }
}

runClosure().catch(e => {
  console.error('Closure Gate Execution Error:', e);
  process.exit(1);
});
