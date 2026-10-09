
import { EvidenceBus314 } from '../engine/engineering_ai/copilot/EvidenceBus314';
import { EngineeringEvidenceLedger } from '../engine/evidence/ledger/EngineeringEvidenceLedger';
import { EngineeringTruthEngine } from '../engine/kernel/EngineeringTruthEngine';
import { InvalidationEngine } from '../engine/kernel/InvalidationEngine';
import { StateSyncEngine } from '../engine/sync/StateSyncEngine';
import { WorkbenchStateOwnershipEngine } from '../engine/workbench/WorkbenchStateOwnershipEngine';
import { ProjectSessionManager } from '../engine/session/ProjectSession';
import { EngineeringOS } from '../engine/kernel/EngineeringOS';
import { EngineeringObjectStatus } from '../engine/kernel/types';

async function runSingletonLeakageAudit() {
  console.log('====================================================================================================');
  console.log('    POST-UX-005 — CROSS-SINGLETON STATE PERSISTENCE & LEAKAGE FORENSIC AUDIT                       ');
  console.log('====================================================================================================');

  // [1/4] CONTAMINATING PROJECT A STATE
  console.log('[1/4] CONTAMINATING SINGLETONS WITH PROJECT A (Drone Assembly) STATE...');
  
  const evidenceBus = EvidenceBus314.getInstance();
  evidenceBus.registerEvidence('Project-A-Source', { info: 'Sensitive Drone Data' }, 'REV-A', 'SENSITIVE_SPECS');

  const ledger = EngineeringEvidenceLedger.getInstance();
  ledger.registerEvidence({
    evidenceType: 'MANUFACTURING_TOLERANCE',
    engineeringObjectId: 'OBJ-DRONE-FRAME',
    objectRevision: 'REV-A',
    projectId: 'demo-industrial-drone',
    organizationId: 'SECP_ORG',
    producerIdentity: 'DRONE_SCANNER_01',
    producerType: 'SYSTEM',
    sourceSystem: 'METROLOGY_STATION_A',
    sourceVersion: '1.0.0',
    payload: { tolerance: 0.001 }
  });

  const truthEngine = EngineeringTruthEngine.getInstance();
  truthEngine.registerObject({
    id: 'OBJ-DRONE-SECRET-PART',
    name: 'Top Secret Propulsion Mount',
    domain: 'PART',
    status: EngineeringObjectStatus.STABLE,
    revision: { 
      id: 'REV-A', 
      timestamp: new Date().toISOString(), 
      author: 'ADMIN', 
      hash: 'SHA256-SECRET',
      comment: 'Initial contaminated state' 
    },
    provenance: { sourceId: 'NATIVE', sourceDomain: 'CAD', transformType: 'INITIAL_CREATION', timestamp: new Date().toISOString(), runtimeVersion: '1.0' },
    simulationResultIds: [],
    evidenceIds: [],
    isCertified: true,
    metadata: { weight: '500g' }
  });

  const syncEngine = StateSyncEngine.getInstance();
  // We can't easily register a full doc here without complex mocking, but we can check if it holds metadata
  
  const ownershipEngine = WorkbenchStateOwnershipEngine.getInstance();
  ownershipEngine.registerWorkbench('DRONE_WORKBENCH', [{ name: 'SecretPropulsionState', category: 'SESSION' }]);

  console.log('  ✓ Singletons Contaminated with Project A State.');

  // [2/4] EXECUTING AUTHORITATIVE PRODUCTION RESET
  console.log('[2/4] EXECUTING AUTHORITATIVE PRODUCTION RESET (via EngineeringOS.resetSystem)...');
  EngineeringOS.getInstance().resetSystem();
  // Also get the clean UI state for the test log
  const cleanState = ProjectSessionManager.getCleanSessionState();
  console.log('  ✓ System Singletons & UI/Session State Cleared.');

  // [3/4] SEARCHING FOR RESIDUAL PROJECT A DATA IN SINGLETONS
  console.log('[3/4] SEARCHING FOR RESIDUAL PROJECT A DATA IN SINGLETONS...');
  
  let leakageCount = 0;

  const residualEvidence = evidenceBus.queryEvidence({ source: 'Project-A-Source' });
  if (residualEvidence.length > 0) {
    console.log(`  [LEAK] EvidenceBus314: Found ${residualEvidence.length} records from Project A!`);
    leakageCount++;
  }

  const residualLedger = ledger.getEntries().filter(e => e.record.projectId === 'demo-industrial-drone');
  if (residualLedger.length > 0) {
    console.log(`  [LEAK] EngineeringEvidenceLedger: Found ${residualLedger.length} entries from Project A!`);
    leakageCount++;
  }

  const residualTruth = truthEngine.getObject('OBJ-DRONE-SECRET-PART');
  if (residualTruth) {
    console.log(`  [LEAK] EngineeringTruthEngine: Found EngineeringObject "OBJ-DRONE-SECRET-PART" from Project A!`);
    leakageCount++;
  }

  const workbenchReport = ownershipEngine.auditWorkbench('DRONE_WORKBENCH');
  if (workbenchReport.registeredEntities.length > 0) {
    console.log(`  [LEAK] WorkbenchStateOwnershipEngine: Workbench "DRONE_WORKBENCH" from Project A still exists!`);
    leakageCount++;
  }

  // [4/4] FINAL VERDICT
  console.log('====================================================================================================');
  if (leakageCount === 0) {
    console.log('[POST-UX-005 VERDICT]: [ PASS ] Singletons are Project-Isolated.');
  } else {
    console.log(`[POST-UX-005 VERDICT]: [ FAIL ] CRITICAL LEAKAGE DETECTED! Found ${leakageCount} persistent state leaks.`);
    console.log('Singletons bypass the standard Reset mechanism.');
  }
  console.log('====================================================================================================');

  if (leakageCount > 0) {
    process.exit(1);
  }
}

runSingletonLeakageAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
