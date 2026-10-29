/**
 * SECP Industrial OS — Engineering Truth OS
 * reconcile_secp_expansion_004a.ts
 *
 * Independent Reconciliation & Evidence Verification for SECP-PHYSICS-EXPANSION-004A.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const REPORT_DIR = path.resolve(process.cwd(), 'reports/SECP-PHYSICS-EXPANSION-004A');
const MANIFEST_PATH = path.join(REPORT_DIR, 'SOURCE_AND_ARTIFACT_SHA256_MANIFEST.json');

function computeSha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function reconcile() {
  console.log('=== STARTING RECONCILIATION FOR SECP-PHYSICS-EXPANSION-004A ===');

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`[FAIL] Manifest does not exist at: ${MANIFEST_PATH}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

  // 1. Artifact Existence & Non-Emptiness Check
  console.log('--- 1. Artifact Existence & Stub Detection Check ---');
  for (const art of manifest.artifacts) {
    const fullPath = path.resolve(process.cwd(), art.relativePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`[FAIL] Missing artifact file: ${art.relativePath}`);
      process.exit(1);
    }
    const stat = fs.statSync(fullPath);
    if (stat.size === 0) {
      console.error(`[FAIL] Empty artifact (stub detected): ${art.relativePath}`);
      process.exit(1);
    }
    console.log(`  [OK] Artifact ${path.basename(art.relativePath).padEnd(45)} (${stat.size} bytes)`);
  }

  // 2. Mesh Convergence Checks
  console.log('--- 2. Mesh Convergence Verification ---');
  const meshResultsPath = path.join(REPORT_DIR, 'MESH_CONVERGENCE_RESULTS.json');
  const meshData = JSON.parse(fs.readFileSync(meshResultsPath, 'utf-8'));
  const levels = meshData.meshResults;

  console.log(`  Total Refinement Levels Evaluated: ${levels.length}`);
  for (let i = 0; i < levels.length; i++) {
    const lvl = levels[i];
    console.log(`  Level ${lvl.level}: elements=${lvl.elementCount}, h=${lvl.characteristicMeshSizeM}m, discrepancy=${lvl.surfaceFluxDiscretizationResidualWatts.toFixed(2)}W (${lvl.relativeSurfaceDiscrepancyPercent.toFixed(2)}%), reactionResidual=${lvl.reactionConservationResidualWatts.toExponential(2)}W`);
  }

  // Verify Monotonic Discrepancy Reduction
  for (let i = 1; i < levels.length; i++) {
    if (levels[i].surfaceFluxDiscretizationResidualWatts >= levels[i - 1].surfaceFluxDiscretizationResidualWatts) {
      console.error(`[FAIL] Non-monotonic surface flux discrepancy between Level ${levels[i-1].level} and ${levels[i].level}`);
      process.exit(1);
    }
  }
  console.log('  [PASS] Strictly monotonic error reduction confirmed across all mesh levels.');

  // Verify Variational Reaction Conservation (< 1e-3 W on all levels)
  for (const lvl of levels) {
    if (lvl.reactionConservationResidualWatts > 1e-3) {
      console.error(`[FAIL] Variational reaction residual ${lvl.reactionConservationResidualWatts} exceeds 1e-3 W on Level ${lvl.level}`);
      process.exit(1);
    }
  }
  console.log('  [PASS] Variational reaction conservation confirmed on all mesh levels.');

  // Check Adversarial Detection
  const advResultsPath = path.join(REPORT_DIR, 'BOUNDARY_FLUX_ADVERSARIAL_TESTS.json');
  const adv = JSON.parse(fs.readFileSync(advResultsPath, 'utf-8'));
  const advKeys = Object.keys(adv);
  for (const k of advKeys) {
    if (adv[k].status !== 'DETECTED') {
      console.error(`[FAIL] Adversarial test ${k} failed detection.`);
      process.exit(1);
    }
  }
  console.log(`  [PASS] All ${advKeys.length} adversarial tests successfully detected.`);

  // 3. SHA-256 Digest Validation
  console.log('--- 3. Independent SHA-256 Digest Validation ---');
  for (const art of manifest.artifacts) {
    const fullPath = path.resolve(process.cwd(), art.relativePath);
    const content = fs.readFileSync(fullPath);
    const computed = computeSha256(content);
    if (computed !== art.sha256) {
      console.error(`[FAIL] SHA-256 mismatch for ${art.relativePath}! Manifest: ${art.sha256}, Computed: ${computed}`);
      process.exit(1);
    }
    console.log(`  [VERIFIED SHA256] ${art.relativePath} => ${computed.substring(0, 16)}...`);
  }

  for (const src of manifest.sourceBindings) {
    const fullPath = path.resolve(process.cwd(), src.relativePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`[FAIL] Source file missing: ${src.relativePath}`);
      process.exit(1);
    }
    const content = fs.readFileSync(fullPath);
    const computed = computeSha256(content);
    if (computed !== src.sha256) {
      console.error(`[FAIL] Source file SHA-256 mismatch: ${src.relativePath}! Manifest: ${src.sha256}, Computed: ${computed}`);
      process.exit(1);
    }
    console.log(`  [VERIFIED SOURCE] ${src.relativePath} => ${computed.substring(0, 16)}...`);
  }

  console.log('=== RECONCILIATION COMPLETE: STATUS PASS ===');
}

reconcile().catch(err => {
  console.error('RECONCILIATION ERROR:', err);
  process.exit(1);
});
