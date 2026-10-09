import * as fs from 'fs';
import * as path from 'path';
import { HardAcceptanceGate132 } from '../../src/engine/engineering_ai/geometry/HardAcceptanceGate132';
import { GeometryContext, GeometryEntityDescriptor } from '../../src/engine/engineering_ai/geometry/types';
import { CanonicalGeometrySerializer } from '../../src/engine/engineering_ai/geometry/CanonicalGeometrySerializer';
import { EngineeringGeometryReasoner } from '../../src/engine/engineering_ai/geometry/EngineeringGeometryReasoner';
import { TwinEvidenceGraphEngine } from '../../src/engine/twin_evidence/TwinEvidenceGraphEngine';

async function runPatch132Verification() {
  console.log('='.repeat(80));
  console.log('SECP INDUSTRIAL OS v2 — PATCH-132: GEOMETRY REASONING VERIFICATION');
  console.log('='.repeat(80));

  const reportsDir = path.join(process.cwd(), 'reports/digital-twin/patch-132');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  console.log('>>> STEP 1: Initializing Geometry Reasoning Layer...');

  const ctx: GeometryContext = {
    modelId: 'TURBINE-BLADE-01',
    geometryRevision: 'REV-C',
    kernelVersion: 'OpenCASCADE-7.6.0',
    topologyVersion: 'B-REP-v2',
    coordinateSystem: 'CARTESIAN_GLOBAL',
    units: 'mm',
    toleranceProfile: {
      linearTolerance: 0.001,
      angularTolerance: 0.01,
      topologyTolerance: 1e-6,
      intersectionTolerance: 1e-5,
      classificationTolerance: 0.01
    },
    geometryHash: ''
  };

  const sampleEntities: GeometryEntityDescriptor[] = [
    {
      entityId: 'CYL-01',
      entityType: 'FACE',
      geometryType: 'CYLINDER',
      dimension: 2,
      boundingBox: { min: [-5, -5, 0], max: [5, 5, 10] },
      parameters: { diameter: 10, depth: 10, isInternal: true },
      kernelReference: 'REF-CYL-01',
      hash: ''
    },
    {
      entityId: 'CYL-02',
      entityType: 'FACE',
      geometryType: 'CYLINDER',
      dimension: 2,
      boundingBox: { min: [15, -5, 0], max: [25, 5, 10] },
      parameters: { diameter: 10, depth: 10, isInternal: true },
      kernelReference: 'REF-CYL-02',
      hash: ''
    }
  ];

  for (const e of sampleEntities) {
    e.hash = CanonicalGeometrySerializer.computeEntityHash(e);
  }

  ctx.geometryHash = CanonicalGeometrySerializer.computeGeometryHash(
    ctx.modelId,
    ctx.geometryRevision,
    sampleEntities,
    ctx.topologyVersion,
    ctx.units
  );

  const twinGraph = new TwinEvidenceGraphEngine('TWIN-GEO-REASON-01');
  const reasoner = new EngineeringGeometryReasoner(ctx, sampleEntities);
  reasoner.recognizeAndVerifyFeatures();

  const groundingRes = reasoner.evaluateClaimAndGrounding(
    {
      claimText: 'Cylindrical face CYL-01 represents an internal coolant passage hole',
      mentionedEntityIds: ['CYL-01']
    },
    twinGraph
  );

  const snapshot = {
    context: ctx,
    verifiedFeaturesCount: reasoner.verifiedFeatures.length,
    groundingVerdict: groundingRes.hallucinationCheck.verdict,
    evidenceHash: groundingRes.evidence.evidenceHash,
    twinGraphRootHash: twinGraph.graph.rootHash,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    path.join(reportsDir, 'geometry_reasoning_snapshot.json'),
    JSON.stringify(snapshot, null, 2)
  );
  console.log(`Successfully written snapshot to ${reportsDir}/geometry_reasoning_snapshot.json`);

  console.log('\n>>> STEP 2: Evaluating Hard Acceptance Gate 132...');
  const gateResult = HardAcceptanceGate132.evaluateGate();
  console.log(`>>> Total Gate Checks: ${gateResult.totalChecks}`);
  console.log(`>>> Passed Gate Checks: ${gateResult.passedChecks}`);
  console.log(`>>> Overall Gate Score: ${gateResult.overallScore}%`);
  console.log(`>>> Gate Verdict: ${gateResult.verdict}`);

  for (const c of gateResult.checks) {
    console.log(`  [${c.passed ? 'PASS' : 'FAIL'}] ${c.gateId}: ${c.description}`);
    console.log(`         ${c.details}`);
  }

  console.log('\n>>> STEP 3: Running Benchmark Scale Test...');
  const startTime = Date.now();
  for (let i = 0; i < 1000; i++) {
    reasoner.queryGeometry('Find all holes larger than 5 mm');
  }
  const duration = Date.now() - startTime;
  console.log(`  [TIER 1,000 Geometry Reasoning Queries] Runtime: ${duration.toFixed(2)}ms`);

  console.log('='.repeat(80));
  if (gateResult.verdict === 'PASS') {
    console.log('FINAL GEOMETRY REASONING STATUS: ALL PASS (100% TRUTH VERIFIED)');
  } else {
    console.log('FINAL GEOMETRY REASONING STATUS: FAIL');
    process.exit(1);
  }
  console.log('='.repeat(80));
}

runPatch132Verification().catch((err) => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
