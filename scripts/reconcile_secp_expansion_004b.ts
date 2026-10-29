/**
 * SECP Industrial OS — Engineering Truth OS
 * reconcile_secp_expansion_004b.ts
 *
 * Independent Reconciliation & Evidence Verification for SECP-PHYSICS-EXPANSION-004B.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const REPORT_DIR = path.resolve(process.cwd(), 'reports/SECP-PHYSICS-EXPANSION-004B');
const MANIFEST_PATH = path.join(REPORT_DIR, 'SOURCE_AND_ARTIFACT_SHA256_MANIFEST.json');

function computeSha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function reconcile() {
  console.log('=== STARTING RECONCILIATION FOR SECP-PHYSICS-EXPANSION-004B ===');

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`[FAIL] Manifest does not exist at: ${MANIFEST_PATH}`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

  // 1. Artifact Existence & Stub Detection Check
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

  // 2. Analytical Comparison & Mesh Convergence Checks
  console.log('--- 2. Analytical Comparison & Mesh Convergence Checks ---');
  const convPath = path.join(REPORT_DIR, 'BOUNDARY_FLUX_CONVERGENCE_RESULTS.json');
  const convData = JSON.parse(fs.readFileSync(convPath, 'utf-8'));

  console.log(`  Total Refinement Levels Evaluated: ${convData.length}`);
  for (let i = 0; i < convData.length; i++) {
    const lvl = convData[i];
    console.log(`  Nx=${lvl.Nx}: elements=${lvl.elements}, h=${lvl.characteristicMeshSizeM}m, directFluxErr=${lvl.directSurfaceFluxDiscrepancyWatts.toFixed(2)}W (${lvl.relativeDirectFluxDiscrepancyPercent.toFixed(2)}%), reactionResidual=${lvl.variationalReactionResidualWatts.toExponential(2)}W`);
  }

  // Verify Monotonic Surface Flux Discrepancy Reduction
  for (let i = 1; i < convData.length; i++) {
    if (convData[i].directSurfaceFluxDiscrepancyWatts >= convData[i - 1].directSurfaceFluxDiscrepancyWatts) {
      console.error(`[FAIL] Non-monotonic direct surface flux discrepancy between Nx=${convData[i-1].Nx} and Nx=${convData[i].Nx}`);
      process.exit(1);
    }
  }
  console.log('  [PASS] Strictly monotonic surface flux error reduction against analytical solution confirmed.');

  // Verify Variational Reaction Conservation (< 1e-3 W against analytical heat)
  for (const lvl of convData) {
    if (lvl.variationalReactionResidualWatts > 1e-3) {
      console.error(`[FAIL] Variational reaction residual ${lvl.variationalReactionResidualWatts} W exceeds 1e-3 W on Nx=${lvl.Nx}`);
      process.exit(1);
    }
  }
  console.log('  [PASS] Variational nodal reaction conservation verified against analytical solution on all mesh levels.');

  // Check Adversarial & Mutation Results
  const advResultsPath = path.join(REPORT_DIR, 'ADVERSARIAL_MUTATION_RESULTS.json');
  const advData = JSON.parse(fs.readFileSync(advResultsPath, 'utf-8'));
  if (advData.totalFaultsDetected !== 12 || advData.totalFaultsInjected !== 12) {
    console.error(`[FAIL] Adversarial detection rate mismatch: ${advData.totalFaultsDetected}/${advData.totalFaultsInjected}`);
    process.exit(1);
  }
  console.log('  [PASS] All 12/12 adversarial and mutation fault injection tests successfully detected.');

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
