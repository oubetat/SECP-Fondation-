/**
 * SECP-097: CAD Import / Export Forensic Integrity Gate - Closure Runner
 * 
 * Executes the adversarial interop suite, verifying geometric, topological,
 * and semantic fidelity across STEP and IGES exchange cycles.
 */

import { ForensicCadExchangeValidator, CadExchangeFormat } from './src/engine/cad/ForensicCadExchangeValidator';
import { AP242TestFixtures } from './src/engine/interop/AP242TestFixtures';
import { AP242SemanticModel } from './src/engine/interop/AP242Types';

async function runClosureGate() {
  console.log('=== SECP-097 CAD IMPORT / EXPORT INTEGRITY CLOSURE GATE ===\n');

  const fixtures = [
    { id: 'A', name: 'Simple Prismatic Block', model: AP242TestFixtures.getFixtureA(), format: 'STEP' },
    { id: 'B', name: 'Precision Shaft', model: AP242TestFixtures.getFixtureB(), format: 'STEP' },
    { id: 'C', name: 'Datum Plate', model: AP242TestFixtures.getFixtureC(), format: 'STEP' },
    { id: 'D', name: 'Turbine Housing', model: AP242TestFixtures.getFixtureD(), format: 'STEP' },
    { id: 'E', name: 'Multi-Component Assembly', model: AP242TestFixtures.getFixtureE(), format: 'STEP' },
    { id: 'G', name: 'High-Density Stress Case', model: AP242TestFixtures.getFixtureG(), format: 'STEP' },
    { id: 'IGES_A', name: 'IGES Round-Trip', model: AP242TestFixtures.getFixtureA(), format: 'IGES' }
  ];

  const results: any[] = [];

  // [1] - [6] Standard and Round-Trip Verification
  for (const f of fixtures) {
    process.stdout.write(`[${f.format}] Testing Fixture ${f.id} (${f.name})... `);
    const report = await ForensicCadExchangeValidator.verifyRoundTrip(f.model as AP242SemanticModel, f.format as CadExchangeFormat);
    
    if (report.isValid) {
      console.log('PASS');
    } else {
      console.log('FAIL');
      report.violations.forEach(v => console.log(`  - [${v.severity}] ${v.type}: ${v.message}`));
    }
    results.push({ id: f.id, format: f.format, report });
  }

  // [7] Malformed Input Rejection
  console.log('\n[7] Testing Malformed Input Rejection...');
  const malformedStep = AP242TestFixtures.getFixtureF();
  try {
     const { STEPAP242Translator } = await import('./src/engine/interop/STEPAP242Translator');
     STEPAP242Translator.importFromStepPart21(malformedStep);
     console.log('  - Malformed STEP: FAIL (Accepted invalid input)');
  } catch (e: any) {
     console.log(`  - Malformed STEP: PASS (Rejected: ${e.message})`);
  }

  // Truncated Case
  const truncatedStep = malformedStep.substring(0, 100);
  try {
     const { STEPAP242Translator } = await import('./src/engine/interop/STEPAP242Translator');
     STEPAP242Translator.importFromStepPart21(truncatedStep);
     console.log('  - Truncated STEP: FAIL (Accepted truncated input)');
  } catch (e: any) {
     console.log(`  - Truncated STEP: PASS (Rejected: ${e.message})`);
  }

  // Empty Case
  try {
     const { STEPAP242Translator } = await import('./src/engine/interop/STEPAP242Translator');
     STEPAP242Translator.importFromStepPart21('');
     console.log('  - Empty STEP: FAIL (Accepted empty input)');
  } catch (e: any) {
     console.log(`  - Empty STEP: PASS (Rejected: ${e.message})`);
  }

  // [8] Determinism Testing
  console.log('\n[8] Testing Determinism (Repeatability)...');
  const fixtureA = AP242TestFixtures.getFixtureA();
  const rep1 = await ForensicCadExchangeValidator.verifyRoundTrip(fixtureA, 'STEP');
  const rep2 = await ForensicCadExchangeValidator.verifyRoundTrip(fixtureA, 'STEP');
  
  if (rep1.provenance.exportedArtifactHash === rep2.provenance.exportedArtifactHash &&
      rep1.structuralFingerprint.hash === rep2.structuralFingerprint.hash) {
     console.log('  - Determinism: PASS');
  } else {
     console.log('  - Determinism: FAIL (Hash mismatch between repeated exports)');
  }

  // Final Summary Output
  console.log('\n=== FINAL SECP-097 DECISION SUMMARY ===');
  const allPass = results.every(r => r.report.isValid);
  
  results.forEach(r => {
    console.log(`Fixture ${r.id} [${r.format}]: ${r.report.isValid ? 'PASS' : 'FAIL'} | Fidelity Score: ${r.report.overallFidelityScore}%`);
    console.log(`  - Vol Error: ${r.report.geometricFidelity.volumeError.toFixed(6)} mm3`);
    console.log(`  - COG Drift: ${r.report.geometricFidelity.cogDrift.toFixed(6)} mm`);
    console.log(`  - Max Drift: ${r.report.geometricFidelity.maxCoordinateDrift.toFixed(6)} mm`);
    console.log(`  - Fingerprint: ${r.report.structuralFingerprint.hash.substring(0, 8)}...`);
    console.log(`  - Provenance: SHA-256=${r.report.provenance.exportedArtifactHash.substring(0, 8)}...\n`);
  });

  if (allPass) {
    console.log('-------------------------------------------');
    console.log('FINAL SECP-097 CLOSURE DECISION: PASS');
    console.log('-------------------------------------------');
  } else {
    console.log('-------------------------------------------');
    console.log('FINAL SECP-097 CLOSURE DECISION: FAIL');
    console.log('-------------------------------------------');
    process.exit(1);
  }
}

runClosureGate().catch(e => {
  console.error('Closure Gate Execution Error:', e);
  process.exit(1);
});
