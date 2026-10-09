import { describe, it, expect } from 'vitest';
import { DocumentEvaluator } from '../../../engine/cad-kernel/document/DocumentEvaluator';
import { InMemoryDocumentResolver } from '../../../engine/cad-kernel/document/DocumentResolver';

describe('PATCH-038B — Evaluator Assembly Linking & Child Geometry Derivation', () => {

  it('TEST 1: real parent → child document resolution derives valid runtime CadSolidEntity', () => {
    const resolver = new InMemoryDocumentResolver();

    // Authoritative child EngineeringDocument (SOT)
    const childPart = DocumentEvaluator.createDocument({
      documentId: 'DOC_PART_MOTOR_HOUSING',
      parameters: [
        { id: 'w', name: 'width', value: 50, unit: 'mm', expression: '50' },
        { id: 'h', name: 'height', value: 30, unit: 'mm', expression: '30' },
        { id: 'd', name: 'depth', value: 40, unit: 'mm', expression: '40' }
      ]
    });
    childPart.type = 'PART';
    resolver.register(childPart);

    // Authoritative parent ASSEMBLY EngineeringDocument (SOT)
    const assemblyDoc = DocumentEvaluator.createDocument({ documentId: 'DOC_ASSEMBLY_PUMP' });
    assemblyDoc.type = 'ASSEMBLY';
    assemblyDoc.assembly = {
      instances: [
        {
          instanceId: 'inst-housing-1',
          documentId: 'DOC_PART_MOTOR_HOUSING',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          colorHex: '#3b82f6'
        }
      ],
      mates: []
    };

    const evalResult = DocumentEvaluator.evaluate(assemblyDoc, {
      generateMesh: true,
      context: { resolver }
    });

    expect(evalResult.success).toBe(true);
    expect(evalResult.evaluatedAssembly).toBeDefined();
    expect(evalResult.evaluatedAssembly?.components.length).toBe(1);

    const comp = evalResult.evaluatedAssembly!.components[0];
    expect(comp.id).toBe('inst-housing-1');
    expect(comp.partId).toBe('DOC_PART_MOTOR_HOUSING');
    expect(comp.resolutionStatus).toBe('RESOLVED');

    // Runtime CadSolidEntity must be genuinely derived from child's evaluatedShape
    expect(comp.solid).toBeDefined();
    expect(comp.solid.id).toContain('DOC_PART_MOTOR_HOUSING');
    expect(comp.solid.brep).toBeDefined();
    expect(comp.solid.volumeM3).toBeGreaterThan(0);
    // 50mm * 30mm * 40mm = 60,000 mm3 = 0.00006 m3
    expect(comp.solid.volumeM3).toBeCloseTo(0.00006, 8); 
    expect(comp.solid.dimensions.dx).toBeCloseTo(50, 1);
    expect(comp.solid.dimensions.dy).toBeCloseTo(30, 1);
    expect(comp.solid.dimensions.dz).toBeCloseTo(40, 1);
  });

  it('TEST 2: child parametric change → changed evaluated geometry in derived assembly component', () => {
    const resolver = new InMemoryDocumentResolver();

    // 1. Initial child with width = 20mm
    const childPart = DocumentEvaluator.createDocument({
      documentId: 'DOC_PARAM_CYLINDER',
      parameters: [
        { id: 'p_w', name: 'width', value: 20, unit: 'mm', expression: '20' },
        { id: 'p_h', name: 'height', value: 20, unit: 'mm', expression: '20' },
        { id: 'p_d', name: 'depth', value: 20, unit: 'mm', expression: '20' }
      ]
    });
    childPart.type = 'PART';
    resolver.register(childPart);

    const assemblyDoc = DocumentEvaluator.createDocument({ documentId: 'DOC_ASSY_PARAM' });
    assemblyDoc.type = 'ASSEMBLY';
    assemblyDoc.assembly = {
      instances: [
        {
          instanceId: 'inst-param-1',
          documentId: 'DOC_PARAM_CYLINDER',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 }
        }
      ],
      mates: []
    };

    // First evaluation: width = 20mm -> vol1 = 20 * 20 * 20 = 8000
    const result1 = DocumentEvaluator.evaluate(assemblyDoc, {
      generateMesh: true,
      context: { resolver }
    });
    expect(result1.success).toBe(true);
    const vol1 = result1.evaluatedAssembly!.components[0].solid!.volumeM3;
    expect(vol1).toBeCloseTo(0.000008, 8); 

    // 2. Modify child document parameter directly: width = 80mm
    const widthParam = childPart.parameters.find(p => p.name === 'width')!;
    widthParam.value = 80;
    widthParam.expression = '80';

    // Second evaluation: width = 80mm -> vol2 = 80 * 20 * 20 = 32000 mm3 -> 0.000032 m3
    const result2 = DocumentEvaluator.evaluate(assemblyDoc, {
      generateMesh: true,
      context: { resolver }
    });
    expect(result2.success).toBe(true);
    const vol2 = result2.evaluatedAssembly!.components[0].solid!.volumeM3;
    expect(vol2).toBeCloseTo(0.000032, 8);

    // Causal link verified: 4x parameter increase -> 4x derived solid volume
    expect(vol2 / vol1).toBeCloseTo(4.0, 4);
  });

  it('TEST 3: occurrence transform → changed derived component placement and center of gravity', () => {
    const resolver = new InMemoryDocumentResolver();

    const childPart = DocumentEvaluator.createDocument({
      documentId: 'DOC_PART_BRACKET',
      parameters: [
        { id: 'w', name: 'width', value: 40, unit: 'mm', expression: '40' },
        { id: 'h', name: 'height', value: 40, unit: 'mm', expression: '40' },
        { id: 'd', name: 'depth', value: 40, unit: 'mm', expression: '40' }
      ]
    });
    childPart.type = 'PART';
    resolver.register(childPart);

    const assemblyDoc = DocumentEvaluator.createDocument({ documentId: 'DOC_ASSY_TRANSFORM' });
    assemblyDoc.type = 'ASSEMBLY';
    assemblyDoc.assembly = {
      instances: [
        {
          instanceId: 'inst-bracket-offset',
          documentId: 'DOC_PART_BRACKET',
          position: { x: 150, y: -80, z: 220 },
          rotation: { x: 10, y: 45, z: 90 },
          colorHex: '#10b981'
        }
      ],
      mates: []
    };

    const evalResult = DocumentEvaluator.evaluate(assemblyDoc, {
      generateMesh: true,
      context: { resolver }
    });

    expect(evalResult.success).toBe(true);
    const comp = evalResult.evaluatedAssembly!.components[0];

    // Component occurrence transforms
    expect(comp.position).toEqual({ x: 150, y: -80, z: 220 });
    expect(comp.rotation).toEqual({ x: 10, y: 45, z: 90 });
    expect(comp.colorHex).toBe('#10b981');

    // Derived CadSolidEntity placement
    expect(comp.solid).toBeDefined();
    expect(comp.solid!.position).toEqual({ x: 150, y: -80, z: 220 });
    expect(comp.solid!.rotation).toEqual({ x: 10, y: 45, z: 90 });
    expect(comp.solid!.colorHex).toBe('#10b981');

    // Center of gravity must be translated by instance position (in meters: +0.150, -0.080, +0.220)
    expect(comp.solid!.centerOfGravity.x).toBeCloseTo(0.150, 4);
    expect(comp.solid!.centerOfGravity.y).toBeCloseTo(-0.080, 4);
    expect(comp.solid!.centerOfGravity.z).toBeCloseTo(0.220, 4);
  });

  it('TEST 4: missing child produces no geometry and fails deterministically', () => {
    const resolver = new InMemoryDocumentResolver();

    const assemblyDoc = DocumentEvaluator.createDocument({ documentId: 'DOC_ASSY_MISSING' });
    assemblyDoc.type = 'ASSEMBLY';
    assemblyDoc.assembly = {
      instances: [
        {
          instanceId: 'inst-missing',
          documentId: 'DOC_NON_EXISTENT_CHILD',
          position: { x: 10, y: 20, z: 30 },
          rotation: { x: 0, y: 0, z: 0 }
        }
      ],
      mates: []
    };

    const evalResult = DocumentEvaluator.evaluate(assemblyDoc, {
      context: { resolver }
    });

    // Evaluation must fail deterministically
    expect(evalResult.success).toBe(false);
    expect(evalResult.evaluatedAssembly).toBeDefined();

    const comp = evalResult.evaluatedAssembly!.components[0];
    expect(comp.resolutionStatus).toBe('MISSING');
    // Must NOT produce synthetic or fallback geometry
    expect(comp.solid).toBeUndefined();

    // Diagnostic message logged
    expect(evalResult.diagnostics.some(d => d.includes('[SECP_DOC_MISSING]') && d.includes('DOC_NON_EXISTENT_CHILD'))).toBe(true);
  });

  it('TEST 5: cyclic child reference fails deterministically and produces no geometry', () => {
    const resolver = new InMemoryDocumentResolver();

    // Parent A references Child B
    const docA = DocumentEvaluator.createDocument({ documentId: 'DOC_ASSY_A' });
    docA.type = 'ASSEMBLY';
    docA.assembly = {
      instances: [
        {
          instanceId: 'inst-b',
          documentId: 'DOC_ASSY_B',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 }
        }
      ],
      mates: []
    };

    // Child B references Parent A (Cycle)
    const docB = DocumentEvaluator.createDocument({ documentId: 'DOC_ASSY_B' });
    docB.type = 'ASSEMBLY';
    docB.assembly = {
      instances: [
        {
          instanceId: 'inst-a',
          documentId: 'DOC_ASSY_A',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 }
        }
      ],
      mates: []
    };

    resolver.register(docA);
    resolver.register(docB);

    const evalResult = DocumentEvaluator.evaluate(docA, {
      context: { resolver }
    });

    // Evaluation must fail deterministically due to cyclic reference
    expect(evalResult.success).toBe(false);
    expect(evalResult.diagnostics.some(d => d.includes('[SECP_DOC_CYCLIC]'))).toBe(true);

    const compB = evalResult.evaluatedAssembly!.components[0];
    // No geometry derived for cyclic reference
    expect(compB.solid).toBeUndefined();
  });

  it('TEST 6: child evaluation uses exclusively the canonical DocumentEvaluator and evidence chain', () => {
    const resolver = new InMemoryDocumentResolver();

    const childPart = DocumentEvaluator.createDocument({
      documentId: 'DOC_CANONICAL_CHILD',
      parameters: [{ id: 'p1', name: 'width', value: 35, unit: 'mm', expression: '35' }]
    });
    childPart.type = 'PART';
    resolver.register(childPart);

    const assemblyDoc = DocumentEvaluator.createDocument({ documentId: 'DOC_CANONICAL_PARENT' });
    assemblyDoc.type = 'ASSEMBLY';
    assemblyDoc.assembly = {
      instances: [
        {
          instanceId: 'inst-canonical-1',
          documentId: 'DOC_CANONICAL_CHILD',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 }
        }
      ],
      mates: []
    };

    const evalResult = DocumentEvaluator.evaluate(assemblyDoc, {
      generateMesh: true,
      context: { resolver }
    });

    expect(evalResult.success).toBe(true);
    // The child document must have evidence stamped by canonical DocumentEvaluator
    expect(childPart.evidence.length).toBeGreaterThan(0);
    const lastEvidence = childPart.evidence[childPart.evidence.length - 1];
    expect(lastEvidence.sourceSystem).toBe('SECP_CANONICAL_EVALUATOR');
    expect(lastEvidence.stage).toBe('GEOMETRY');
    expect(lastEvidence.topologyHash).toBeDefined();

    // The derived solid has the canonical B-Rep shape
    const comp = evalResult.evaluatedAssembly!.components[0];
    expect(comp.solid?.brep).toBe(childPart.evaluatedShape);
  });

  it('TEST 7: no synthetic or fallback solid is created on partial or total failure', () => {
    const resolver = new InMemoryDocumentResolver();

    const validPart = DocumentEvaluator.createDocument({
      documentId: 'DOC_VALID_PART',
      parameters: [
        { name: 'width', value: 10, unit: 'mm' } as any,
        { name: 'height', value: 10, unit: 'mm' } as any,
        { name: 'depth', value: 10, unit: 'mm' } as any
      ]
    });
    validPart.type = 'PART';
    resolver.register(validPart);

    const assemblyDoc = DocumentEvaluator.createDocument({ documentId: 'DOC_PARTIAL_FAIL_ASSY' });
    assemblyDoc.type = 'ASSEMBLY';
    assemblyDoc.assembly = {
      instances: [
        {
          instanceId: 'inst-valid',
          documentId: 'DOC_VALID_PART',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 }
        },
        {
          instanceId: 'inst-invalid',
          documentId: 'DOC_MISSING_SUBPART',
          position: { x: 10, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 }
        }
      ],
      mates: []
    };

    const evalResult = DocumentEvaluator.evaluate(assemblyDoc, {
      generateMesh: true,
      context: { resolver }
    });

    // An assembly with any missing components must fail evaluation overall
    expect(evalResult.success).toBe(false);

    const compValid = evalResult.evaluatedAssembly!.components.find(c => c.id === 'inst-valid')!;
    const compInvalid = evalResult.evaluatedAssembly!.components.find(c => c.id === 'inst-invalid')!;

    expect(compValid.solid).toBeDefined();
    // Invalid component must be strictly undefined: NEVER a dummy or fallback Box
    expect(compInvalid.solid).toBeUndefined();
    expect(compInvalid.resolutionStatus).toBe('MISSING');
  });

});
