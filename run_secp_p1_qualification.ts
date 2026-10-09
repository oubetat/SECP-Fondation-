import { HardAcceptanceGateP1 } from './src/engine/validation/HardAcceptanceGateP1';

console.log('=== SECP PHASE P1: REAL CAD CORPUS VALIDATION ===\n');

try {
  const evidence = HardAcceptanceGateP1.evaluateQualification();

  console.log('--- Corpus Overview & Summary Metrics ---');
  const summary = evidence.corpusSummary;
  console.log(`  Evaluated Models Count:        ${summary.totalModelsEvaluated} / 14 Categories`);
  console.log(`  Total Evaluated Faces:         ${summary.totalFacesEvaluated.toLocaleString()}`);
  console.log(`  Total Evaluated Edges:         ${summary.totalEdgesEvaluated.toLocaleString()}`);
  console.log(`  Total Evaluated Solids:        ${summary.totalSolidsEvaluated}`);
  console.log(`  Max Assembly Tree Depth:       ${summary.maxAssemblyDepth} levels`);
  console.log(`  Average Import Time:           ${summary.averageImportTimeMs} ms`);
  console.log(`  Average Tessellation Time:     ${summary.averageTessellationTimeMs} ms`);
  console.log(`  Peak Memory Usage:             ${summary.peakMemoryUsageMb} MB`);
  console.log(`  Total Kernel Failures:         ${summary.totalKernelFailures}`);
  console.log(`  Average AP242 Export Fidelity: ${summary.averageExportFidelityPct}%`);
  console.log(`  Average Geometry Fidelity:     ${summary.averageGeometryFidelityPct}%\n`);

  console.log('--- Individual Model Geometry Fidelity Reports (Round-Trip Verified) ---');
  evidence.modelResults.forEach(res => {
    const f = res.fidelityReport;
    console.log(`  [${f.status}] ${res.modelSpec.id}: ${res.modelSpec.name}`);
    console.log(`      Category: ${f.category} | Format: ${res.modelSpec.fileFormat} | Size: ${(res.modelSpec.fileSizeBytes / 1024).toFixed(1)} KB`);
    console.log(`      Topology: ${res.modelSpec.nominalFaceCount} faces, ${res.modelSpec.nominalEdgeCount} edges, ${res.modelSpec.nominalSolidCount} solids (Depth ${res.modelSpec.assemblyDepth})`);
    console.log(`      Metrics:  Import ${res.metrics.importTimeMs}ms, Tessellate ${res.metrics.tessellationTimeMs}ms, RAM ${res.metrics.memoryUsageMb}MB`);
    console.log(`      Volume:   Orig ${f.originalVolumeMm3} mm3 -> Round-Trip ${f.roundTripVolumeMm3} mm3 (Dev: ${f.volumeDeviationPct}%)`);
    console.log(`      Area:     Orig ${f.originalSurfaceAreaMm2} mm2 -> Round-Trip ${f.roundTripSurfaceAreaMm2} mm2 (Dev: ${f.surfaceAreaDeviationPct}%)`);
    console.log(`      Fidelity: Score ${f.overallFidelityScorePct}% | Shell: ${f.shellClosureIntegrity} | Hausdorff: ${f.hausdorffDistanceMm} mm`);
    console.log(`      Diagnostics: ${f.diagnostics.join(' | ')}\n`);
  });

  console.log('--- Adversarial P1 Interoperability Suite ---');
  console.log(`  Passed Scenarios: ${evidence.adversarialP1Suite.passedScenarios}/${evidence.adversarialP1Suite.totalScenarios}`);
  evidence.adversarialP1Suite.scenarioResults.forEach(s => {
    console.log(`  [${s.passed ? 'PASS' : 'FAIL'}] ${s.id} - ${s.name}: ${s.reason}`);
  });
  console.log('');

  console.log('--- Replay & Cryptographic Integrity ---');
  console.log(`  [${evidence.deterministicReplay.passed ? 'PASS' : 'FAIL'}] Deterministic Replay Verification (Hash1 === Hash2)`);
  console.log(`  Provenance SHA-256: ${evidence.provenanceSha256}\n`);

  console.log('================================================');
  console.log(`CRITICAL FAILURES COUNT: ${evidence.criticalFailures.length}`);
  console.log(`P1 GATE STATUS: ${evidence.overallStatus}`);
  console.log('================================================\n');

  if (evidence.overallStatus !== 'PASS') {
    console.error('ERROR: Phase P1 Real CAD Corpus Validation Gate FAILED.');
    process.exit(1);
  } else {
    console.log('SUCCESS: Phase P1 Real CAD Corpus Validation Gate PASSED cleanly.');
    process.exit(0);
  }
} catch (err) {
  console.error('FATAL EXCEPTION in P1 Qualification Runner:', err);
  process.exit(1);
}
