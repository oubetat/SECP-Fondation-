import { describe, it, expect } from 'vitest';
import { DocumentEvaluator } from '../../../engine/cad-kernel/document/DocumentEvaluator';
import { AssemblyEngine } from '../../../engine/assembly';
import { EngineeringDocument } from '../../../engine/cad-kernel/document/CADDocument';

describe('PATCH-037 — Assembly SOT Integration Audit', () => {
  
  it('should verify that AssemblyEngine generates a valid EngineeringDocument with AED schema', () => {
    const doc = AssemblyEngine.createEngineAssemblyDocument();
    
    expect(doc.type).toBe('ASSEMBLY');
    expect(doc.assembly).toBeDefined();
    expect(doc.assembly?.instances.length).toBeGreaterThan(0);
    expect(doc.assembly?.mates.length).toBeGreaterThan(0);
  });

  it('should verify that DocumentEvaluator successfully evaluates an assembly document', () => {
    const doc = AssemblyEngine.createEngineAssemblyDocument();
    const result = DocumentEvaluator.evaluate(doc);
    
    expect(result.success).toBe(true);
    expect(result.evaluatedAssembly).toBeDefined();
    expect(result.evaluatedAssembly?.components.length).toBe(doc.assembly?.instances.length);
    expect(result.evaluatedAssembly?.mates.length).toBe(doc.assembly?.mates.length);
  });

  it('should verify that assembly component objects are derived from the SOT instances', () => {
    const doc = AssemblyEngine.createEngineAssemblyDocument();
    const result = DocumentEvaluator.evaluate(doc);
    
    const firstInstance = doc.assembly!.instances[0];
    const firstComponent = result.evaluatedAssembly!.components[0];
    
    expect(firstComponent.id).toBe(firstInstance.instanceId);
    expect(firstComponent.partId).toBe(firstInstance.documentId);
    expect(firstComponent.position).toEqual(firstInstance.position);
    expect(firstComponent.rotation).toEqual(firstInstance.rotation);
  });

  it('should verify that non-assembly documents do not produce evaluatedAssembly artifacts', () => {
    const doc = DocumentEvaluator.createDocument({ documentId: 'PART_DOC' });
    doc.type = 'PART';
    const result = DocumentEvaluator.evaluate(doc);
    
    expect(result.evaluatedAssembly).toBeUndefined();
  });
});
