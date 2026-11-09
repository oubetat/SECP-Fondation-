import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

const ARTIFACT_DIR = path.join(process.cwd(), '.aistudio/artifacts/brain/9f1187ef-79ca-4cd8-9909-157bcf9db814');
const POSITIVE_CHAIN_PATH = path.join(ARTIFACT_DIR, 'PATCH003_POSITIVE_RECOVERY_CHAIN.json');
const STANDALONE_VERIFIER = path.join(process.cwd(), 'src/engine/plm_evidence/cli/standaloneVerifierProcess.ts');

const DEFAULT_ENV = {
  ...process.env,
  SECP_AUTHORITY_SECRET: 'SECP_TRUE_ENGINEERING_AUTHORITY_SECRET_001',
  SECP_AUTHORITY_KEY_VERSION: 'SECP-V3-PROVENANCE-KEY-001'
};

function runVerifier(chainPath: string, env = DEFAULT_ENV) {
  const result = spawnSync('npx', ['tsx', STANDALONE_VERIFIER, chainPath], {
    env,
    encoding: 'utf-8'
  });
  return {
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function writeTempChain(chain: any, name: string): string {
  const tempPath = path.join(ARTIFACT_DIR, `temp_adversarial_${name}.json`);
  fs.writeFileSync(tempPath, JSON.stringify(chain, null, 2));
  return tempPath;
}

async function runNegativeAttacks() {
  console.log('--- SECP PATCH-003B NEGATIVE ATTACK MATRIX ---');
  
  const baseChain = JSON.parse(fs.readFileSync(POSITIVE_CHAIN_PATH, 'utf-8'));

  // 1. Forged Token (Signed with different secret)
  console.log('\n[ATTACK 1] Forged Token (Invalid Secret)');
  const forgedEnv = { ...DEFAULT_ENV, SECP_AUTHORITY_SECRET: 'WRONG_SECRET_123' };
  const res1 = runVerifier(POSITIVE_CHAIN_PATH, forgedEnv);
  console.log(`Exit Code: ${res1.exitCode} (Expected: 1)`);
  console.log(`Output: ${res1.stdout.includes('AUTHORITY_SEAL_INVALID') ? 'REJECTED (AUTHORITY_SEAL_INVALID)' : 'FAILED'}`);

  // 2. Modified Payload (Mesh Hash Tamper)
  console.log('\n[ATTACK 2] Modified Payload (Mesh Hash Tamper)');
  const tamperedChain2 = { ...baseChain };
  tamperedChain2.meshProvenance.meshHash = 'TAMPERED-MESH-HASH';
  const path2 = writeTempChain(tamperedChain2, 'mesh_tamper');
  const res2 = runVerifier(path2);
  console.log(`Exit Code: ${res2.exitCode} (Expected: 1)`);
  console.log(`Output: ${res2.stdout.includes('GEOMETRY_HASH_MISMATCH') || res2.stdout.includes('MESH_HASH_TAMPERED') || res2.stdout.includes('CONTENT_DIGEST_MUTATED') ? 'REJECTED' : 'FAILED'}`);
  fs.unlinkSync(path2);

  // 3. Missing Secret
  console.log('\n[ATTACK 3] Missing Secret');
  const missingSecretEnv = { ...DEFAULT_ENV };
  delete missingSecretEnv.SECP_AUTHORITY_SECRET;
  const res3 = runVerifier(POSITIVE_CHAIN_PATH, missingSecretEnv);
  console.log(`Exit Code: ${res3.exitCode} (Expected: 1)`);
  console.log(`Output: ${res3.stdout.includes('AUTHORITY_SEAL_INVALID') ? 'REJECTED (AUTHORITY_SEAL_INVALID)' : 'FAILED'}`);

  // 4. Mismatched Key Version
  console.log('\n[ATTACK 4] Mismatched Key Version');
  const tamperedChain4 = { ...baseChain };
  tamperedChain4.executionAuthority.keyVersion = 'EXPIRED-KEY-001';
  const path4 = writeTempChain(tamperedChain4, 'key_mismatch');
  const res4 = runVerifier(path4);
  console.log(`Exit Code: ${res4.exitCode} (Expected: 1)`);
  console.log(`Output: ${res4.stdout.includes('AUTHORITY_SEAL_INVALID') ? 'REJECTED (AUTHORITY_SEAL_INVALID)' : 'FAILED'}`);
  fs.unlinkSync(path4);

  // 5. Cross-Revision Replay (Mismatch between Record and Revision)
  console.log('\n[ATTACK 5] Cross-Revision Replay');
  const tamperedChain5 = { ...baseChain };
  tamperedChain5.executionRecord.cadRevisionHash = 'ANOTHER-REV-ID';
  const path5 = writeTempChain(tamperedChain5, 'replay_attack');
  const res5 = runVerifier(path5);
  console.log(`Exit Code: ${res5.exitCode} (Expected: 1)`);
  console.log(`Output: ${res5.stdout.includes('REVISION_ID_MISMATCH') || res5.stdout.includes('STALE_REVISION_DISCREPANCY') ? 'REJECTED' : 'FAILED'}`);
  fs.unlinkSync(path5);

  console.log('\n--- NEGATIVE ATTACK MATRIX COMPLETE ---');
}

runNegativeAttacks().catch(console.error);
