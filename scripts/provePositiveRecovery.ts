import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { 
  initializeAuthorityHandshake, 
  computeHMACSealToken,
  getActiveKeyVersion 
} from '../src/engine/simulation/SimulationAuthorityInternal';
import { IndependentPersistentEvidenceVerifier, PersistentEvidenceChain } from '../src/engine/plm_evidence/IndependentPersistentEvidenceVerifier';

/**
 * SECP-CAD-TRUTH-PATCH-003B — Positive Cold Start Recovery Proof
 * 
 * This script demonstrates the successful recovery of a genuinely signed 
 * engineering evidence chain in a fresh process environment.
 */
async function runPositiveProof() {
  console.log('--- SECP-CAD-TRUTH-PATCH-003B: STARTING POSITIVE COLD START PROOF ---');

  const AUTHORITY_SECRET = 'SECP_TRUE_ENGINEERING_AUTHORITY_SECRET_001';
  process.env.SECP_AUTHORITY_SECRET = AUTHORITY_SECRET;
  process.env.SECP_AUTHORITY_KEY_VERSION = 'SECP-V3-PROVENANCE-KEY-001';

  // 1. Initialize Authority in current process
  const keyVersion = initializeAuthorityHandshake({ forceSecret: AUTHORITY_SECRET });
  console.log(`Authority initialized in generator process. KeyVersion: ${keyVersion}`);

  // 2. Build a valid PersistentEvidenceChain
  const revHash = 'CAD-REV-B-9988-7766';
  const geoHash = 'GEO-BREP-A-1122-3344';
  const domain = 'CFD';
  const entityId = 'HYDRAULIC_PUMP_B_001';
  const context = 'CAD_CFD_TRUTH_BATTERY';

  // Issue a real capability-backed seal (using a dummy cap since computeHMACSealToken validates it)
  // Actually, computeHMACSealToken needs a real SealingCapability.
  // Let's use the internal sealing logic or mock the cap if possible.
  // Looking at computeHMACSealToken in SimulationAuthorityInternal.ts:
  // It calls validateCapability(capability, domain, String(revisionId), geometryHash)
  
  // I need a valid capability.
  const { issueSealingCapability } = await import('../src/engine/simulation/SimulationSealingAuthorization');
  const capability = issueSealingCapability(context, [domain], {
    cadRevisionHash: revHash,
    canonicalGeometryHash: geoHash
  });

  const { sealToken } = computeHMACSealToken(
    capability,
    domain,
    entityId,
    revHash,
    geoHash,
    keyVersion
  );

  const chain: PersistentEvidenceChain = {
    canonicalRevision: {
      revisionHash: revHash,
      entityName: 'Hydraulic Pump Assembly B',
      timestamp: new Date().toISOString()
    },
    bRepGeometry: {
      geometryHash: geoHash,
      faceCount: 12,
      topologyFaceIds: Array.from({length: 12}, (_, i) => `face_${i}`)
    },
    meshProvenance: {
      meshHash: 'MESH-HEX-001',
      sourceGeometryHash: geoHash,
      sourceRevisionHash: revHash,
      elementCount: 1000,
      nodeCount: 1200,
      provenanceDigest: IndependentPersistentEvidenceVerifier.sha256(`MESH-HEX-001:${geoHash}:${revHash}`)
    },
    executionAuthority: {
      isAuthoritative: true,
      executionSealToken: sealToken,
      timestamp: new Date().toISOString(),
      originatingCoreRevision: revHash,
      keyVersion: keyVersion,
      executionContext: context,
      domain: domain,
      canonicalEntityId: entityId
    },
    executionRecord: {
      executionId: 'EXEC-CFD-999',
      domain: domain,
      bindingId: entityId,
      cadRevisionHash: revHash,
      canonicalGeometryHash: geoHash,
      inputHash: 'INPUT-CFD-001',
      resultHash: 'RESULT-CFD-001',
      timestamp: new Date().toISOString()
    },
    cfdResult: {
      converged: true,
      iterations: 150,
      terminationReason: 'CONVERGED',
      forceStabilityPassed: true
    }
  };

  // Add content digest
  chain.contentDigest = IndependentPersistentEvidenceVerifier.computeChainDigest(chain);

  const chainJson = JSON.stringify(chain, null, 2);
  const artifactsDir = path.join(process.cwd(), '.aistudio', 'artifacts', 'brain', '9f1187ef-79ca-4cd8-9909-157bcf9db814');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }
  const chainPath = path.join(artifactsDir, 'PATCH003_POSITIVE_RECOVERY_CHAIN.json');
  fs.writeFileSync(chainPath, chainJson);
  console.log(`Valid chain generated and saved to: ${chainPath}`);

  // 3. Spawn the standalone verifier in a NEW PROCESS
  console.log('Spawning standalone verifier process...');
  
  const result = spawnSync('npx', [
    'tsx', 
    'src/engine/plm_evidence/cli/standaloneVerifierProcess.ts', 
    chainPath
  ], {
    env: { 
      ...process.env, 
      SECP_AUTHORITY_SECRET: AUTHORITY_SECRET,
      SECP_AUTHORITY_KEY_VERSION: keyVersion
    },
    encoding: 'utf-8'
  });

  console.log('Subprocess Exit Code:', result.status);
  console.log('Subprocess Output:', result.stdout);
  
  if (result.stderr) {
    console.error('Subprocess Error:', result.stderr);
  }

  if (result.status === 0) {
    console.log('SUCCESS: Positive cold start recovery verified.');
    
    // Write success record to adversarial results
    const logsPath = path.join(artifactsDir, 'PATCH003_PERSISTENCE_RECOVERY_RESULTS.json');
    const logs = {
      testCase: 'POSITIVE_COLD_START_RECOVERY',
      status: 'PASSED',
      timestamp: new Date().toISOString(),
      keyVersion: keyVersion,
      subprocessExitCode: result.status,
      verificationOutput: JSON.parse(result.stdout)
    };
    fs.writeFileSync(logsPath, JSON.stringify(logs, null, 2));
  } else {
    console.error('FAILURE: Positive cold start recovery failed.');
    process.exit(1);
  }
}

runPositiveProof().catch(err => {
  console.error('FATAL ERROR during positive proof:', err);
  process.exit(1);
});
