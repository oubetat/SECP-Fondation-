import { RevisionEngine } from './RevisionEngine';
import { RevisionCanonicalizer } from './RevisionCanonicalizer';
import { RevisionDiffEngine } from './RevisionDiffEngine';
import { Revision, RevisionLifecycleState, RevisionEntityType, EffectivityType } from './types';

export class HardAcceptanceGate115 {
  public static evaluate(): { passed: boolean; checks: any[] } {
    const checks = [];
    const engine = new RevisionEngine();

    // 1. Creation and Identity
    const rev1: Revision = {
      revisionId: 'P-001:R1',
      entityId: 'P-001',
      entityType: RevisionEntityType.PART,
      revisionCode: 'R1',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdAt: new Date().toISOString(),
      createdBy: 'USER1',
      effectivity: [],
      configurationScope: [],
      dependencies: [],
      approvals: [],
      content: { geometryHash: 'ABC', parameters: { length: 10 } },
      contentHash: '',
      dependencyHash: '',
      revisionHash: ''
    };

    const created = engine.createRevision(rev1);
    checks.push({
      checkId: 'GATE-115-01',
      name: 'Definition / Revision separation & Identity',
      passed: created.revisionId === 'P-001:R1' && created.contentHash.length === 64,
      details: 'Revision created with stable identity and hashes'
    });

    // 2. Diff Engine (Geometry / Parameter changes)
    const rev2 = JSON.parse(JSON.stringify(created)) as Revision;
    rev2.revisionId = 'P-001:R2';
    rev2.revisionCode = 'R2';
    rev2.revisionNumber = 2;
    rev2.content.parameters.length = 20; // Parameter change
    rev2.contentHash = RevisionCanonicalizer.computeContentHash(rev2.content);
    rev2.revisionHash = RevisionCanonicalizer.computeRevisionHash(rev2);
    
    const diff = RevisionDiffEngine.compare(created, rev2);
    checks.push({
      checkId: 'GATE-115-02',
      name: 'Semantic Revision Diff Engine',
      passed: diff.differences.includes('PARAMETER_CHANGED'),
      details: 'Detected PARAMETER_CHANGED accurately'
    });

    // 3. Legal Transition & Approval Model
    engine.addApproval('P-001:R1', {
      approvalId: 'APP-1',
      revisionId: 'P-001:R1',
      role: 'ENGINEER',
      actorId: 'USER2',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Looks good'
    });
    
    engine.transitionState('P-001:R1', RevisionLifecycleState.IN_WORK, 'USER1', 'Start work');
    engine.transitionState('P-001:R1', RevisionLifecycleState.UNDER_REVIEW, 'USER1', 'Review');
    const released = engine.transitionState('P-001:R1', RevisionLifecycleState.RELEASED, 'USER2', 'Release');

    checks.push({
      checkId: 'GATE-115-03',
      name: 'Lifecycle state machine & Legal Transition',
      passed: released.lifecycleState === RevisionLifecycleState.RELEASED,
      details: 'Transitioned to RELEASED legally'
    });

    // 4. Immutable Released Revision
    let immutablePassed = false;
    try {
      engine.updateContent('P-001:R1', { geometryHash: 'XYZ' }, 'USER1');
    } catch (e: any) {
      if (e.message.includes('IMMUTABLE_REVISION')) {
        immutablePassed = true;
      }
    }
    checks.push({
      checkId: 'GATE-115-04',
      name: 'Immutable Released Revision',
      passed: immutablePassed,
      details: 'Prevented mutation of released revision'
    });

    // 5. Dependency Hash & Tamper Detection
    const revAssembly: Revision = {
      revisionId: 'A-001:R1',
      entityId: 'A-001',
      entityType: RevisionEntityType.ASSEMBLY,
      revisionCode: 'R1',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdAt: new Date().toISOString(),
      createdBy: 'USER1',
      effectivity: [],
      configurationScope: [],
      dependencies: [{ entityId: 'P-001', revisionId: 'P-001:R1' }],
      approvals: [],
      content: { bomId: 'BOM-1' },
      contentHash: '',
      dependencyHash: '',
      revisionHash: ''
    };
    const createdAssy = engine.createRevision(revAssembly);
    const integrityBefore = engine.verifyIntegrity('A-001:R1');
    
    // Tamper dependency
    createdAssy.dependencies[0].revisionId = 'P-001:R2';
    const integrityAfter = engine.verifyIntegrity('A-001:R1');

    checks.push({
      checkId: 'GATE-115-05',
      name: 'Dependency Hash & Tamper Detection',
      passed: integrityBefore.length === 0 && integrityAfter.includes('HASH_MISMATCH_DEPENDENCY'),
      details: 'Tampered dependency was caught by hash verification'
    });

    // 6. Canonical Serialization & Hash Reproducibility
    const hashA = RevisionCanonicalizer.computeRevisionHash(rev2);
    const hashB = RevisionCanonicalizer.computeRevisionHash(JSON.parse(JSON.stringify(rev2)));
    checks.push({
      checkId: 'GATE-115-06',
      name: 'Canonical Serialization & Deterministic Hashing',
      passed: hashA === hashB && hashA.length === 64,
      details: 'Identical content produces identical canonical hash'
    });

    const passed = checks.every(c => c.passed);
    return { passed, checks };
  }
}
