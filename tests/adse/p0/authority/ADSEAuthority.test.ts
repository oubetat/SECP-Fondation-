import { describe, it, expect } from 'vitest';
import { CoreExecutionAuthority } from '../../../../src/engine/execution/CoreExecutionAuthority';
import { RevisionEngine } from '../../../../src/engine/revision/RevisionEngine';

describe('ADSE-P0 Authority Suite', () => {
  it('enforces SECP Core Execution Authority over plugin solver dispatch', async () => {
    const revEngine = new RevisionEngine();
    CoreExecutionAuthority.initialize(revEngine);

    // Create active revision
    const rev = revEngine.createRevision({
      revisionId: 'OBJ-001:REV-A',
      entityId: 'OBJ-001',
      entityType: 'PART',
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: 'RELEASED' as any,
      createdAt: new Date().toISOString(),
      createdBy: 'Engineer',
      effectivity: [],
      configurationScope: [],
      dependencies: [],
      approvals: [],
      comments: [],
      validationState: 'UNPROVEN',
      evidenceReferences: [],
      contentHash: 'hash',
      dependencyHash: 'hash',
      revisionHash: '',
      content: {},
      snapshot: { geometryState: { geometryHash: 'geom-hash' } }
    });

    const envelope = await CoreExecutionAuthority.execute({
      pluginId: 'secp-plugin-aerospace',
      pluginVersion: '1.4.0',
      engineeringObjectId: 'OBJ-001',
      revisionId: rev.revisionId,
      executionKind: 'mach-flow',
      parameters: { altitudeM: 10000, velocityMs: 300 }
    });

    expect(envelope.executionId).toBeDefined();
    expect(envelope.state).toBe('SEALED');
    expect(envelope.evidenceLeaf).toBeDefined();
  });

  it('rejects execution requests for unauthorized plugins', async () => {
    await expect(CoreExecutionAuthority.execute({
      pluginId: 'unauthorized-fake-plugin',
      pluginVersion: '1.0.0',
      engineeringObjectId: 'OBJ-001',
      executionKind: 'mach-flow',
      parameters: {}
    })).rejects.toThrow();
  });
});
