import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';
import { DocumentEvaluator } from '../../../engine/cad-kernel/document/DocumentEvaluator';
import { EngineeringPLMEngine } from '../../../engine/plm/EngineeringPLMEngine';
import { CanonicalPLMProjectionAdapter } from '../../../engine/plm/CanonicalPLMProjectionAdapter';
import { InMemoryDocumentResolver } from '../../../engine/cad-kernel/document/DocumentResolver';

describe('PATCH-040 — Lifecycle & Release Safety Forensic', () => {
  let resolver: InMemoryDocumentResolver;

  beforeEach(() => {
    EngineeringPLMEngine.clear();
    resolver = new InMemoryDocumentResolver();
  });

  function createPartDoc(id: string, dim: number): EngineeringDocument {
    const doc = DocumentEvaluator.createDocument({
      documentId: id,
      parameters: [
        { id: 'dim', name: 'Dimension', value: dim, expression: String(dim), type: 'LENGTH' }
      ]
    });
    doc.type = 'PART';
    doc.revision = 1;
    doc.topologyMap = { version: 1, faceMap: { [`${id}/F1`]: { persistentId: `${id}/F1`, type: 'FACE', parentPersistentIds: [] } } };
    doc.derived = { bRepHash: `HASH-${id}-REV${doc.revision}-${dim}` };
    return doc;
  }

  function createAssemblyDoc(id: string, children: string[]): EngineeringDocument {
    const doc = DocumentEvaluator.createDocument({ documentId: id });
    doc.type = 'ASSEMBLY';
    doc.revision = 1;
    doc.assembly = {
      instances: children.map((childId, idx) => ({
        instanceId: `inst-${childId}-${idx}`,
        documentId: childId,
        revision: 'REV-A',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }
      })),
      mates: []
    };
    doc.derived = { bRepHash: `HASH-${id}-REV${doc.revision}` };
    return doc;
  }

  function setupBOM(): void {
    const bomArt = {
      artifactId: 'ART-DOC_BOM',
      documentId: 'DOC_BOM',
      name: 'BOM Artifact',
      revision: 'REV-A',
      version: 1,
      type: 'BOM' as const,
      status: 'VALID' as const,
      geometryHash: 'HASH-BOM',
      topologyHash: 'TOP-BOM',
      dependencyHash: 'DEP-BOM',
      childDependencies: [],
      createdBy: 'SYS',
      createdAt: '',
      metadata: {}
    };
    EngineeringPLMEngine.registerArtifact(bomArt);
  }

  /**
   * PHASE 8 — STALE RELEASE ADVERSARIAL TEST
   */
  it('PHASE 8: should block release of stale ROOT-ASSEMBLY when child is mutated', () => {
    // 1. Setup REV-A hierarchy
    const partA = createPartDoc('DOC_PART_A', 50);
    const subAsm = createAssemblyDoc('DOC_SUB', ['DOC_PART_A']);
    const rootAsm = createAssemblyDoc('DOC_ROOT', ['DOC_SUB']);

    resolver.register(partA);
    resolver.register(subAsm);
    setupBOM();

    // Initial evaluation and registration
    DocumentEvaluator.evaluate(partA, { context: { resolver } });
    DocumentEvaluator.evaluate(subAsm, { context: { resolver } });
    DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });

    expect(EngineeringPLMEngine.getArtifact('ART-DOC_PART_A', 'REV-A')!.status).toBe('VALID');
    expect(EngineeringPLMEngine.getArtifact('ART-DOC_SUB', 'REV-A')!.status).toBe('VALID');
    expect(EngineeringPLMEngine.getArtifact('ART-DOC_ROOT', 'REV-A')!.status).toBe('VALID');

    // Setup ECO
    EngineeringPLMEngine.createECO({
      ecoId: 'ECO-040', title: 'Release 040', description: '', reason: '', author: 'Eng', createdAt: '',
      status: 'OPEN', affectedArtifacts: ['ART-DOC_PART_A', 'ART-DOC_SUB', 'ART-DOC_ROOT'], changeRequests: [],
      validationGates: [], approvalStatus: 'PENDING'
    });
    EngineeringPLMEngine.approveECO('ECO-040', 'Manager');

    // 6. Mutate PART-A
    partA.revision = 2;
    partA.derived!.bRepHash = `HASH-DOC_PART_A-REV2-50`;
    resolver.register(partA);
    DocumentEvaluator.evaluate(partA, { context: { resolver } });

    // 7. Verify recursive invalidation
    expect(EngineeringPLMEngine.getArtifact('ART-DOC_PART_A', 'REV-A')!.status).toBe('SUPERSEDED'); // REV-A is now old
    expect(EngineeringPLMEngine.getArtifact('ART-DOC_PART_A', 'REV-B')!.status).toBe('VALID');
    expect(EngineeringPLMEngine.getArtifact('ART-DOC_SUB', 'REV-A')!.status).toBe('OUTDATED');
    expect(EngineeringPLMEngine.getArtifact('ART-DOC_ROOT', 'REV-A')!.status).toBe('OUTDATED');

    // Re-evaluate ROOT-ASSEMBLY to REV-A (this is the attack: resetting status to VALID while child is OUTDATED)
    DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });
    expect(EngineeringPLMEngine.getArtifact('ART-DOC_ROOT', 'REV-A')!.status).toBe('VALID');

    // 8. Attempt to release stale ROOT-ASSEMBLY REV-A
    // This should fail because its dependency PART-A REV-A is SUPERSEDED.
    expect(() => EngineeringPLMEngine.generateReleaseManifest('PRD-1', 'Product', 'ECO-040'))
      .toThrow(/Release Blocked/);
  });

  /**
   * PHASE 9 — REVALIDATION CONTROL
   */
  it('PHASE 9: should allow release after full re-evaluation into new revisions', () => {
    const partA = createPartDoc('DOC_PART_A', 50);
    const subAsm = createAssemblyDoc('DOC_SUB', ['DOC_PART_A']);
    const rootAsm = createAssemblyDoc('DOC_ROOT', ['DOC_SUB']);

    resolver.register(partA);
    resolver.register(subAsm);
    setupBOM();

    DocumentEvaluator.evaluate(partA, { context: { resolver } });
    DocumentEvaluator.evaluate(subAsm, { context: { resolver } });
    DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });

    // Mutate
    partA.revision = 2;
    partA.derived!.bRepHash = `HASH-DOC_PART_A-REV2-50`;
    resolver.register(partA);
    DocumentEvaluator.evaluate(partA, { context: { resolver } });

    // Re-evaluate SUB-ASSEMBLY to REV-B
    subAsm.revision = 2;
    subAsm.derived!.bRepHash = `HASH-DOC_SUB-REV2`;
    // Update instance reference to point to REV-B of Part A
    subAsm.assembly!.instances[0].revision = 'REV-B';
    resolver.register(subAsm);
    DocumentEvaluator.evaluate(subAsm, { context: { resolver } });

    // Re-evaluate ROOT-ASSEMBLY to REV-B
    rootAsm.revision = 2;
    rootAsm.derived!.bRepHash = `HASH-DOC_ROOT-REV2`;
    rootAsm.assembly!.instances[0].revision = 'REV-B';
    resolver.register(rootAsm);
    DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });

    expect(EngineeringPLMEngine.getArtifact('ART-DOC_PART_A', 'REV-B')!.status).toBe('VALID');
    expect(EngineeringPLMEngine.getArtifact('ART-DOC_SUB', 'REV-B')!.status).toBe('VALID');
    expect(EngineeringPLMEngine.getArtifact('ART-DOC_ROOT', 'REV-B')!.status).toBe('VALID');

    // Setup ECO for REV-B
    EngineeringPLMEngine.createECO({
      ecoId: 'ECO-040-B', title: 'Release 040 B', description: '', reason: '', author: 'Eng', createdAt: '',
      status: 'OPEN', affectedArtifacts: ['ART-DOC_PART_A', 'ART-DOC_SUB', 'ART-DOC_ROOT'], changeRequests: [],
      validationGates: [], approvalStatus: 'PENDING'
    });
    EngineeringPLMEngine.approveECO('ECO-040-B', 'Manager');

    const manifest = EngineeringPLMEngine.generateReleaseManifest('PRD-1', 'Product', 'ECO-040-B');
    expect(manifest.revisions.cadRevision).toBe('REV-B');
    expect(manifest.revisions.assemblyRevision).toBe('REV-B');
  });

  /**
   * PHASE 10 — REVISION ISOLATION
   */
  it('PHASE 10: should maintain historical REV-A immutability', () => {
    const partA = createPartDoc('DOC_PART_A', 50);
    resolver.register(partA);
    DocumentEvaluator.evaluate(partA);
    
    const artA1 = EngineeringPLMEngine.getArtifact('ART-DOC_PART_A', 'REV-A');
    if (!artA1) throw new Error('Artifact artA1 not found');
    const geoHash1 = artA1.geometryHash;

    // Mutation: Change Part A to 100mm (REV-B)
    if (!partA.parameters) throw new Error('partA.parameters missing');
    const partA_REV2: EngineeringDocument = {
      ...partA,
      revision: 2,
      parameters: [
        { ...partA.parameters[0], value: 100 }
      ],
      derived: {
        bRepHash: `HASH-DOC_PART_A-REV2-100`
      }
    };
    resolver.register(partA_REV2);
    DocumentEvaluator.evaluate(partA_REV2);

    const artA2 = EngineeringPLMEngine.getArtifact('ART-DOC_PART_A', 'REV-B');
    if (!artA2) throw new Error('Artifact artA2 not found');
    expect(artA2.geometryHash).toBe('HASH-DOC_PART_A-REV2-100');
    expect(artA2.geometryHash).not.toBe(geoHash1);

    // Re-verify REV-A is still there and unchanged (except status)
    const artA1_check = EngineeringPLMEngine.getArtifact('ART-DOC_PART_A', 'REV-A')!;
    expect(artA1_check.geometryHash).toBe(geoHash1);
    expect(artA1_check.status).toBe('SUPERSEDED');
  });
});
