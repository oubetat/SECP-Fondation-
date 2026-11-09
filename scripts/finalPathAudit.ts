import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';

const ARTIFACT_DIR = path.resolve(process.cwd(), '.aistudio/artifacts/brain/9f1187ef-79ca-4cd8-9909-157bcf9db814');
const POSITIVE_CHAIN_PATH = path.join(ARTIFACT_DIR, 'PATCH003_POSITIVE_RECOVERY_CHAIN.json');
const STANDALONE_VERIFIER = path.resolve(process.cwd(), 'src/engine/plm_evidence/cli/standaloneVerifierProcess.ts');

function getFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

async function runFinalPathAudit() {
  console.log('--- SECP PATCH-003B FINAL PATH & TRUST AUDIT ---');

  // 1. Path Verification
  console.log(`[AUDIT 1] Absolute Persistence Path: ${POSITIVE_CHAIN_PATH}`);
  if (!fs.existsSync(POSITIVE_CHAIN_PATH)) {
    console.error('FAILED: Chain file not found at expected path.');
    process.exit(1);
  }

  // 2. Pre-Verification Hash
  const hash1 = getFileHash(POSITIVE_CHAIN_PATH);
  console.log(`[AUDIT 2] Pre-Execution SHA-256:  ${hash1}`);

  // 3. Execution (Cold Start Simulation)
  console.log('[AUDIT 3] Executing Standalone Verifier (OS Subprocess)...');
  const result = spawnSync('npx', ['tsx', STANDALONE_VERIFIER, POSITIVE_CHAIN_PATH], {
    env: {
      ...process.env,
      SECP_AUTHORITY_SECRET: 'SECP_TRUE_ENGINEERING_AUTHORITY_SECRET_001',
      SECP_AUTHORITY_KEY_VERSION: 'SECP-V3-PROVENANCE-KEY-001'
    },
    encoding: 'utf-8'
  });

  console.log(`Exit Code: ${result.status}`);
  if (result.status === 0) {
    console.log('Result Outcome: PROVENANCE_VERIFIED (isValid=true)');
  } else {
    console.error('Execution Failed.');
    console.error(result.stdout);
    console.error(result.stderr);
  }

  // 4. Post-Verification Hash
  const hash2 = getFileHash(POSITIVE_CHAIN_PATH);
  console.log(`[AUDIT 4] Post-Execution SHA-256: ${hash2}`);

  if (hash1 === hash2) {
    console.log('[RESULT] Integrity Proof Stable: No modification detected.');
  } else {
    console.error('[FAILED] Integrity Violation: File was modified during verification.');
  }

  // 5. Trust Source Verification
  const chainContent = JSON.parse(fs.readFileSync(POSITIVE_CHAIN_PATH, 'utf-8'));
  const secretInChain = JSON.stringify(chainContent).includes('SECP_TRUE_ENGINEERING_AUTHORITY_SECRET_001');
  console.log(`[AUDIT 5] Secret Leaked in Chain: ${secretInChain}`);
  if (!secretInChain) {
    console.log('[RESULT] Trust Boundary Maintained: Secret is external to persistence layer.');
  }

  console.log('\n--- FINAL PATH & TRUST AUDIT COMPLETE ---');
}

runFinalPathAudit().catch(console.error);
