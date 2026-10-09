import { describe, it, expect } from 'vitest';
import { RevisionImpactAnalyzer } from '../../../src/engine/revision/RevisionImpactAnalyzer';
import { Revision, RevisionEntityType, RevisionLifecycleState } from '../../../src/engine/revision/types';

describe('RevisionImpactAnalyzer Isolated Proofs', () => {

  const createBasePart = (id: string, revId: string, code: string): Revision => ({
    revisionId: revId,
    entityId: id,
    entityType: RevisionEntityType.PART,
    revisionCode: code,
    revisionNumber: 1,
    lifecycleState: RevisionLifecycleState.RELEASED,
    createdAt: new Date().toISOString(),
    createdBy: 'ENGINEER-01',
    effectivity: [],
    configurationScope: [],
    contentHash: 'hash-1',
    dependencyHash: 'dep-hash-1',
    revisionHash: 'rev-hash-1',
    dependencies: [],
    approvals: [],
    content: {}
  });

  it('REV-01: Downstream entity depends on R1, R2 supersedes R1 -> Impact identified', () => {
    const partR1 = createBasePart('PART-01', 'REV-PART-01-R1', 'A');
    const partR2: Revision = {
      ...createBasePart('PART-01', 'REV-PART-01-R2', 'B'),
      parentRevisionId: 'REV-PART-01-R1',
      supersedesRevisionId: 'REV-PART-01-R1'
    };

    const drawing: Revision = {
      ...createBasePart('DRW-01', 'REV-DRW-01-R1', '01'),
      entityType: RevisionEntityType.DRAWING,
      dependencies: [{ entityId: 'PART-01', revisionId: 'REV-PART-01-R1' }]
    };

    const allRevisions = [partR1, partR2, drawing];
    const impact = RevisionImpactAnalyzer.analyzeImpact(partR2, allRevisions);

    expect(impact).toHaveLength(1);
    expect(impact[0].entityId).toBe('DRW-01');
    expect(impact[0].status).toBe('STALE');
    expect(impact[0].severity).toBe('HIGH');
  });

  it('REV-02: Downstream entity depends directly on R2 -> Impact identified', () => {
    const partR2 = createBasePart('PART-02', 'REV-PART-02-R2', 'B');
    const fem: Revision = {
      ...createBasePart('FEM-02', 'REV-FEM-02-R1', '01'),
      entityType: RevisionEntityType.FEM_STUDY,
      dependencies: [{ entityId: 'PART-02', revisionId: 'REV-PART-02-R2' }]
    };

    const allRevisions = [partR2, fem];
    const impact = RevisionImpactAnalyzer.analyzeImpact(partR2, allRevisions);

    expect(impact).toHaveLength(1);
    expect(impact[0].entityId).toBe('FEM-02');
    expect(impact[0].status).toBe('STALE');
    expect(impact[0].severity).toBe('CRITICAL');
  });

  it('REV-03: LATEST dependency is impacted when applicable', () => {
    const partR2 = createBasePart('PART-03', 'REV-PART-03-R2', 'B');
    const cam: Revision = {
      ...createBasePart('CAM-03', 'REV-CAM-03-R1', '01'),
      entityType: RevisionEntityType.CAM_JOB,
      dependencies: [{ entityId: 'PART-03', revisionId: 'LATEST' }]
    };

    const allRevisions = [partR2, cam];
    const impact = RevisionImpactAnalyzer.analyzeImpact(partR2, allRevisions);

    expect(impact).toHaveLength(1);
    expect(impact[0].entityId).toBe('CAM-03');
    expect(impact[0].status).toBe('STALE');
  });

  it('REV-04: Floating dependency is impacted when applicable', () => {
    const partR2 = createBasePart('PART-04', 'REV-PART-04-R2', 'B');
    const assy: Revision = {
      ...createBasePart('ASY-04', 'REV-ASY-04-R1', '01'),
      entityType: RevisionEntityType.ASSEMBLY,
      dependencies: [{ entityId: 'PART-04', revisionId: 'SOME-OLD-REV', isFloating: true }]
    };

    const allRevisions = [partR2, assy];
    const impact = RevisionImpactAnalyzer.analyzeImpact(partR2, allRevisions);

    expect(impact).toHaveLength(1);
    expect(impact[0].entityId).toBe('ASY-04');
    expect(impact[0].status).toBe('AFFECTED');
  });

  it('REV-05: Unrelated entity is NOT impacted', () => {
    const partTarget = createBasePart('PART-05-A', 'REV-PART-05-A-R2', 'B');
    const unrelatedDrawing: Revision = {
      ...createBasePart('DRW-05-B', 'REV-DRW-05-B-R1', '01'),
      entityType: RevisionEntityType.DRAWING,
      dependencies: [{ entityId: 'PART-05-C', revisionId: 'REV-PART-05-C-R1' }]
    };

    const allRevisions = [partTarget, unrelatedDrawing];
    const impact = RevisionImpactAnalyzer.analyzeImpact(partTarget, allRevisions);

    expect(impact).toHaveLength(0);
  });

  it('REV-06: Dependency on an unrelated revision of the same entity is not falsely invalidated', () => {
    const partR2 = createBasePart('PART-06', 'REV-PART-06-R2', 'B');
    partR2.parentRevisionId = 'REV-PART-06-R1';

    const fixedDrawing: Revision = {
      ...createBasePart('DRW-06', 'REV-DRW-06-R1', '01'),
      entityType: RevisionEntityType.DRAWING,
      dependencies: [{ entityId: 'PART-06', revisionId: 'REV-PART-06-R0-ARCHIVED' }]
    };

    const allRevisions = [partR2, fixedDrawing];
    const impact = RevisionImpactAnalyzer.analyzeImpact(partR2, allRevisions);

    expect(impact).toHaveLength(0);
  });

  it('REV-07: Multi-path dependency produces exactly one impact entry', () => {
    const partA = createBasePart('PART-07-A', 'REV-PART-07-A-R2', 'B');
    partA.parentRevisionId = 'REV-PART-07-A-R1';

    const partB = createBasePart('PART-07-B', 'REV-PART-07-B-R2', 'B');
    partB.parentRevisionId = 'REV-PART-07-B-R1';

    // ASSEMBLY depends on both
    const assembly: Revision = {
      ...createBasePart('ASY-07', 'REV-ASY-07-R1', '01'),
      entityType: RevisionEntityType.ASSEMBLY,
      dependencies: [
        { entityId: 'PART-07-A', revisionId: 'REV-PART-07-A-R1' },
        { entityId: 'PART-07-B', revisionId: 'REV-PART-07-B-R1' }
      ]
    };

    // If we analyze impact of changing both (e.g. in a batch or sequential)
    // Actually analyzeImpact takes one changedRev.
    // Let's test if multiple changes in the graph correctly consolidate.
    // For a single call with partA as trigger:
    const impact = RevisionImpactAnalyzer.analyzeImpact(partA, [partA, partB, assembly]);
    expect(impact).toHaveLength(1);
    expect(impact[0].entityId).toBe('ASY-07');
  });

  it('REV-08: Impact analysis remains deterministic', () => {
    const partR1 = createBasePart('PART-08', 'REV-PART-08-R1', 'A');
    const partR2: Revision = {
      ...createBasePart('PART-08', 'REV-PART-08-R2', 'B'),
      parentRevisionId: 'REV-PART-08-R1'
    };
    const drawing: Revision = {
      ...createBasePart('DRW-08', 'REV-DRW-08-R1', '01'),
      entityType: RevisionEntityType.DRAWING,
      dependencies: [{ entityId: 'PART-08', revisionId: 'REV-PART-08-R1' }]
    };

    const allRevisions = [partR1, partR2, drawing];
    
    const run1 = RevisionImpactAnalyzer.analyzeImpact(partR2, allRevisions);
    const run2 = RevisionImpactAnalyzer.analyzeImpact(partR2, allRevisions);
    
    expect(run1).toEqual(run2);
    expect(run1).toHaveLength(1);
  });

  it('REV-09: Cascading impact (PART -> ASSEMBLY -> DRAWING)', () => {
    const partR2 = createBasePart('PART-09', 'REV-PART-09-R2', 'B');
    partR2.parentRevisionId = 'REV-PART-09-R1';

    const assembly: Revision = {
      ...createBasePart('ASY-09', 'REV-ASY-09-R1', '01'),
      entityType: RevisionEntityType.ASSEMBLY,
      dependencies: [{ entityId: 'PART-09', revisionId: 'REV-PART-09-R1' }]
    };

    const drawing: Revision = {
      ...createBasePart('DRW-09', 'REV-DRW-09-R1', '01'),
      entityType: RevisionEntityType.DRAWING,
      dependencies: [{ entityId: 'ASY-09', revisionId: 'REV-ASY-09-R1' }]
    };

    const allRevisions = [partR2, assembly, drawing];
    const impact = RevisionImpactAnalyzer.analyzeImpact(partR2, allRevisions);

    // Should impact both ASSEMBLY and DRAWING
    expect(impact).toHaveLength(2);
    const entityIds = impact.map(i => i.entityId);
    expect(entityIds).toContain('ASY-09');
    expect(entityIds).toContain('DRW-09');
  });

});
