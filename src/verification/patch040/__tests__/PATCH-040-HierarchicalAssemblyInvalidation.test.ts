import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentEvaluator, InMemoryDocumentResolver, DEFAULT_UNIT_SYSTEM_MM } from '../../../engine/cad-kernel/document';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';
import { EngineeringPLMEngine } from '../../../engine/plm/EngineeringPLMEngine';
import { CanonicalPLMProjectionAdapter } from '../../../engine/plm/CanonicalPLMProjectionAdapter';
import { CadGeometryKernel } from '../../../engine/cadKernel';

describe('PATCH-040 — Hierarchical Assembly, Canonical Truth, and Revision Proof', () => {
  let resolver: InMemoryDocumentResolver;

  beforeEach(() => {
    EngineeringPLMEngine.clear();
    resolver = new InMemoryDocumentResolver();
  });

  function createPartDoc(id: string, width = 100): EngineeringDocument {
    const doc = DocumentEvaluator.createDocument({
      documentId: id,
      parameters: [{ id: 'P1', name: 'width', expression: String(width), value: width, unit: 'mm' }]
    });
    doc.type = 'PART';
    doc.metadata = { author: 'TEST_ENGINEER', createdAt: new Date().toISOString() };
    return doc;
  }

  function createAssemblyDoc(id: string, children: string[]): EngineeringDocument {
    const doc = DocumentEvaluator.createDocument({ documentId: id });
    doc.type = 'ASSEMBLY';
    doc.assembly = {
      instances: children.map((cid, i) => ({
        instanceId: `inst-${cid}-${i}`,
        documentId: cid,
        position: { x: i * 200, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }
      })),
      mates: []
    };
    doc.metadata = { author: 'TEST_ENGINEER', createdAt: new Date().toISOString() };
    return doc;
  }

  /**
   * PHASE 2 — REAL HIERARCHICAL ASSEMBLY
   * Construct:
   * ROOT ASSEMBLY (DOC_ROOT)
   * ├── SUB-ASSEMBLY (DOC_SUB)
   * │   ├── PART-A (DOC_PART_A)
   * │   └── PART-B (DOC_PART_B)
   * └── PART-C (DOC_PART_C)
   */
  it('PHASE 2: should construct and evaluate a real hierarchical assembly through canonical paths', () => {
    const partA = createPartDoc('DOC_PART_A', 50);
    const partB = createPartDoc('DOC_PART_B', 80);
    const partC = createPartDoc('DOC_PART_C', 120);
    
    const subAsm = createAssemblyDoc('DOC_SUB', ['DOC_PART_A', 'DOC_PART_B']);
    const rootAsm = createAssemblyDoc('DOC_ROOT', ['DOC_SUB', 'DOC_PART_C']);

    resolver.register(partA);
    resolver.register(partB);
    resolver.register(partC);
    resolver.register(subAsm);

    const result = DocumentEvaluator.evaluate(rootAsm, { generateMesh: true, context: { resolver } });

    expect(result.success).toBe(true);
    expect(result.evaluatedAssembly).toBeDefined();
    
    // Components list should be flattened in the evaluated assembly
    // 1. inst-DOC_SUB-0 (Sub-assembly)
    // 2. inst-DOC_SUB-0/inst-DOC_PART_A-0 (Leaf)
    // 3. inst-DOC_SUB-0/inst-DOC_PART_B-1 (Leaf)
    // 4. inst-DOC_PART_C-1 (Leaf)
    expect(result.evaluatedAssembly!.components.length).toBe(4);

    const compA = result.evaluatedAssembly!.components.find(c => c.documentId === 'DOC_PART_A')!;
    const compB = result.evaluatedAssembly!.components.find(c => c.documentId === 'DOC_PART_B')!;
    const compC = result.evaluatedAssembly!.components.find(c => c.documentId === 'DOC_PART_C')!;

    expect(compA.occurrencePath).toBe('inst-DOC_SUB-0/inst-DOC_PART_A-0');
    expect(compB.occurrencePath).toBe('inst-DOC_SUB-0/inst-DOC_PART_B-1');
    expect(compC.occurrencePath).toBe('inst-DOC_PART_C-1');

    // Verify PLM registration
    const rootArt = EngineeringPLMEngine.getArtifact('ART-DOC_ROOT', 'REV-A');
    expect(rootArt).toBeDefined();
    expect(rootArt!.status).toBe('VALID');

    const subArt = EngineeringPLMEngine.getArtifact('ART-DOC_SUB', 'REV-A');
    expect(subArt).toBeDefined();

    // Verify dependencies
    const rootDeps = EngineeringPLMEngine.getDependencies('ART-DOC_ROOT', 'REV-A');
    expect(rootDeps).toContain('ART-DOC_SUB@REV-A');
    expect(rootDeps).toContain('ART-DOC_PART_C@REV-A');

    const subDeps = EngineeringPLMEngine.getDependencies('ART-DOC_SUB', 'REV-A');
    expect(subDeps).toContain('ART-DOC_PART_A@REV-A');
    expect(subDeps).toContain('ART-DOC_PART_B@REV-A');
  });

  /**
   * PHASE 3 — TOPOLOGY LINEAGE THROUGH HIERARCHY
   * Capture face on PART-A, mutate PART-A, verify rebind in assembly.
   */
  it('PHASE 3: should track topology lineage through hierarchy after parametric mutation', () => {
    const partA = createPartDoc('DOC_PART_A', 50);
    resolver.register(partA);
    
    const rootAsm = createAssemblyDoc('DOC_ROOT', ['DOC_PART_A']);
    
    const res1 = DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });
    const compA1 = res1.evaluatedAssembly!.components[0];
    
    // Pick a face from PART-A
    const partADoc1 = resolver.resolve('DOC_PART_A')!;
    const faceId = Object.keys((partADoc1.topologyMap as any).faceMap!)[0];
    expect((partADoc1.topologyMap as any).faceMap![faceId]).toBeDefined();

    // Mutate PART-A
    partA.revision = 2;
    partA.parameters![0].expression = '100';
    partA.parameters![0].value = 100;
    
    const res2 = DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });
    const partADoc2 = resolver.resolve('DOC_PART_A')!;

    // Verify topology survives through DocumentEvaluator's lineage construction
    expect((partADoc2.topologyMap as any).faceMap![faceId]).toBeDefined();
    
    const evidence2 = res2.document.evidence![res2.document.evidence!.length - 1];
    expect(evidence2.revision).toBe(1); // Root hasn't revised yet, just re-evaluated
  });

  /**
   * PHASE 4 — ASSEMBLY REVISION PROPAGATION
   * Change PART-A, verify parent invalidation and revision requirement.
   */
  it('PHASE 4: should detect stale parent state and propagate revision updates', () => {
    const partA = createPartDoc('DOC_PART_A', 50);
    resolver.register(partA);
    const rootAsm = createAssemblyDoc('DOC_ROOT', ['DOC_PART_A']);
    
    // Initial evaluation
    DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });
    
    const rootArt1 = EngineeringPLMEngine.getArtifact('ART-DOC_ROOT', 'REV-A')!;
    expect(rootArt1.status).toBe('VALID');

    // Mutate Part A and re-evaluate IT directly (or through resolver)
    partA.revision = 2;
    if (!partA.parameters || !partA.parameters[0]) throw new Error("Part A parameters missing");
    partA.parameters[0].value = 100;
    DocumentEvaluator.evaluate(partA);

    // Verify PLM invalidation of root assembly
    const rootArt2 = EngineeringPLMEngine.getArtifact('ART-DOC_ROOT', 'REV-A')!;
    expect(rootArt2.status).toBe('OUTDATED');

    // Now revise Root Assembly to REV-B
    rootAsm.revision = 2;
    const resRootB = DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });
    
    expect(resRootB.success).toBe(true);
    const rootArtB = EngineeringPLMEngine.getArtifact('ART-DOC_ROOT', 'REV-B')!;
    expect(rootArtB).toBeDefined();
    expect(rootArtB.status).toBe('VALID');
    
    // Verify it now depends on Part A REV-B
    const rootDepsB = EngineeringPLMEngine.getDependencies('ART-DOC_ROOT', 'REV-B');
    expect(rootDepsB).toContain('ART-DOC_PART_A@REV-B');
  });

  /**
   * PHASE 5 — PLM INVALIDATION
   */
  it('PHASE 5: should prove the real production invalidation chain in PLM engine', () => {
    const partA = createPartDoc('DOC_PART_A', 50);
    const subAsm = createAssemblyDoc('DOC_SUB', ['DOC_PART_A']);
    const rootAsm = createAssemblyDoc('DOC_ROOT', ['DOC_SUB']);

    resolver.register(partA);
    resolver.register(subAsm);

    DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });

    expect(EngineeringPLMEngine.getArtifact('ART-DOC_ROOT', 'REV-A')!.status).toBe('VALID');
    expect(EngineeringPLMEngine.getArtifact('ART-DOC_SUB', 'REV-A')!.status).toBe('VALID');
    expect(EngineeringPLMEngine.getArtifact('ART-DOC_PART_A', 'REV-A')!.status).toBe('VALID');

    // Mutate leaf
    partA.revision = 2;
    if (!partA.parameters || !partA.parameters[0]) throw new Error("Part A parameters missing");
    partA.parameters[0].value = 60;
    DocumentEvaluator.evaluate(partA);

    // Verify recursive invalidation
    expect(EngineeringPLMEngine.getArtifact('ART-DOC_PART_A', 'REV-A')!.status).toBe('SUPERSEDED');
    expect(EngineeringPLMEngine.getArtifact('ART-DOC_PART_A', 'REV-B')!.status).toBe('VALID');
    
    expect(EngineeringPLMEngine.getArtifact('ART-DOC_SUB', 'REV-A')!.status).toBe('OUTDATED');
    expect(EngineeringPLMEngine.getArtifact('ART-DOC_ROOT', 'REV-A')!.status).toBe('OUTDATED');
  });

  /**
   * PHASE 6 — NEGATIVE / ADVERSARIAL CASES
   */
  describe('PHASE 6: Adversarial Cases', () => {
    it('CASE A: should handle deleted child document gracefully', () => {
      const rootAsm = createAssemblyDoc('DOC_ROOT_DELETED_CHILD', ['MISSING_DOC']);
      const result = DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });
      
      expect(result.success).toBe(false);
      expect(result.evaluatedAssembly!.components[0].resolutionStatus).toBe('MISSING');
      expect(result.diagnostics).toContain("[SECP_DOC_MISSING] Instance 'inst-MISSING_DOC-0' (occurrence: 'inst-MISSING_DOC-0') references missing document: 'MISSING_DOC'");
    });

    it('CASE C: should detect revision mismatch and fail resolution deterministically', () => {
      const partA = createPartDoc('DOC_PART_A', 50);
      partA.revision = 2; // Part is at REV-B
      resolver.register(partA);

      const rootAsm = createAssemblyDoc('DOC_ROOT', ['DOC_PART_A']);
      rootAsm.assembly!.instances[0].revision = 'REV-A'; // Assembly explicitly wants REV-A

      const result = DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });
      
      // Strict revision authority: requested REV-A is not in resolver, MUST fail deterministically
      expect(result.success).toBe(false);
      const compA = result.evaluatedAssembly!.components[0];
      expect(compA.resolutionStatus).toBe('MISSING');
      expect(compA.revision).toBe('REV-A');
      expect(compA.solid).toBeUndefined();
      expect(result.diagnostics.some(d => d.includes('[SECP_DOC_MISSING]') && d.includes('requested revision: REV-A'))).toBe(true);
    });

    it('CASE E: should block release of stale PLM artifact', () => {
      const partA = createPartDoc('DOC_PART_A', 50);
      resolver.register(partA);
      const rootAsm = createAssemblyDoc('DOC_ROOT', ['DOC_PART_A']);
      
      DocumentEvaluator.evaluate(rootAsm, { context: { resolver } });
      const rootArt = EngineeringPLMEngine.getArtifact('ART-DOC_ROOT', 'REV-A')!;
      expect(rootArt.status).toBe('VALID');

      // Invalidate
      partA.revision = 2;
      DocumentEvaluator.evaluate(partA);
      
      expect(EngineeringPLMEngine.getArtifact('ART-DOC_ROOT', 'REV-A')!.status).toBe('OUTDATED');

      // Attempt release
      const releaseRes = EngineeringPLMEngine.transitionArtifactStatus('ART-DOC_ROOT', 'REV-A', 'RELEASED', 'CHIEF_ENGINEER');
      expect(releaseRes.success).toBe(false);
      expect(releaseRes.error).toContain('Illegal lifecycle transition');
    });
  });

  /**
   * PHASE 7 — CROSS-RUN DETERMINISM
   */
  it('PHASE 7: should execute complete hierarchical workflow three times with identical results', () => {
    const runResults: any[] = [];

    for (let i = 0; i < 3; i++) {
      EngineeringPLMEngine.clear();
      const res = new InMemoryDocumentResolver();
      
      const pA = createPartDoc('DOC_PART_A', 50);
      const sub = createAssemblyDoc('DOC_SUB', ['DOC_PART_A']);
      const root = createAssemblyDoc('DOC_ROOT', ['DOC_SUB']);

      res.register(pA);
      res.register(sub);

      const evalRes = DocumentEvaluator.evaluate(root, { generateMesh: true, context: { resolver: res } });
      const rootArt = EngineeringPLMEngine.getArtifact('ART-DOC_ROOT', 'REV-A')!;
      const evidence = root.evidence![root.evidence!.length - 1];

      runResults.push({
        documentId: root.documentId,
        revision: root.revision,
        geometryHash: evidence.geometryHash,
        topologyHash: evidence.topologyHash,
        componentCount: evalRes.evaluatedAssembly!.components.length,
        artifactId: rootArt.artifactId,
        dependencyHash: rootArt.dependencyHash
      });
    }

    expect(runResults[0]).toEqual(runResults[1]);
    expect(runResults[1]).toEqual(runResults[2]);
    
    console.log('=== DETERMINISM VERIFIED (Run1 === Run2 === Run3) ===');
  });
});
