/**
 * SECP-098: CAM Toolpath Engine Forensic Integrity Gate - Closure Runner
 */

import { ParametricCAMBridge } from './src/engine/cam/ParametricCAMBridge';
import { CamAdversarialSuite } from './src/engine/cam/CamAdversarialSuite';
import { CAMProvenanceEngine } from './src/engine/cam/CAMProvenanceEngine';

async function runClosureGate() {
  console.log('=== SECP-098 CAM TOOLPATH ENGINE INTEGRITY CLOSURE GATE ===\n');

  // [1] - Production-Grade 3-Axis Toolpath Generation
  console.log('[1] Testing Production-Grade 3-Axis Toolpath Generation...');
  const stockBounds = { xMin: 0, xMax: 100, yMin: 0, yMax: 100, zMin: 0, zMax: 20 };
  const topologyId = 'topo-pocket-01';
  const topologyHash = 'sha256-abc123validated';

  const job = await ParametricCAMBridge.generateForensicCAMJob('part-001', topologyId, topologyHash, stockBounds);
  
  if (job.verifiedTrajectories.length > 0) {
    console.log('  - Generation: PASS');
  } else {
    console.log('  - Generation: FAIL');
    process.exit(1);
  }

  // [2] - Quantitative Forensic Metrics
  console.log('\n[2] Quantitative Forensic Metrics:');
  const trajectory = job.verifiedTrajectories[0];
  const report = trajectory.verificationReport;
  
  console.log(`  - Generated Path Length: ${report.metrics.totalLengthMm.toFixed(3)} mm`);
  console.log(`  - Segment Count: ${report.metrics.segmentCount}`);
  console.log(`  - Min Segment Length: ${report.metrics.minSegmentLengthMm.toFixed(6)} mm`);
  console.log(`  - Zero-Length Segments: ${report.metrics.zeroLengthSegments}`);
  console.log(`  - Continuity Gaps: ${report.metrics.continuityGaps}`);
  console.log(`  - Max Coordinate Deviation: ${report.metrics.maxCoordinateDeviationMm.toFixed(6)} mm`);
  console.log(`  - Stock Violations: ${report.metrics.stockViolations}`);
  console.log(`  - Invalid Segments: ${report.metrics.invalidSegments}`);
  console.log(`  - Provenance SHA-256: ${report.provenanceHash}`);

  if (report.isValid) {
    console.log('  - Metrics Validation: PASS');
  } else {
    console.log('  - Metrics Validation: FAIL');
    process.exit(1);
  }

  // [3] - Deterministic Replay Verification
  console.log('\n[3] Testing Deterministic Replay...');
  const replayJob = await ParametricCAMBridge.generateForensicCAMJob('part-001', topologyId, topologyHash, stockBounds);
  const isReplayValid = await CAMProvenanceEngine.verifyDeterministicReplay(job.provenance[0], replayJob.provenance[0]);
  
  if (isReplayValid) {
    console.log('  - Deterministic Replay: PASS (Hashes match exactly)');
  } else {
    console.log('  - Deterministic Replay: FAIL (Hash mismatch)');
    process.exit(1);
  }

  // [4] - Adversarial Suite
  console.log('\n[4] Running Adversarial Suite...');
  const adversarialResults = await CamAdversarialSuite.runSuite();
  adversarialResults.passes.forEach((p: string) => console.log(`  - [PASS] ${p}`));
  adversarialResults.failures.forEach((f: string) => console.log(`  - [FAIL] ${f}`));

  if (adversarialResults.failures.length === 0) {
    console.log('  - Adversarial Suite: PASS');
  } else {
    console.log('  - Adversarial Suite: FAIL');
    process.exit(1);
  }

  console.log('\n=== FINAL SECP-098 DECISION: PASS ===\n');
}

runClosureGate().catch(e => {
  console.error('Closure Gate Execution Error:', e);
  process.exit(1);
});
