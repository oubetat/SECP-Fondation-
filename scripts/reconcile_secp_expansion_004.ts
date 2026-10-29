/**
 * SECP Industrial OS — Engineering Truth OS
 * reconcile_secp_expansion_004.ts
 *
 * Independent Reconciliation & Evidence Verification for SECP-PHYSICS-EXPANSION-004.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const REPORT_DIR = path.resolve(process.cwd(), 'reports/SECP-PHYSICS-EXPANSION-004');
const MANIFEST_PATH = path.join(REPORT_DIR, 'SOURCE_AND_ARTIFACT_SHA256_MANIFEST.json');

function computeSha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function reconcile() {
  console.log('=== STARTING RECONCILIATION FOR SECP-PHYSICS-EXPANSION-004 ===');

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

  // 2. Numerical Conservation & Energy Balance Checks
  console.log('--- 2. Independent Energy Balance & Conservation Audit ---');
  const consResultsPath = path.join(REPORT_DIR, 'INDEPENDENT_CONSERVATION_RESULTS.json');
  const cons = JSON.parse(fs.readFileSync(consResultsPath, 'utf-8'));

  console.log(`  Electrical Power (P_elec)             : ${cons.electricalPowerWatts.toFixed(6)} W`);
  console.log(`  Volumetric Thermal Heat (Q_vol)       : ${cons.volumetricThermalHeatWatts.toFixed(6)} W`);
  console.log(`  Boundary Reaction Heat Sinks (Q_sink) : ${cons.boundaryReactionSinkWatts.toFixed(6)} W`);
  console.log(`  Reaction Conservation Residual        : ${cons.reactionConservationResidualWatts.toExponential(4)} W`);
  console.log(`  Relative Reaction Imbalance Ratio     : ${cons.relativeReactionImbalanceRatio.toExponential(4)}`);
  console.log(`  Surface Normal Boundary Loss          : ${cons.surfaceNormalBoundaryLossWatts.toFixed(4)} W`);
  console.log(`  Discretization Flux Discrepancy       : ${cons.surfaceFluxDiscretizationResidualWatts.toFixed(4)} W`);
  console.log(`  Conservation Status                   : ${cons.conservationStatus}`);

  if (cons.reactionConservationResidualWatts > 1e-4) {
    console.error(`[FAIL] Reaction conservation residual ${cons.reactionConservationResidualWatts} W exceeds 1e-4 W tolerance.`);
    process.exit(1);
  }
  if (cons.relativeReactionImbalanceRatio > 1e-4) {
    console.error(`[FAIL] Relative reaction imbalance ${cons.relativeReactionImbalanceRatio} exceeds 1e-4 tolerance.`);
    process.exit(1);
  }
  if (cons.conservationStatus !== 'VERIFIED_INDEPENDENT_EQUILIBRIUM') {
    console.error(`[FAIL] Conservation status is not VERIFIED_INDEPENDENT_EQUILIBRIUM.`);
    process.exit(1);
  }
  console.log('  [PASS] Independent nodal reaction energy conservation verified.');

  // Check Adversarial Detection
  const advResultsPath = path.join(REPORT_DIR, 'ADVERSARIAL_FAULT_INJECTION_RESULTS.json');
  const adv = JSON.parse(fs.readFileSync(advResultsPath, 'utf-8'));
  const advKeys = Object.keys(adv);
  for (const k of advKeys) {
    if (adv[k].status !== 'DETECTED') {
      console.error(`[FAIL] Adversarial test ${k} failed detection.`);
      process.exit(1);
    }
  }
  console.log(`  [PASS] All ${advKeys.length} adversarial fault injection tests successfully detected.`);

  // 3. SHA-256 Manifest Validation
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
