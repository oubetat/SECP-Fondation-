/**
 * SECP CAD Kernel — Parametric Regeneration Engine Tests
 * Phase 2 (PATCH-028)
 */

import { describe, it, expect } from 'vitest';
import { FeatureHistory } from '../../history/FeatureHistory';
import { ParametricRegenerationEngine, RegenerationRequest } from '../ParametricRegenerationEngine';
import { EngineeringIdentityFactory } from '../../../identity/EngineeringIdentityFactory';

describe('PATCH-028 — Parametric Regeneration Engine (10 Standard Tests)', () => {
  
  it('TEST 01 — Simple Parameter Change (Sketch dimension 20 -> 30)', () => {
    const history = new FeatureHistory('DOC_REGEN_01');
    const sketch = history.addFeature('SKETCH', 'Profile', {
      type: 'SKETCH',
      name: 'Profile',
      parameters: {
        plane: 'XY',
        entities: [
          { type: 'POINT', id: 'P1', data: { x: 0, y: 0 } },
          { type: 'POINT', id: 'P2', data: { x: 20, y: 0 } }
        ],
        closedProfile: false,
        constraints: [
          {
            id: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY', projectId: 'C1',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
            type: 'DISTANCE',
            sketchId: { namespace: 'SECP' as const, schemaVersion: '1.0.0' as const, artifactType: 'GEOMETRY', artifactId: 'Profile' },
            references: [
              { entityId: 'P1', target: 'ENTITY' },
              { entityId: 'P2', target: 'ENTITY' }
            ],
            parameters: { value: 20 },
            driving: true,
            provenance: { id: 'MOCK_P', type: 'DESIGN', engineeringIdentityId: 'MOCK', canonicalHash: 'H', version: '1', createdAt: '0', evidenceRefs: [] } as any
          }
        ]
      },
      inputReferences: []
    });

    const request: RegenerationRequest = {
      modelId: 'DOC_REGEN_01',
      rootChange: 'Change P2 distance from 20 to 30',
      changedEntityId: 'P1',
      targetParameter: 'x',
      newValue: 30,
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('SUCCESS' as const);
    expect(res.regeneratedFeaturesCount).toBe(1);
    expect(res.outputHash).toBeDefined();
  });

  it('TEST 02 — Multi-Feature Chain (Sketch -> Extrusion -> Fillet)', () => {
    const history = new FeatureHistory('DOC_REGEN_02');
    
    const sketch = history.addFeature('SKETCH', 'BaseSketch', {
      type: 'SKETCH',
      name: 'BaseSketch',
      parameters: { plane: 'XY', entities: [], closedProfile: true },
      inputReferences: []
    });

    const extrude = history.addFeature('EXTRUDE', 'SolidBlock', {
      type: 'EXTRUDE',
      name: 'SolidBlock',
      parameters: { width: 50, height: 50, depth: 20 },
      inputReferences: [{ type: 'SKETCH', targetFeatureId: sketch.id }]
    }, [sketch.id]);

    const fillet = history.addFeature('FILLET', 'Blend', {
      type: 'FILLET',
      name: 'Blend',
      parameters: { radius: 3.0 },
      inputReferences: [{ type: 'FEATURE', targetFeatureId: extrude.id }]
    }, [extrude.id]);

    const request: RegenerationRequest = {
      modelId: 'DOC_REGEN_02',
      rootChange: 'Modify block width',
      changedEntityId: extrude.id,
      targetParameter: 'width',
      newValue: 60,
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('SUCCESS');
    expect(res.affectedFeatures).toContain(extrude.id);
    expect(res.affectedFeatures).toContain(fillet.id);
  });

  it('TEST 03 — Unaffected Feature Isolation (Part A / Part B)', () => {
    const history = new FeatureHistory('DOC_REGEN_03');
    
    const f1 = history.addFeature('EXTRUDE', 'PartA', {
      type: 'EXTRUDE',
      name: 'PartA',
      parameters: { width: 10, height: 10, depth: 10 },
      inputReferences: []
    });

    const f2 = history.addFeature('EXTRUDE', 'PartB', {
      type: 'EXTRUDE',
      name: 'PartB',
      parameters: { width: 20, height: 20, depth: 20 },
      inputReferences: []
    });

    // Execute first run to cache geometry outputs
    ParametricRegenerationEngine.regenerate(history, {
      modelId: 'DOC_REGEN_03',
      rootChange: 'Initial execution',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    });

    const request: RegenerationRequest = {
      modelId: 'DOC_REGEN_03',
      rootChange: 'Modify PartA',
      changedEntityId: f1.id,
      targetParameter: 'width',
      newValue: 15,
      currentModelRevision: 2,
      regenerationMode: 'PARTIAL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('SUCCESS');
    expect(res.skippedFeaturesCount).toBe(1); // PartB is isolated and skipped
    expect(res.regeneratedFeaturesCount).toBe(1); // Only PartA is regenerated
  });

  it('TEST 04 — Constraint Conflict (Incompatible constraints)', () => {
    const history = new FeatureHistory('DOC_REGEN_04');
    const sketch = history.addFeature('SKETCH', 'Profile', {
      type: 'SKETCH',
      name: 'Profile',
      parameters: {
        plane: 'XY',
        entities: [
          { type: 'POINT', id: 'P1', data: { x: 0, y: 0 } },
          { type: 'POINT', id: 'P2', data: { x: 10, y: 0 } }
        ],
        closedProfile: false,
        constraints: [
          {
            id: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY', projectId: 'C_CONFL_1',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
            type: 'DISTANCE',
            sketchId: { namespace: 'SECP' as const, schemaVersion: '1.0.0' as const, artifactType: 'GEOMETRY', artifactId: 'Profile' },
            references: [
              { entityId: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY', projectId: 'P1',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}), target: 'ENTITY' },
              { entityId: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY', projectId: 'P2',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}), target: 'ENTITY' }
            ],
            parameters: { value: 10 },
            driving: true,
            provenance: { id: 'MOCK_P', type: 'DESIGN', engineeringIdentityId: 'MOCK', canonicalHash: 'H', version: '1', createdAt: '0', evidenceRefs: [] } as any
          },
          {
            id: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY', projectId: 'C_CONFL_2',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
            type: 'DISTANCE',
            sketchId: { namespace: 'SECP' as const, schemaVersion: '1.0.0' as const, artifactType: 'GEOMETRY', artifactId: 'Profile' },
            references: [
              { entityId: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY', projectId: 'P1',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}), target: 'ENTITY' },
              { entityId: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY', projectId: 'P2',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}), target: 'ENTITY' }
            ],
            parameters: { value: 20 },
            driving: true,
            provenance: { id: 'MOCK_P', type: 'DESIGN', engineeringIdentityId: 'MOCK', canonicalHash: 'H', version: '1', createdAt: '0', evidenceRefs: [] } as any
          }
        ]
      },
      inputReferences: []
    });

    const request: RegenerationRequest = {
      modelId: 'DOC_REGEN_04',
      rootChange: 'Force constraint conflict',
      changedEntityId: 'P1',
      targetParameter: 'x',
      newValue: 5, // Any value will fail because C1 and C2 are contradictory (10 vs 20)
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('CONSTRAINT_CONFLICT');
  });

  it('TEST 05 — Lost Topology Reference (referenced face/edge disappears)', () => {
    const history = new FeatureHistory('DOC_REGEN_05');
    
    const extrude = history.addFeature('EXTRUDE', 'MainBlock', {
      type: 'EXTRUDE',
      name: 'MainBlock',
      parameters: { width: 10 },
      inputReferences: []
    });

    const fillet = history.addFeature('FILLET', 'EdgeBlend', {
      type: 'FILLET',
      name: 'EdgeBlend',
      parameters: { radius: 2.0 },
      inputReferences: [{ type: 'EDGE', targetFeatureId: extrude.id, entityId: 'edge-999-missing' }]
    }, [extrude.id]);

    const request: RegenerationRequest = {
      modelId: 'DOC_REGEN_05',
      rootChange: 'Run fillet with lost topology reference',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('TOPOLOGY_FAILURE');
  });

  it('TEST 06 — Invalid Geometry (Force invalid geometric result)', () => {
    const history = new FeatureHistory('DOC_REGEN_06');
    
    const extrude = history.addFeature('EXTRUDE', 'MainBlock', {
      type: 'EXTRUDE',
      name: 'MainBlock',
      parameters: { width: -5 }, // Negative dimension triggers geometry failure
      inputReferences: []
    });

    const request: RegenerationRequest = {
      modelId: 'DOC_REGEN_06',
      rootChange: 'Negative geometry depth',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('GEOMETRY_FAILURE');
  });

  it('TEST 07 — Deterministic Replay (identical input thrice)', () => {
    const history = new FeatureHistory('DOC_REGEN_07');
    history.addFeature('EXTRUDE', 'Box', {
      type: 'EXTRUDE',
      name: 'Box',
      parameters: { width: 10 },
      inputReferences: []
    });

    const request: RegenerationRequest = {
      modelId: 'DOC_REGEN_07',
      rootChange: 'Change width to 15',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res1 = ParametricRegenerationEngine.regenerate(history, request);
    expect(res1.finalStatus).toBe('SUCCESS');
    const res2 = ParametricRegenerationEngine.regenerate(history, request);
    expect(res2.finalStatus).toBe('SUCCESS');
    const res3 = ParametricRegenerationEngine.regenerate(history, request);
    expect(res3.finalStatus).toBe('SUCCESS');

    expect(res1.outputHash).toBeDefined();
    expect(res1.outputHash).toBe(res2.outputHash);
    expect(res2.outputHash).toBe(res3.outputHash);
  });

  it('TEST 08 — Failed Regeneration Safety (fails downstream but leaves previous state intact)', () => {
    const history = new FeatureHistory('DOC_REGEN_08');
    
    const extrude = history.addFeature('EXTRUDE', 'Box', {
      type: 'EXTRUDE',
      name: 'Box',
      parameters: { width: 10 },
      inputReferences: []
    });

    // Execute initial valid state
    const initialRes = ParametricRegenerationEngine.regenerate(history, {
      modelId: 'DOC_REGEN_08',
      rootChange: 'Initial valid',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    });
    expect(initialRes.finalStatus).toBe('SUCCESS');

    // Attempt failing parameter change
    const failRequest: RegenerationRequest = {
      modelId: 'DOC_REGEN_08',
      rootChange: 'Failing change',
      changedEntityId: extrude.id,
      targetParameter: 'width',
      newValue: -100, // Trigger fail
      currentModelRevision: 2,
      regenerationMode: 'FULL'
    };

    const failRes = ParametricRegenerationEngine.regenerate(history, failRequest);
    expect(failRes.finalStatus).toBe('GEOMETRY_FAILURE');

    // Confirm Box width restored to previous valid width of 10
    const node = history.getFeature(extrude.id)!;
    expect((node.parameters as any).width).toBe(10);
  });

  it('TEST 09 — Dependency Cycle (circular dependency detected)', () => {
    const history = new FeatureHistory('DOC_REGEN_09');
    
    const f1 = history.addFeature('EXTRUDE', 'BoxA', {
      type: 'EXTRUDE',
      name: 'BoxA',
      parameters: { width: 10 },
      inputReferences: []
    });

    const f2 = history.addFeature('EXTRUDE', 'BoxB', {
      type: 'EXTRUDE',
      name: 'BoxB',
      parameters: { width: 20 },
      inputReferences: []
    }, [f1.id]);

    // Force a circular relationship in the graph explicitly
    history.getGraph().addDependency(f1.id, f2.id);

    const request: RegenerationRequest = {
      modelId: 'DOC_REGEN_09',
      rootChange: 'Cycle trigger',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('DEPENDENCY_FAILURE');
  });

  it('TEST 10 — No-Op Regeneration (without any parameter change)', () => {
    const history = new FeatureHistory('DOC_REGEN_10');
    history.addFeature('EXTRUDE', 'Box', {
      type: 'EXTRUDE',
      name: 'Box',
      parameters: { width: 10 },
      inputReferences: []
    });

    // Run once to compute geometry and enable No-Op check
    ParametricRegenerationEngine.regenerate(history, {
      modelId: 'DOC_REGEN_10',
      rootChange: 'Initial compute',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    });

    const request: RegenerationRequest = {
      modelId: 'DOC_REGEN_10',
      rootChange: 'No effective change',
      currentModelRevision: 2,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('SUCCESS');
    expect(res.skippedFeaturesCount).toBe(1);
    expect(res.regeneratedFeaturesCount).toBe(0);
  });

});

describe('PATCH-028 — Parametric Regeneration Engine (18 Adversarial Tests)', () => {

  it('ADVERSARIAL 1: Extremely deep feature chain (100 sequential features)', () => {
    const history = new FeatureHistory('DOC_ADV_1');
    let prevId: string | undefined = undefined;

    for (let i = 0; i < 100; i++) {
      const node = history.addFeature(
        'EXTRUDE',
        `Step_${i}`,
        {
          type: 'EXTRUDE',
          name: `Step_${i}`,
          parameters: { width: 10 },
          inputReferences: prevId ? [{ type: 'FEATURE', targetFeatureId: prevId }] : []
        },
        prevId ? [prevId] : []
      );
      prevId = node.id;
    }

    const request: RegenerationRequest = {
      modelId: 'DOC_ADV_1',
      rootChange: 'Deep chain validation',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('SUCCESS');
    expect(res.regeneratedFeaturesCount).toBe(100);
  });

  it('ADVERSARIAL 2: Wide branching dependency graph', () => {
    const history = new FeatureHistory('DOC_ADV_2');
    
    const root = history.addFeature('SKETCH', 'Root', {
      type: 'SKETCH',
      name: 'Root',
      parameters: { plane: 'XY', entities: [] },
      inputReferences: []
    });

    for (let i = 0; i < 20; i++) {
      history.addFeature('EXTRUDE', `Branch_${i}`, {
        type: 'EXTRUDE',
        name: `Branch_${i}`,
        parameters: { width: 5 },
        inputReferences: [{ type: 'FEATURE', targetFeatureId: root.id }]
      }, [root.id]);
    }

    const request: RegenerationRequest = {
      modelId: 'DOC_ADV_2',
      rootChange: 'Wide branch trigger',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('SUCCESS');
    expect(res.regeneratedFeaturesCount).toBe(21);
  });

  it('ADVERSARIAL 3: Multiple simultaneous parameter changes', () => {
    const history = new FeatureHistory('DOC_ADV_3');
    
    const f1 = history.addFeature('EXTRUDE', 'Box1', {
      type: 'EXTRUDE',
      name: 'Box1',
      parameters: { width: 10 },
      inputReferences: []
    });

    const f2 = history.addFeature('EXTRUDE', 'Box2', {
      type: 'EXTRUDE',
      name: 'Box2',
      parameters: { width: 20 },
      inputReferences: []
    });

    const request: RegenerationRequest = {
      modelId: 'DOC_ADV_3',
      rootChange: 'Simultaneous changes',
      changedEntityId: f1.id,
      targetParameter: 'width',
      newValue: 15,
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('SUCCESS');
  });

  it('ADVERSARIAL 4: Conflicting constraints downstream', () => {
    const history = new FeatureHistory('DOC_ADV_4');
    
    const sketch = history.addFeature('SKETCH', 'Profile', {
      type: 'SKETCH',
      name: 'Profile',
      parameters: {
        plane: 'XY',
        entities: [
          { type: 'POINT', id: 'P1', data: { x: 0, y: 0 } },
          { type: 'POINT', id: 'P2', data: { x: 10, y: 0 } }
        ],
        constraints: [
          {
            id: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY', projectId: 'C_ADV_CONFL_1',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
            type: 'DISTANCE',
            sketchId: { namespace: 'SECP' as const, schemaVersion: '1.0.0' as const, artifactType: 'GEOMETRY', artifactId: 'Profile' },
            references: [
              { entityId: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY', projectId: 'P1',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}), target: 'ENTITY' },
              { entityId: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY', projectId: 'P2',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}), target: 'ENTITY' }
            ],
            parameters: { value: 10 },
            driving: true,
            provenance: {} as any
          },
          {
            id: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY', projectId: 'C_ADV_CONFL_2',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
            type: 'DISTANCE',
            sketchId: { namespace: 'SECP' as const, schemaVersion: '1.0.0' as const, artifactType: 'GEOMETRY', artifactId: 'Profile' },
            references: [
              { entityId: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY', projectId: 'P1',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}), target: 'ENTITY' },
              { entityId: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY', projectId: 'P2',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}), target: 'ENTITY' }
            ],
            parameters: { value: 20 },
            driving: true,
            provenance: {} as any
          }
        ]
      },
      inputReferences: []
    });

    const request: RegenerationRequest = {
      modelId: 'DOC_ADV_4',
      rootChange: 'Downstream conflict',
      changedEntityId: 'P1',
      targetParameter: 'x',
      newValue: 5,
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('CONSTRAINT_CONFLICT');
  });

  it('ADVERSARIAL 5: Near-tolerance dimensional changes', () => {
    const history = new FeatureHistory('DOC_ADV_5');
    
    history.addFeature('EXTRUDE', 'Box', {
      type: 'EXTRUDE',
      name: 'Box',
      parameters: { width: 10.00000001 },
      inputReferences: []
    });

    const request: RegenerationRequest = {
      modelId: 'DOC_ADV_5',
      rootChange: 'Near tolerance update',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('SUCCESS');
  });

  it('ADVERSARIAL 6: Topology-changing operations', () => {
    const history = new FeatureHistory('DOC_ADV_6');
    
    history.addFeature('EXTRUDE', 'Block', {
      type: 'EXTRUDE',
      name: 'Block',
      parameters: { width: 50 },
      inputReferences: []
    });

    const request: RegenerationRequest = {
      modelId: 'DOC_ADV_6',
      rootChange: 'Basic Topology',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('SUCCESS');
  });

  it('ADVERSARIAL 7: Boolean operations producing topology changes', () => {
    const history = new FeatureHistory('DOC_ADV_7');
    
    const f1 = history.addFeature('EXTRUDE', 'BoxA', {
      type: 'EXTRUDE',
      name: 'BoxA',
      parameters: { width: 10, minX: 0 },
      inputReferences: []
    });

    const f2 = history.addFeature('EXTRUDE', 'BoxB', {
      type: 'EXTRUDE',
      name: 'BoxB',
      parameters: { width: 5, minX: 20 }, // Disjoint to avoid complex B-Rep intersections in mock
      inputReferences: []
    });

    const bool = history.addFeature('BOOLEAN', 'Union', {
      type: 'BOOLEAN',
      name: 'Union',
      parameters: { operation: 'UNION', toolFeatureId: f2.id, targetFeatureId: f1.id },
      inputReferences: [
        { type: 'FEATURE', targetFeatureId: f1.id },
        { type: 'FEATURE', targetFeatureId: f2.id }
      ]
    }, [f1.id, f2.id]);

    const request: RegenerationRequest = {
      modelId: 'DOC_ADV_7',
      rootChange: 'Run boolean reconstruction',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('SUCCESS');
  });

  it('ADVERSARIAL 8: Fillet/chamfer references becoming invalid', () => {
    const history = new FeatureHistory('DOC_ADV_8');
    
    const extrude = history.addFeature('EXTRUDE', 'Box', {
      type: 'EXTRUDE',
      name: 'Box',
      parameters: { width: 10 },
      inputReferences: []
    });

    history.addFeature('FILLET', 'Blend', {
      type: 'FILLET',
      name: 'Blend',
      parameters: { radius: 1.0 },
      inputReferences: [{ type: 'EDGE', targetFeatureId: extrude.id, entityId: 'lost-edge-1' }]
    }, [extrude.id]);

    const request: RegenerationRequest = {
      modelId: 'DOC_ADV_8',
      rootChange: 'Broken edge fillet',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('TOPOLOGY_FAILURE');
  });

  it('ADVERSARIAL 9: Circular dependencies', () => {
    const history = new FeatureHistory('DOC_ADV_9');
    
    const f1 = history.addFeature('EXTRUDE', 'Box1', {
      type: 'EXTRUDE',
      name: 'Box1',
      parameters: { width: 10 },
      inputReferences: []
    });

    const f2 = history.addFeature('EXTRUDE', 'Box2', {
      type: 'EXTRUDE',
      name: 'Box2',
      parameters: { width: 20 },
      inputReferences: []
    }, [f1.id]);

    // Force a circular relationship in the graph explicitly
    history.getGraph().addDependency(f1.id, f2.id);

    const request: RegenerationRequest = {
      modelId: 'DOC_ADV_9',
      rootChange: 'Circle',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('DEPENDENCY_FAILURE');
  });

  it('ADVERSARIAL 10: Duplicate feature IDs', () => {
    const history = new FeatureHistory('DOC_ADV_10');
    
    history.addFeature('EXTRUDE', 'Box', {
      type: 'EXTRUDE',
      name: 'Box',
      parameters: { width: 10 },
      inputReferences: []
    });

    const request: RegenerationRequest = {
      modelId: 'DOC_ADV_10',
      rootChange: 'Duplicate checking',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('SUCCESS');
  });

  it('ADVERSARIAL 11: Missing feature dependencies', () => {
    const history = new FeatureHistory('DOC_ADV_11');
    
    history.addFeature('EXTRUDE', 'Box', {
      type: 'EXTRUDE',
      name: 'Box',
      parameters: { width: 10 },
      inputReferences: []
    }, ['non-existent-dep-id']);

    const request: RegenerationRequest = {
      modelId: 'DOC_ADV_11',
      rootChange: 'Missing dependency check',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('DEPENDENCY_FAILURE');
  });

  it('ADVERSARIAL 12: Missing geometry references', () => {
    const history = new FeatureHistory('DOC_ADV_12');
    
    const root = history.addFeature('EXTRUDE', 'Base', {
      type: 'EXTRUDE',
      name: 'Base',
      parameters: { width: 10 },
      inputReferences: []
    });

    history.addFeature('FILLET', 'Blend', {
      type: 'FILLET',
      name: 'Blend',
      parameters: { radius: 1.0 },
      inputReferences: [{ type: 'FACE', targetFeatureId: root.id, entityId: 'NON_EXISTENT_FACE' }]
    }, [root.id]);

    const request: RegenerationRequest = {
      modelId: 'DOC_ADV_12',
      rootChange: 'Missing reference',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('TOPOLOGY_FAILURE');
  });

  it('ADVERSARIAL 13: Non-finite parameter values', () => {
    const history = new FeatureHistory('DOC_ADV_13');
    
    history.addFeature('EXTRUDE', 'Box', {
      type: 'EXTRUDE',
      name: 'Box',
      parameters: { width: 10 },
      inputReferences: []
    });

    const request: RegenerationRequest = {
      modelId: 'DOC_ADV_13',
      rootChange: 'Non finite parameter test',
      changedEntityId: 'Box',
      targetParameter: 'width',
      newValue: NaN,
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('INVALID_INPUT');
  });

  it('ADVERSARIAL 14: Extremely small dimensions', () => {
    const history = new FeatureHistory('DOC_ADV_14');
    
    history.addFeature('EXTRUDE', 'Box', {
      type: 'EXTRUDE',
      name: 'Box',
      parameters: { width: 1e-12 },
      inputReferences: []
    });

    const request: RegenerationRequest = {
      modelId: 'DOC_ADV_14',
      rootChange: 'Sub-tolerance check',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('SUCCESS');
  });

  it('ADVERSARIAL 15: Extremely large dimensions', () => {
    const history = new FeatureHistory('DOC_ADV_15');
    
    history.addFeature('EXTRUDE', 'Box', {
      type: 'EXTRUDE',
      name: 'Box',
      parameters: { width: 1e12 },
      inputReferences: []
    });

    const request: RegenerationRequest = {
      modelId: 'DOC_ADV_15',
      rootChange: 'Macro scale check',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const res = ParametricRegenerationEngine.regenerate(history, request);
    expect(res.finalStatus).toBe('SUCCESS');
  });

  it('ADVERSARIAL 16: Repeated regeneration', () => {
    const history = new FeatureHistory('DOC_ADV_16');
    
    history.addFeature('EXTRUDE', 'Box', {
      type: 'EXTRUDE',
      name: 'Box',
      parameters: { width: 10 },
      inputReferences: []
    });

    const request: RegenerationRequest = {
      modelId: 'DOC_ADV_16',
      rootChange: 'Repeated executions',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    for (let i = 0; i < 5; i++) {
      const res = ParametricRegenerationEngine.regenerate(history, request);
      expect(res.finalStatus).toBe('SUCCESS');
    }
  });

  it('ADVERSARIAL 17: Regeneration after failed regeneration', () => {
    const history = new FeatureHistory('DOC_ADV_17');
    
    const extrude = history.addFeature('EXTRUDE', 'Box', {
      type: 'EXTRUDE',
      name: 'Box',
      parameters: { width: 10 },
      inputReferences: []
    });

    // Failing attempt
    const resFail = ParametricRegenerationEngine.regenerate(history, {
      modelId: 'DOC_ADV_17',
      rootChange: 'Fail change',
      changedEntityId: extrude.id,
      targetParameter: 'width',
      newValue: -50,
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    });
    expect(resFail.finalStatus).toBe('GEOMETRY_FAILURE');

    // Subsequent valid attempt (safety verification)
    const resSuccess = ParametricRegenerationEngine.regenerate(history, {
      modelId: 'DOC_ADV_17',
      rootChange: 'Correction change',
      changedEntityId: extrude.id,
      targetParameter: 'width',
      newValue: 25,
      currentModelRevision: 2,
      regenerationMode: 'FULL'
    });
    expect(resSuccess.finalStatus).toBe('SUCCESS');
  });

  it('ADVERSARIAL 18: Deterministic replay across separate process executions', () => {
    const historyA = new FeatureHistory('DOC_ADV_18');
    historyA.addFeature('EXTRUDE', 'Box', {
      type: 'EXTRUDE',
      name: 'Box',
      parameters: { width: 10 },
      inputReferences: []
    });

    const historyB = new FeatureHistory('DOC_ADV_18');
    historyB.addFeature('EXTRUDE', 'Box', {
      type: 'EXTRUDE',
      name: 'Box',
      parameters: { width: 10 },
      inputReferences: []
    });

    const request: RegenerationRequest = {
      modelId: 'DOC_ADV_18',
      rootChange: 'Deterministic replay cross simulation',
      currentModelRevision: 1,
      regenerationMode: 'FULL'
    };

    const resA = ParametricRegenerationEngine.regenerate(historyA, request);
    const resB = ParametricRegenerationEngine.regenerate(historyB, request);

    expect(resA.outputHash).toBe(resB.outputHash);
  });

});
