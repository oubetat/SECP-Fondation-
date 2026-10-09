/**
 * SECP CAD Kernel — Canonical Evaluator Routing Test Suite
 * Phase 3 (PROMPT-014)
 */

import { describe, it, expect, vi } from 'vitest';
import { DocumentEvaluator } from '../../document/DocumentEvaluator';
import { FeatureExecutor } from '../FeatureExecution';
import { FeatureRegistry277 } from '../FeatureRegistry277';
import { FeatureNode } from '../FeatureNode';
import { BRepKernel } from '../../brep/BRepKernel';

describe('PROMPT-014 — Canonical Evaluator Routing', () => {
  it('Routes Feature Type to Registered Evaluator in Registry', () => {
    // 1. Arrange: Create a mock evaluator
    const mockEvaluator = vi.fn().mockReturnValue({
      status: 'SUCCESS',
      diagnostics: ['MOCK_ROUTING_SUCCESS'],
      dependenciesUsed: [],
      toleranceContext: {}
    });

    // 2. Act: Register and evaluate a custom feature type
    FeatureRegistry277.register('IMPORT' as any, mockEvaluator);

    const feature = new FeatureNode({
      id: 'FEAT_MOCK_IMPORT',
      documentId: 'DOC_TEST',
      type: 'IMPORT' as any,
      name: 'Test Import',
      definition: {
        type: 'IMPORT' as any,
        name: 'Test Import',
        parameters: {}
      },
      sequence: 1
    });

    const result = FeatureExecutor.execute(feature, {
      documentId: 'DOC_TEST',
      toleranceContext: {} as any,
      resolvedInputs: new Map()
    });

    // 3. Assert: Verify the registry was consulted
    expect(mockEvaluator).toHaveBeenCalled();
    expect(result.status).toBe('SUCCESS');
    expect(result.diagnostics).toContain('MOCK_ROUTING_SUCCESS');
  });

  it('Propagates Parameters from EngineeringDocument to Kernel Capability', () => {
    const doc = DocumentEvaluator.createDocument({
      documentId: 'DOC_PARAM_TEST',
      features: [
        {
          featureId: 'EXTRUDE_01',
          type: 'EXTRUDE',
          name: 'Main Extrusion',
          parameters: {
            width: 50,
            height: 30,
            depth: 100
          }
        }
      ]
    });

    // Spy on the kernel to see if it received the depth (converted to meters)
    const kernelSpy = vi.spyOn(BRepKernel.getCanonical(), 'extrudePolygon');

    const result = DocumentEvaluator.evaluate(doc);

    expect(result.success).toBe(true);
    // 100mm should be 0.1m
    expect(kernelSpy).toHaveBeenCalledWith(
      expect.anything(),
      0.1, // 100mm = 0.1m
      expect.stringContaining('EXTRUDE_01')
    );

    kernelSpy.mockRestore();
  });

  it('Executes Real REVOLVE Capability via Routing', () => {
    const doc = DocumentEvaluator.createDocument({
      documentId: 'DOC_REVOLVE_TEST',
      features: [
        {
          featureId: 'SKETCH_01',
          type: 'SKETCH',
          parameters: {
            plane: 'XY',
            entities: [
              { type: 'LINE', id: 'L1', data: { x1: 10, y1: 0, x2: 20, y2: 0 } },
              { type: 'LINE', id: 'L2', data: { x1: 20, y1: 0, x2: 20, y2: 20 } },
              { type: 'LINE', id: 'L3', data: { x1: 20, y1: 20, x2: 10, y2: 20 } },
              { type: 'LINE', id: 'L4', data: { x1: 10, y1: 20, x2: 10, y2: 0 } }
            ],
            closedProfile: true
          }
        },
        {
          featureId: 'REVOLVE_01',
          type: 'REVOLVE',
          parameters: {
            angle: 180,
            axisPoint: { x: 0, y: 0, z: 0 },
            axisDir: { x: 0, y: 0, z: 1 }
          },
          dependencyIds: ['SKETCH_01']
        }
      ]
    });

    const result = DocumentEvaluator.evaluate(doc);

    expect(result.success).toBe(true);
    expect(result.evaluatedShape).toBeDefined();
    // A revolve of a rectangle should produce many faces (32 slices * N points)
    expect(result.evaluatedShape!.outerShell.orientedFaces.length).toBeGreaterThan(6);
    
    // Check if evidence contains REVOLVE execution
    const evidence = doc.evidence.find(e => e.payload.featuresExecuted >= 2);
    expect(evidence).toBeDefined();
    expect(evidence!.verdict).toBe('VALID');
  });

  it('Propagates Kernel Failures to Document Level', () => {
    const doc = DocumentEvaluator.createDocument({
      documentId: 'DOC_FAIL_TEST',
      features: [
        {
          featureId: 'EXTRUDE_FAIL',
          type: 'EXTRUDE',
          parameters: {
            depth: -10 // Invalid parameter: depth must be positive
          }
        }
      ]
    });

    const result = DocumentEvaluator.evaluate(doc);

    expect(result.success).toBe(false);
    expect(result.diagnostics[0]).toMatch(/parameter errors|Parameter validation failed/);
    expect(doc.evidence[0].verdict).toBe('INVALID');
  });

  it('Adversarial: Rejects routing if feature type is unregistered', () => {
    const feature = new FeatureNode({
      id: 'FEAT_UNKNOWN',
      documentId: 'DOC_TEST',
      type: 'NON_EXISTENT_TYPE' as any,
      name: 'Unknown Feature',
      definition: {
        type: 'NON_EXISTENT_TYPE' as any,
        name: 'Unknown',
        parameters: {}
      },
      sequence: 1
    });

    const result = FeatureExecutor.execute(feature, {
      documentId: 'DOC_TEST',
      toleranceContext: {} as any,
      resolvedInputs: new Map()
    });

    expect(result.status).toBe('UNSUPPORTED');
    expect(result.diagnostics[0]).toContain('UNSUPPORTED');
  });
});
