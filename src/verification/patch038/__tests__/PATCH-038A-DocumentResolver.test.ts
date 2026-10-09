import { describe, it, expect } from 'vitest';
import { DocumentEvaluator } from '../../../engine/cad-kernel/document/DocumentEvaluator';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';
import {
  InMemoryDocumentResolver,
  DocumentEvaluationContext
} from '../../../engine/cad-kernel/document/DocumentResolver';

describe('PATCH-038A — Document Resolver & Multi-Document Registry', () => {

  it('TEST A: registers a real child EngineeringDocument and resolves it by documentId', () => {
    const resolver = new InMemoryDocumentResolver();

    const childPart = DocumentEvaluator.createDocument({
      documentId: 'DOC_PART_CYLINDER_001',
      parameters: [{ id: 'p1', name: 'radius', value: 25, unit: 'mm', expression: '25' }]
    });
    childPart.type = 'PART';

    resolver.register(childPart);

    expect(resolver.has('DOC_PART_CYLINDER_001')).toBe(true);
    const resolved = resolver.resolve('DOC_PART_CYLINDER_001');
    expect(resolved).toBeDefined();
    expect(resolved?.documentId).toBe('DOC_PART_CYLINDER_001');
    expect(resolved?.type).toBe('PART');
    expect(resolved?.parameters.find(p => p.name === 'radius')?.value).toBe(25);
  });

  it('TEST B: unknown documentId produces deterministic missing-reference behavior', () => {
    const resolver = new InMemoryDocumentResolver();

    expect(resolver.has('DOC_NON_EXISTENT')).toBe(false);
    expect(resolver.resolve('DOC_NON_EXISTENT')).toBeUndefined();

    const res = resolver.resolveWithStatus('DOC_NON_EXISTENT');
    expect(res.status).toBe('MISSING');
    expect(res.document).toBeUndefined();
    expect(res.documentId).toBe('DOC_NON_EXISTENT');
    expect(res.error).toContain('Referenced document not found in registry');
  });

  it('TEST C: cyclic document references are detected deterministically', () => {
    const resolver = new InMemoryDocumentResolver();

    const docA = DocumentEvaluator.createDocument({ documentId: 'DOC_A' });
    docA.type = 'ASSEMBLY';
    resolver.register(docA);

    const context: DocumentEvaluationContext = {
      resolver,
      visitedDocIds: new Set(['DOC_A'])
    };

    const res = resolver.resolveWithStatus('DOC_A', context);
    expect(res.status).toBe('CYCLIC');
    expect(res.documentId).toBe('DOC_A');
    expect(res.error).toContain('Cyclic document reference detected');
  });

  it('TEST D: maximum recursion depth is enforced deterministically', () => {
    const resolver = new InMemoryDocumentResolver();

    const docDeep = DocumentEvaluator.createDocument({ documentId: 'DOC_DEEP' });
    resolver.register(docDeep);

    const context: DocumentEvaluationContext = {
      resolver,
      depth: 16,
      maxDepth: 16
    };

    const res = resolver.resolveWithStatus('DOC_DEEP', context);
    expect(res.status).toBe('DEPTH_EXCEEDED');
    expect(res.documentId).toBe('DOC_DEEP');
    expect(res.error).toContain('Maximum evaluation depth (16) exceeded');
  });

  it('TEST E: resolver returns authoritative EngineeringDocument rather than CadSolidEntity or runtime geometry', () => {
    const resolver = new InMemoryDocumentResolver();

    const childPart = DocumentEvaluator.createDocument({
      documentId: 'DOC_ENGINE_PISTON',
      parameters: [{ id: 'dia', name: 'piston_diameter', value: 85, unit: 'mm', expression: '85' }]
    });
    childPart.type = 'PART';
    resolver.register(childPart);

    const resolved = resolver.resolve('DOC_ENGINE_PISTON');
    expect(resolved).toBeDefined();

    // Must be EngineeringDocument
    expect(resolved?.documentId).toBe('DOC_ENGINE_PISTON');
    expect(Array.isArray(resolved?.parameters)).toBe(true);
    expect(Array.isArray(resolved?.features)).toBe(true);
    expect(Array.isArray(resolved?.sketches)).toBe(true);

    // Must NOT be runtime CadSolidEntity or mesh
    expect((resolved as any).facets).toBeUndefined();
    expect((resolved as any).edges).toBeUndefined();
    expect((resolved as any).vertices).toBeUndefined();
    expect((resolved as any).type === 'SOLID_BOX').toBe(false);
  });

  it('TEST F: DocumentEvaluator receives context and resolves child references without creating a second evaluator', () => {
    const resolver = new InMemoryDocumentResolver();

    const childDoc = DocumentEvaluator.createDocument({ documentId: 'CHILD_VALVE_PART' });
    childDoc.type = 'PART';
    resolver.register(childDoc);

    const assemblyDoc = DocumentEvaluator.createDocument({ documentId: 'PARENT_ASSEMBLY' });
    assemblyDoc.type = 'ASSEMBLY';
    assemblyDoc.assembly = {
      instances: [
        {
          instanceId: 'inst-1',
          documentId: 'CHILD_VALVE_PART',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 }
        },
        {
          instanceId: 'inst-2',
          documentId: 'MISSING_PART_ID',
          position: { x: 10, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 }
        }
      ],
      mates: []
    };

    const evalResult = DocumentEvaluator.evaluate(assemblyDoc, {
      generateMesh: false,
      context: { resolver }
    });

    // Successfully evaluated through the single canonical DocumentEvaluator
    expect(evalResult.document.documentId).toBe('PARENT_ASSEMBLY');
    expect(evalResult.evaluatedAssembly).toBeDefined();
    expect(evalResult.evaluatedAssembly?.components.length).toBe(2);

    const comp1 = evalResult.evaluatedAssembly?.components[0];
    const comp2 = evalResult.evaluatedAssembly?.components[1];

    expect(comp1.resolutionStatus).toBe('RESOLVED');
    expect(comp2.resolutionStatus).toBe('MISSING');

    // Deterministic failure diagnostic is logged
    expect(evalResult.success).toBe(false);
    expect(evalResult.diagnostics.some(d => d.includes('[SECP_DOC_RESOLVED]') && d.includes('CHILD_VALVE_PART'))).toBe(true);
    expect(evalResult.diagnostics.some(d => d.includes('[SECP_DOC_MISSING]') && d.includes('MISSING_PART_ID'))).toBe(true);
  });

});
