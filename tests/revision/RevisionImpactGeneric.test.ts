import { describe, it, expect } from 'vitest';
import { RevisionImpactAnalyzer, ImpactedItem } from '../../src/engine/revision/RevisionImpactAnalyzer';
import { Revision, RevisionEntityType, RevisionLifecycleState } from '../../src/engine/revision/types';

describe('RevisionImpactAnalyzer — Generic Engineering Logic Proof', () => {

  const createRev = (params: { 
    id: string, 
    entity: string, 
    code: string, 
    parent?: string, 
    deps?: any[],
    type?: RevisionEntityType 
  }): Revision => ({
    revisionId: params.id,
    entityId: params.entity,
    entityType: params.type || RevisionEntityType.PART,
    revisionCode: params.code,
    revisionNumber: 1,
    parentRevisionId: params.parent,
    lifecycleState: RevisionLifecycleState.RELEASED,
    createdAt: new Date().toISOString(),
    createdBy: 'AUTHORITY',
    effectivity: [],
    configurationScope: ['DEFAULT'],
    contentHash: 'hash',
    dependencyHash: 'dep-hash',
    revisionHash: 'rev-hash',
    content: {},
    dependencies: params.deps || []
  } as any);

  // REV-01: Downstream entity depends on R1. R2 supersedes R1. Impact(R2) identifies the downstream entity.
  it('REV-01: Correctly identifies impact on entity depending on superseded parent revision', () => {
    const r1 = createRev({ id: 'R1', entity: 'BASE_CORE', code: 'A' });
    const r2 = createRev({ id: 'R2', entity: 'BASE_CORE', code: 'B', parent: 'R1' });
    const downstream = createRev({ 
      id: 'D1', 
      entity: 'WIDGET', 
      code: '1', 
      deps: [{ entityId: 'BASE_CORE', revisionId: 'R1', isFloating: false }] 
    });

    const impact = RevisionImpactAnalyzer.analyzeImpact(r2, [r1, r2, downstream]);
    
    expect(impact.map(i => i.entityId)).toContain('WIDGET');
    expect(impact.find(i => i.entityId === 'WIDGET')?.reason).toContain('Downstream dependency on BASE_CORE');
  });

  // REV-02: Downstream entity depends directly on R2. Impact(R2) behaves correctly.
  it('REV-02: Correctly identifies impact when depending directly on new revision', () => {
    const r2 = createRev({ id: 'R2', entity: 'BASE_CORE', code: 'B' });
    const downstream = createRev({ 
      id: 'D1', 
      entity: 'WIDGET', 
      code: '1', 
      deps: [{ entityId: 'BASE_CORE', revisionId: 'R2', isFloating: false }] 
    });

    const impact = RevisionImpactAnalyzer.analyzeImpact(r2, [r2, downstream]);
    expect(impact.map(i => i.entityId)).toContain('WIDGET');
  });

  // REV-03: LATEST dependency is impacted when applicable.
  it('REV-03: Correctly identifies impact for LATEST dependency', () => {
    const r2 = createRev({ id: 'R2', entity: 'BASE_CORE', code: 'B' });
    const downstream = createRev({ 
      id: 'D1', 
      entity: 'WIDGET', 
      code: '1', 
      deps: [{ entityId: 'BASE_CORE', revisionId: 'LATEST', isFloating: false }] 
    });

    const impact = RevisionImpactAnalyzer.analyzeImpact(r2, [r2, downstream]);
    expect(impact.map(i => i.entityId)).toContain('WIDGET');
  });

  // REV-04: Floating dependency is impacted when applicable.
  it('REV-04: Correctly identifies impact for Floating dependency', () => {
    const r2 = createRev({ id: 'R2', entity: 'BASE_CORE', code: 'B' });
    const downstream = createRev({ 
      id: 'D1', 
      entity: 'WIDGET', 
      code: '1', 
      deps: [{ entityId: 'BASE_CORE', revisionId: 'R_OLD', isFloating: true }] 
    });

    const impact = RevisionImpactAnalyzer.analyzeImpact(r2, [r2, downstream]);
    expect(impact.map(i => i.entityId)).toContain('WIDGET');
  });

  // REV-05: Unrelated entity is NOT impacted.
  it('REV-05: Does not impact unrelated entities', () => {
    const r2 = createRev({ id: 'R2', entity: 'BASE_CORE', code: 'B' });
    const unrelated = createRev({ 
      id: 'U1', 
      entity: 'OTHERS', 
      code: '1', 
      deps: [{ entityId: 'DIFFERENT_TARGET', revisionId: 'R2', isFloating: false }] 
    });

    const impact = RevisionImpactAnalyzer.analyzeImpact(r2, [r2, unrelated]);
    expect(impact.map(i => i.entityId)).not.toContain('OTHERS');
  });

  // REV-06: Dependency on an unrelated revision of the same domain/entity is not falsely invalidated.
  it('REV-06: Does not impact entities depending on different branches/unrelated revisions', () => {
    const r2 = createRev({ id: 'R2', entity: 'BASE_CORE', code: 'B', parent: 'R1' });
    const downstreamOfBranch = createRev({ 
      id: 'DB1', 
      entity: 'WIDGET', 
      code: '1', 
      deps: [{ entityId: 'BASE_CORE', revisionId: 'R_BRANCH_SIDE', isFloating: false }] 
    });

    const impact = RevisionImpactAnalyzer.analyzeImpact(r2, [r2, downstreamOfBranch]);
    expect(impact.map(i => i.entityId)).not.toContain('WIDGET');
  });

  // REV-07: No duplicate impact entries.
  it('REV-07: Does not produce duplicate impact entries for multi-path dependencies', () => {
    const r1 = createRev({ id: 'R1', entity: 'BASE' });
    const r2 = createRev({ id: 'R2', entity: 'BASE', parent: 'R1' });
    const mid1 = createRev({ id: 'M1', entity: 'MID1', deps: [{ entityId: 'BASE', revisionId: 'R1' }] });
    const mid2 = createRev({ id: 'M2', entity: 'MID2', deps: [{ entityId: 'BASE', revisionId: 'R1' }] });
    const final = createRev({ id: 'F1', entity: 'FINAL', deps: [
      { entityId: 'MID1', revisionId: 'M1' },
      { entityId: 'MID2', revisionId: 'M2' }
    ]});

    const impact = RevisionImpactAnalyzer.analyzeImpact(r2, [r1, r2, mid1, mid2, final]);
    const finalImpacts = impact.filter(i => i.entityId === 'FINAL');
    expect(finalImpacts.length).toBe(1);
  });

  // REV-08: Impact analysis remains deterministic.
  it('REV-08: Maintains deterministic results across multiple runs', () => {
    const r1 = createRev({ id: 'R1', entity: 'BASE' });
    const r2 = createRev({ id: 'R2', entity: 'BASE', parent: 'R1' });
    const downstream = createRev({ id: 'D1', entity: 'WIDGET', deps: [{ entityId: 'BASE', revisionId: 'R1' }] });
    
    const run1 = RevisionImpactAnalyzer.analyzeImpact(r2, [r1, r2, downstream]);
    const run2 = RevisionImpactAnalyzer.analyzeImpact(r2, [r1, r2, downstream]);
    
    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });
});
