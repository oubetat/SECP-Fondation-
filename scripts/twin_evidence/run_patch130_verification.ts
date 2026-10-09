import * as fs from 'fs';
import * as path from 'path';
import { HardAcceptanceGate130 } from '../../src/engine/twin_evidence/HardAcceptanceGate130';
import { TwinEvidenceGraphEngine } from '../../src/engine/twin_evidence/TwinEvidenceGraphEngine';

async function runPatch130Verification() {
  console.log('='.repeat(80));
  console.log('SECP INDUSTRIAL OS v2 — PATCH-130: TWIN EVIDENCE GRAPH TRUTH');
  console.log('='.repeat(80));

  const reportsDir = path.join(process.cwd(), 'reports/digital-twin/patch-130');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const engine = new TwinEvidenceGraphEngine('TWIN-PROD-001');

  // Step 1: Generate a large Graph for 50 instances
  console.log('>>> STEP 1: Generating Comprehensive Twin Evidence Graph...');
  for (let i = 1; i <= 50; i++) {
    const id = i.toString().padStart(3, '0');
    engine.addNode(`CAD-${id}`, 'GEOMETRY_STATE', `ENT-${id}`, 'v1', 'Source', '2026-08-21T10:00:00Z');
    engine.addNode(`FEM-${id}`, 'SIMULATION_RESULT', `ENT-${id}`, 'v1', 'Source', '2026-08-21T10:05:00Z', { value: 400 });
    engine.addNode(`PRED-${id}`, 'PREDICTION', `ENT-${id}`, 'v1', 'Source', '2026-08-21T10:10:00Z', { value: 410 });
    
    engine.addEdge(`E-CAD-FEM-${id}`, `FEM-${id}`, `CAD-${id}`, 'DERIVED_FROM');
    engine.addEdge(`E-FEM-PRED-${id}`, `PRED-${id}`, `FEM-${id}`, 'DEPENDS_ON');
  }

  const reportContent = {
    graphId: engine.graph.graphId,
    rootHash: engine.graph.rootHash,
    nodeCount: engine.graph.nodes.size,
    edgeCount: engine.graph.edges.size,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(path.join(reportsDir, `graph_snapshot.json`), JSON.stringify(reportContent, null, 2));
  console.log(`Successfully generated graph with ${engine.graph.nodes.size} nodes and ${engine.graph.edges.size} edges in ${reportsDir}`);

  // Step 2: Evaluate Hard Acceptance Gate 130
  console.log('\n>>> STEP 2: Evaluating Hard Acceptance Gate 130...');
  const gateResult = HardAcceptanceGate130.evaluateGate();
  console.log(`>>> Total Gate Checks: ${gateResult.totalChecks}`);
  console.log(`>>> Passed Gate Checks: ${gateResult.passedChecks}`);
  console.log(`>>> Overall Gate Score: ${gateResult.overallScore}%`);
  console.log(`>>> Gate Verdict: ${gateResult.verdict}`);

  for (const c of gateResult.checks) {
    console.log(`  [${c.passed ? 'PASS' : 'FAIL'}] ${c.gateId}: ${c.description}`);
    console.log(`         ${c.details}`);
  }

  // Step 3: Scale & Performance Benchmark
  console.log('\n>>> STEP 3: Running Scale & Performance Benchmark...');
  const startTime = Date.now();
  
  const perfEngine = new TwinEvidenceGraphEngine('PERF');
  for (let k = 1; k <= 5000; k++) {
    perfEngine.addNode(`N-${k}`, 'GEOMETRY_STATE', 'E', 'v1', 'S', 'T', {}, false);
    if (k > 1) {
      perfEngine.addEdge(`E-${k}`, `N-${k}`, `N-${k-1}`, 'DERIVED_FROM', new Date().toISOString(), false);
    }
  }
  perfEngine.updateRootHash();
  
  const duration = Date.now() - startTime;
  console.log(`  [TIER 5,000 Nodes/Edges] Graph Construction & Root Hashing: ${duration.toFixed(2)}ms`);

  console.log('='.repeat(80));
  if (gateResult.verdict === 'PASS') {
    console.log('FINAL TWIN EVIDENCE GRAPH STATUS: ALL PASS (100% TRUTH VERIFIED)');
  } else {
    console.log('FINAL TWIN EVIDENCE GRAPH STATUS: FAIL');
    process.exit(1);
  }
  console.log('='.repeat(80));
}

runPatch130Verification().catch(err => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
