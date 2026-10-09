
import { EvidenceBus314 } from '../engine/engineering_ai/copilot/EvidenceBus314';
import { EngineeringEvidenceLedger } from '../engine/evidence/ledger/EngineeringEvidenceLedger';
import { EngineeringTruthEngine } from '../engine/kernel/EngineeringTruthEngine';
import { WorkbenchStateOwnershipEngine } from '../engine/workbench/WorkbenchStateOwnershipEngine';
import { EngineeringOS } from '../engine/kernel/EngineeringOS';
import { EngineeringObjectStatus } from '../engine/kernel/types';

interface ProjectFingerprint {
  projectId: string;
  documentId: string;
  documentHash: string;
  geometryHash: string;
  objectName: string;
}

const FINGERPRINT_A: ProjectFingerprint = {
  projectId: 'PROJECT-ALPHA-DRONE',
  documentId: 'DOC-ALPHA-001',
  documentHash: 'SHA256-ALPHA-DOC-HASH',
  geometryHash: 'MESH-ALPHA-GEO-HASH',
  objectName: 'AlphaPropulsionSystem'
};

const FINGERPRINT_B: ProjectFingerprint = {
  projectId: 'PROJECT-BETA-ENGINE',
  documentId: 'DOC-BETA-002',
  documentHash: 'SHA256-BETA-DOC-HASH',
  geometryHash: 'MESH-BETA-GEO-HASH',
  objectName: 'BetaCylinderBlock'
};

function contaminate(fingerprint: ProjectFingerprint) {
  console.log(`[STRESS] Contaminating system with ${fingerprint.projectId} fingerprints...`);
  
  const evidenceBus = EvidenceBus314.getInstance();
  evidenceBus.registerEvidence(
    fingerprint.projectId, 
    { hash: fingerprint.documentHash }, 
    '1.0.0', 
    'CANONICAL_SOURCE'
  );

  const ledger = EngineeringEvidenceLedger.getInstance();
  ledger.registerEvidence({
    evidenceType: 'MANUFACTURING_TOLERANCE',
    engineeringObjectId: fingerprint.objectName,
    objectRevision: '1.0.0',
    projectId: fingerprint.projectId,
    organizationId: 'STRESS_ORG',
    producerIdentity: 'SYSTEM_STRESS_TEST',
    producerType: 'SYSTEM',
    sourceSystem: 'STRESS_ENGINE',
    sourceVersion: '2.0.0',
    payload: { geometryHash: fingerprint.geometryHash }
  });

  const truthEngine = EngineeringTruthEngine.getInstance();
  truthEngine.registerObject({
    id: `OBJ-${fingerprint.projectId}-ROOT`,
    name: fingerprint.objectName,
    domain: 'PART',
    status: EngineeringObjectStatus.STABLE,
    revision: { 
      id: 'REV-1', 
      timestamp: new Date().toISOString(), 
      author: 'STRESS_AGENT', 
      hash: fingerprint.documentHash,
      comment: `Fingerprint for ${fingerprint.projectId}` 
    },
    provenance: { sourceId: 'STRESS', sourceDomain: 'ENGINEERING', transformType: 'INITIAL_CREATION', timestamp: new Date().toISOString(), runtimeVersion: '1.0' },
    simulationResultIds: [],
    evidenceIds: [],
    isCertified: true,
    metadata: { fingerprint: fingerprint.geometryHash }
  });

  const ownershipEngine = WorkbenchStateOwnershipEngine.getInstance();
  ownershipEngine.registerWorkbench(`WORKBENCH-${fingerprint.projectId}`, [{ name: fingerprint.objectName, category: 'SESSION' }]);
}

function verifyIsolation(currentFingerprint: ProjectFingerprint, otherFingerprint: ProjectFingerprint) {
  console.log(`[STRESS] Verifying isolation for ${currentFingerprint.projectId}...`);
  
  const evidenceBus = EvidenceBus314.getInstance();
  const ledger = EngineeringEvidenceLedger.getInstance();
  const truthEngine = EngineeringTruthEngine.getInstance();
  const ownershipEngine = WorkbenchStateOwnershipEngine.getInstance();

  let violations = 0;

  // Check for residual from OTHER project
  const residualEvidence = evidenceBus.queryEvidence({ source: otherFingerprint.projectId });
  if (residualEvidence.length > 0) {
    console.error(`  [LEAK] EvidenceBus314 contains residual data from ${otherFingerprint.projectId}!`);
    violations++;
  }

  const residualLedger = ledger.getEntries().filter(e => e.record.projectId === otherFingerprint.projectId);
  if (residualLedger.length > 0) {
    console.error(`  [LEAK] EngineeringEvidenceLedger contains residual data from ${otherFingerprint.projectId}!`);
    violations++;
  }

  const residualTruth = truthEngine.getObject(`OBJ-${otherFingerprint.projectId}-ROOT`);
  if (residualTruth) {
    console.error(`  [LEAK] EngineeringTruthEngine contains residual data from ${otherFingerprint.projectId}!`);
    violations++;
  }

  const workbenchReport = ownershipEngine.auditWorkbench(`WORKBENCH-${otherFingerprint.projectId}`);
  if (workbenchReport.registeredEntities.length > 0) {
    console.error(`  [LEAK] WorkbenchStateOwnershipEngine contains residual workbench from ${otherFingerprint.projectId}!`);
    violations++;
  }

  if (violations === 0) {
    console.log(`  ✓ NO residual data from ${otherFingerprint.projectId} found.`);
  }

  return violations;
}

function verifyCleanSlate() {
  console.log('[STRESS] Verifying absolute clean slate...');
  const truthEngine = EngineeringTruthEngine.getInstance();
  const ledger = EngineeringEvidenceLedger.getInstance();
  const evidenceBus = EvidenceBus314.getInstance();
  
  const truthCount = truthEngine.listAll().length;
  const ledgerCount = ledger.getEntries().length;
  
  if (truthCount > 0 || ledgerCount > 0) {
    console.error(`  [LEAK] Clean slate check failed! TruthObjects: ${truthCount}, LedgerEntries: ${ledgerCount}`);
    return 1;
  }
  console.log('  ✓ System state is absolutely zeroed.');
  return 0;
}

async function runMultiCycleStressTest() {
  console.log('====================================================================================================');
  console.log('    POST-UX-005 — MULTI-CYCLE SINGLETON ISOLATION STRESS TEST (A -> B -> A -> B)                  ');
  console.log('====================================================================================================');

  const engine = EngineeringOS.getInstance();
  let totalViolations = 0;

  // INITIAL CLEANUP
  engine.resetSystem();

  // CYCLE 1: PROJECT A
  console.log('\n--- CYCLE 1: PROJECT A ---');
  contaminate(FINGERPRINT_A);
  engine.resetSystem();
  totalViolations += verifyCleanSlate();

  // CYCLE 2: PROJECT B
  console.log('\n--- CYCLE 2: PROJECT B ---');
  contaminate(FINGERPRINT_B);
  totalViolations += verifyIsolation(FINGERPRINT_B, FINGERPRINT_A);
  engine.resetSystem();
  totalViolations += verifyCleanSlate();

  // CYCLE 3: PROJECT A (Re-contamination)
  console.log('\n--- CYCLE 3: PROJECT A (Re-contamination) ---');
  contaminate(FINGERPRINT_A);
  totalViolations += verifyIsolation(FINGERPRINT_A, FINGERPRINT_B);
  engine.resetSystem();
  totalViolations += verifyCleanSlate();

  // CYCLE 4: PROJECT B (Re-contamination)
  console.log('\n--- CYCLE 4: PROJECT B (Re-contamination) ---');
  contaminate(FINGERPRINT_B);
  totalViolations += verifyIsolation(FINGERPRINT_B, FINGERPRINT_A);
  engine.resetSystem();
  totalViolations += verifyCleanSlate();

  console.log('\n====================================================================================================');
  if (totalViolations === 0) {
    console.log('[POST-UX-005 VERDICT]: [ PASS ] REPEATABLE MULTI-CYCLE ISOLATION PROVEN.');
  } else {
    console.log(`[POST-UX-005 VERDICT]: [ FAIL ] DETECTED ${totalViolations} VIOLATIONS DURING CYCLIC ISOLATION.`);
    process.exit(1);
  }
  console.log('====================================================================================================');
}

runMultiCycleStressTest().catch(err => {
  console.error(err);
  process.exit(1);
});
