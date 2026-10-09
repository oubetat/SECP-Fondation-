/**
 * SECP CAD Kernel — Canonical Feature History Subsystem Tests
 * Phase 2 (PATCH-KERNEL-003)
 */

import { describe, it, expect } from 'vitest';
import { FeatureHistory } from '../FeatureHistory';
import { FeatureNode } from '../FeatureNode';
import { FeatureType } from '../FeatureDefinition';

describe('PATCH-KERNEL-003 — Canonical Feature History', () => {
  it('TEST-01: FeatureNode implements canonical interface with parameters, parents, inputs, outputs, resultSolidId, and status', () => {
    const history = new FeatureHistory('DOC_CANONICAL_001');

    // 1. Sketch001
    const sketch001 = history.addFeature(
      'SKETCH',
      'Sketch001',
      {
        type: 'SKETCH',
        name: 'Sketch001',
        parameters: {
          plane: 'XY',
          closedProfile: true,
          entities: [
            { type: 'LINE', id: 'L1', data: { x1: 0, y1: 0, x2: 100, y2: 0 } },
            { type: 'LINE', id: 'L2', data: { x1: 100, y1: 0, x2: 100, y2: 60 } },
            { type: 'LINE', id: 'L3', data: { x1: 100, y1: 60, x2: 0, y2: 60 } },
            { type: 'LINE', id: 'L4', data: { x1: 0, y1: 60, x2: 0, y2: 0 } }
          ]
        },
        inputReferences: []
      },
      [],
      undefined,
      'Sketch001'
    );

    // Initial status is DIRTY before evaluation
    expect(sketch001.status).toBe('DIRTY');
    expect(sketch001.featureId).toBe('Sketch001');
    expect(sketch001.parents).toEqual([]);

    // 2. Extrude001 (retains profileId, depth=50, direction=+Z)
    const extrude001 = history.addFeature(
      'EXTRUDE',
      'Extrude001',
      {
        type: 'EXTRUDE',
        name: 'Extrude001',
        parameters: {
          profileId: 'Sketch001',
          width: 100,
          height: 60,
          depth: 50,
          direction: '+Z',
          operation: 'NEW'
        },
        inputReferences: [
          { type: 'PROFILE', targetFeatureId: 'Sketch001', name: 'Profile1' }
        ]
      },
      ['Sketch001'],
      'Sketch001',
      'Extrude001'
    );

    expect(extrude001.featureId).toBe('Extrude001');
    expect(extrude001.type).toBe('EXTRUDE');
    expect(extrude001.parameters.profileId).toBe('Sketch001');
    expect(extrude001.parameters.depth).toBe(50);
    expect(extrude001.parameters.direction).toBe('+Z');
    expect(extrude001.parents).toEqual(['Sketch001']);
    expect(extrude001.inputs.length).toBe(1);
    expect(extrude001.inputs[0].targetFeatureId).toBe('Sketch001');
    expect(extrude001.status).toBe('DIRTY');

    // 3. Fillet001
    const fillet001 = history.addFeature(
      'FILLET',
      'Fillet001',
      {
        type: 'FILLET',
        name: 'Fillet001',
        parameters: {
          radius: 5,
          edgeReferences: [
            { type: 'EDGE', targetFeatureId: 'Extrude001', persistentTag: 'EDGE_TOP_FRONT' }
          ]
        },
        inputReferences: [
          { type: 'SOLID', targetFeatureId: 'Extrude001' }
        ]
      },
      ['Extrude001'],
      'Extrude001',
      'Fillet001'
    );

    expect(fillet001.featureId).toBe('Fillet001');
    expect(fillet001.parents).toEqual(['Extrude001']);

    // 4. Pocket001
    const pocket001 = history.addFeature(
      'POCKET',
      'Pocket001',
      {
        type: 'POCKET',
        name: 'Pocket001',
        parameters: {
          profileId: 'Sketch001',
          depth: 15,
          direction: '-Z'
        },
        inputReferences: [
          { type: 'SOLID', targetFeatureId: 'Fillet001' }
        ]
      },
      ['Fillet001'],
      'Fillet001',
      'Pocket001'
    );

    expect(pocket001.featureId).toBe('Pocket001');
    expect(pocket001.parents).toEqual(['Fillet001']);
    expect(pocket001.parameters.depth).toBe(15);
    expect(pocket001.parameters.direction).toBe('-Z');

    // 5. Execute regeneration across tree: Sketch001 -> Extrude001 -> Fillet001 -> Pocket001
    const regenResult = history.regenerate();
    expect(regenResult.success).toBe(true);

    // Validate states & outputs
    expect(sketch001.status).toBe('VALID');
    expect(extrude001.status).toBe('VALID');
    expect(extrude001.resultSolidId).toBeDefined();
    expect(extrude001.outputs.length).toBeGreaterThan(0);

    expect(fillet001.status).toBe('VALID');
    expect(fillet001.resultSolidId).toBeDefined();

    expect(pocket001.status).toBe('VALID');
    expect(pocket001.resultSolidId).toBeDefined();

    // Verify topological order
    const order = history.getTopologicalOrder();
    expect(order).toEqual(['Sketch001', 'Extrude001', 'Fillet001', 'Pocket001']);
  });

  it('TEST-02: Status transitions to DIRTY upon parameter update, and back to VALID after regeneration', () => {
    const history = new FeatureHistory('DOC_MUTATION_001');

    const extrude = history.addFeature(
      'EXTRUDE',
      'Extrude001',
      {
        type: 'EXTRUDE',
        name: 'Extrude001',
        parameters: {
          width: 50,
          height: 50,
          depth: 25,
          direction: '+Z'
        },
        inputReferences: []
      },
      [],
      undefined,
      'Extrude001'
    );

    const fillet = history.addFeature(
      'FILLET',
      'Fillet001',
      {
        type: 'FILLET',
        name: 'Fillet001',
        parameters: { radius: 2.5 },
        inputReferences: [{ type: 'SOLID', targetFeatureId: 'Extrude001' }]
      },
      ['Extrude001'],
      'Extrude001',
      'Fillet001'
    );

    // Initial regeneration
    history.regenerate();
    expect(extrude.status).toBe('VALID');
    expect(fillet.status).toBe('VALID');

    // Mutate Extrude parameter (depth: 25 -> 75)
    history.updateFeatureDefinition('Extrude001', {
      type: 'EXTRUDE',
      name: 'Extrude001',
      parameters: {
        width: 50,
        height: 50,
        depth: 75,
        direction: '+Z'
      }
    });

    expect(extrude.status).toBe('DIRTY');
    expect(extrude.parameters.depth).toBe(75);

    // Re-evaluate
    history.regenerate();
    expect(extrude.status).toBe('VALID');
    expect(fillet.status).toBe('VALID');
  });
});
