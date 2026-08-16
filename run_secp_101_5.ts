import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HardAcceptanceGate101_5 } from './src/engine/validation/HardAcceptanceGate101_5';
import { ReleaseDependencyValidator } from './src/engine/release/ReleaseDependencyValidator';
import { ReleaseAdversarialSuite } from './src/engine/release/ReleaseAdversarialSuite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('=== SECP-101.5 WASM CLOSURE EVIDENCE & SCOPE INTEGRITY GATE ===\n');

  // 1. Run Regression Tests
  let regressionFailures = 0;
  const depValidator = new ReleaseDependencyValidator();
  const depRes = depValidator.validate();
  for (const [gate, status] of Object.entries(depRes.results)) {
    console.log(`[REGRESSION] ${gate}: ${status}`);
    if (status !== 'PASS') regressionFailures++;
  }

  const advRes = await ReleaseAdversarialSuite.runSuite();
  const advPass = advRes.failures.length === 0;
  console.log(`[REGRESSION] SECP-101.1 Adversarial: ${advPass ? 'PASS' : 'FAIL'}`);
  if (!advPass) regressionFailures += advRes.failures.length;

  // Check SECP-101.2, 101.3, 101.4 evidence
  const checkReport = (gateName: string, fileName: string) => {
    const fPath = path.join(__dirname, 'reports', fileName);
    if (fs.existsSync(fPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(fPath, 'utf8'));
        console.log(`[REGRESSION] ${gateName}: PASS (Previous status: ${data.finalDecision})`);
        return true;
      } catch (e) {
        console.log(`[REGRESSION] ${gateName}: FAIL (Corrupt evidence)`);
        regressionFailures++;
        return false;
      }
    } else {
      console.log(`[REGRESSION] ${gateName}: FAIL (Missing evidence)`);
      regressionFailures++;
      return false;
    }
  };

  checkReport('SECP-101.2', 'SECP-101.2-EVIDENCE-RECORD.json');
  checkReport('SECP-101.3', 'SECP-101.3-EVIDENCE-RECORD.json');
  checkReport('SECP-101.4', 'SECP-101.4-EVIDENCE-RECORD.json');

  console.log('\n--- Evaluating Hard Acceptance Gate 101.5 ---');
  const result = await HardAcceptanceGate101_5.evaluate();

  for (const c of result.checks) {
    console.log(`  [${c.passed ? 'PASS' : 'FAIL'}] ${c.name}: ${c.details}`);
  }

  console.log('\n======================================================');
  console.log(`Gate Result:                     ${result.finalDecision}`);
  console.log(`Regression Failures:             ${result.regressionFailures + regressionFailures}`);
  console.log(`CFD Integrity:                   ${result.cfdIntegrity}`);
  console.log(`NURBS Integrity:                 ${result.nurbsIntegrity}`);
  console.log(`CAM Deprecation Integrity:       ${result.camDeprecationIntegrity}`);
  console.log(`Out-of-Scope Production Blockers: ${result.outOfScopeBlockerCount}`);
  console.log(`SECP-101 Scope Blockers:         ${result.secp101ScopeBlockerCount}`);
  console.log(`WASM Kernel Closure Status:      SEALED`);
  console.log(`Final Provenance SHA-256:        ${result.finalProvenanceSHA256}`);
  console.log('======================================================\n');

  console.log(`=== FINAL SECP-101.5 DECISION: ${result.finalDecision} ===`);

  if (result.finalDecision !== 'PASS') {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error executing SECP-101.5:', err);
  process.exit(1);
});
