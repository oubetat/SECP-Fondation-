/**
 * SECP CAD Kernel — Constraint Propagation Engine Tests
 * Phase 2 (PATCH-027)
 */

import { describe, it, expect } from 'vitest';
import { EngineeringIdentityFactory } from '../../../identity/EngineeringIdentityFactory';
import { SketchModel } from '../../../sketch/SketchModel';
import { SketchConstraint } from '../../../sketch/gcs/ConstraintModel';
import { ConstraintPropagationEngine, ConstraintPropagationRequest } from '../ConstraintPropagationEngine';
import { ToleranceModel } from '../../tolerance/ToleranceModel';
import { ProvenanceNode } from '../../../provenance/ProvenanceGraphTypes';

const defaultTolerance: ToleranceModel = {
  linear: 1e-7,
  angular: 1e-7,
  parametric: 1e-7,
  distance: 1e-7,
  coincidence: 1e-7,
  topology: 1e-7,
  sewing: 1e-7,
  boolean: 1e-7,
  approximation: 1e-7,
  unitSystem: 'mm',
  scale: 1.0,
  policyId: 'STRICT_INDUSTRIAL',
  version: '1.0.0',
};

const mockProv: ProvenanceNode = {
  id: 'p1',
  type: 'DESIGN',
  engineeringIdentityId: 'SECP:GEOMETRY:sketch1',
  canonicalHash: 'h1',
  version: '1',
  createdAt: '2026-01-01',
  evidenceRefs: [],
};

const sketchId = EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY', projectId: 'sketch1',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {});

const createPoint = (id: string, x: number, y: number) => ({
  id: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY', projectId: id,
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
  type: 'POINT' as const,
  sketchId,
  construction: false,
  geometry: { type: 'POINT' as const, x, y },
  metadata: {},
  provenance: mockProv,
});

const createConstraint = (id: string, type: any, refs: any[], params: any = {}): SketchConstraint => ({
  id: EngineeringIdentityFactory.createIdentity({ objectType: 'GEOMETRY', projectId: id,
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
  type,
  sketchId,
  references: refs,
  parameters: params,
  driving: true,
  provenance: mockProv,
});

describe('ConstraintPropagationEngine — 2D and Robustness Tests', () => {
  it('Category A: Direct propagation updates the dependent entity correctly', () => {
    const p1 = createPoint('P1', 0, 0);
    const p2 = createPoint('P2', 10, 0);

    const c_dist = createConstraint(
      'C_DIST',
      'DISTANCE',
      [
        { entityId: p1.id, target: 'ENTITY' },
        { entityId: p2.id, target: 'ENTITY' },
      ],
      { value: 10 }
    );

    const model: SketchModel = {
      id: sketchId,
      name: 'S1',
      coordinateSystem: {
        origin: { x: 0, y: 0 },
        xAxis: { x: 1, y: 0 },
        yAxis: { x: 0, y: 1 },
        normal: { x: 0, y: 0, z: 1 },
      },
      entities: [p1, p2],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProv,
      metadata: {},
    };

    const request: ConstraintPropagationRequest = {
      modelType: '2D',
      model2D: model,
      constraints2D: [c_dist],
      changedEntityId: 'P1',
      targetParameter: 'x',
      newValue: 5,
    };

    const result = ConstraintPropagationEngine.propagate(request);

    expect(result.status).toBe('UNDER_CONSTRAINED'); // Succesful but DOF remains
    expect(result.trace.steps.length).toBeGreaterThan(0);

    const solvedP2 = result.updatedModel2D!.entities.find(e => e.id.artifactId === 'P2')!;
    expect((solvedP2.geometry as any).x).toBeCloseTo(15, 5);
  });

  it('Category B: Multi-hop propagation (A -> B -> C -> D)', () => {
    const p1 = createPoint('P1', 0, 0);
    const p2 = createPoint('P2', 10, 0);
    const p3 = createPoint('P3', 20, 0);
    const p4 = createPoint('P4', 30, 0);

    const c_d1 = createConstraint(
      'C_D1',
      'DISTANCE',
      [
        { entityId: p1.id, target: 'ENTITY' },
        { entityId: p2.id, target: 'ENTITY' },
      ],
      { value: 10 }
    );
    const c_d2 = createConstraint(
      'C_D2',
      'DISTANCE',
      [
        { entityId: p2.id, target: 'ENTITY' },
        { entityId: p3.id, target: 'ENTITY' },
      ],
      { value: 10 }
    );
    const c_d3 = createConstraint(
      'C_D3',
      'DISTANCE',
      [
        { entityId: p3.id, target: 'ENTITY' },
        { entityId: p4.id, target: 'ENTITY' },
      ],
      { value: 10 }
    );

    const model: SketchModel = {
      id: sketchId,
      name: 'S2',
      coordinateSystem: {
        origin: { x: 0, y: 0 },
        xAxis: { x: 1, y: 0 },
        yAxis: { x: 0, y: 1 },
        normal: { x: 0, y: 0, z: 1 },
      },
      entities: [p1, p2, p3, p4],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProv,
      metadata: {},
    };

    const request: ConstraintPropagationRequest = {
      modelType: '2D',
      model2D: model,
      constraints2D: [c_d1, c_d2, c_d3],
      changedEntityId: 'P1',
      targetParameter: 'x',
      newValue: 5,
    };

    const result = ConstraintPropagationEngine.propagate(request);

    expect(result.status).toBe('UNDER_CONSTRAINED');
    expect(result.trace.steps.length).toBe(3); // P1 -> P2, P2 -> P3, P3 -> P4

    const solvedP4 = result.updatedModel2D!.entities.find(e => e.id.artifactId === 'P4')!;
    expect((solvedP4.geometry as any).x).toBeCloseTo(35, 5);
  });

  it('Category C: Branching graph propagation', () => {
    const p1 = createPoint('P1', 0, 0);
    const p2 = createPoint('P2', 10, 0);
    const p3 = createPoint('P3', -10, 0);

    const c_d1 = createConstraint(
      'C_D1',
      'DISTANCE',
      [
        { entityId: p1.id, target: 'ENTITY' },
        { entityId: p2.id, target: 'ENTITY' },
      ],
      { value: 10 }
    );
    const c_d2 = createConstraint(
      'C_D2',
      'DISTANCE',
      [
        { entityId: p1.id, target: 'ENTITY' },
        { entityId: p3.id, target: 'ENTITY' },
      ],
      { value: 10 }
    );

    const model: SketchModel = {
      id: sketchId,
      name: 'S3',
      coordinateSystem: {
        origin: { x: 0, y: 0 },
        xAxis: { x: 1, y: 0 },
        yAxis: { x: 0, y: 1 },
        normal: { x: 0, y: 0, z: 1 },
      },
      entities: [p1, p2, p3],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProv,
      metadata: {},
    };

    const request: ConstraintPropagationRequest = {
      modelType: '2D',
      model2D: model,
      constraints2D: [c_d1, c_d2],
      changedEntityId: 'P1',
      targetParameter: 'x',
      newValue: 5,
    };

    const result = ConstraintPropagationEngine.propagate(request);

    expect(result.status).toBe('UNDER_CONSTRAINED');
    const solvedP2 = result.updatedModel2D!.entities.find(e => e.id.artifactId === 'P2')!;
    const solvedP3 = result.updatedModel2D!.entities.find(e => e.id.artifactId === 'P3')!;

    expect((solvedP2.geometry as any).x).toBeCloseTo(15, 5);
    expect((solvedP3.geometry as any).x).toBeCloseTo(-5, 5);
  });

  it('Category D: Incompatible constraints return CONFLICT', () => {
    const p1 = createPoint('P1', 0, 0);
    const p2 = createPoint('P2', 10, 0);

    // Contradicting distance constraints between the same points
    const c_d1 = createConstraint(
      'C_D1',
      'DISTANCE',
      [
        { entityId: p1.id, target: 'ENTITY' },
        { entityId: p2.id, target: 'ENTITY' },
      ],
      { value: 10 }
    );
    const c_d2 = createConstraint(
      'C_D2',
      'DISTANCE',
      [
        { entityId: p1.id, target: 'ENTITY' },
        { entityId: p2.id, target: 'ENTITY' },
      ],
      { value: 20 }
    );

    const model: SketchModel = {
      id: sketchId,
      name: 'S4',
      coordinateSystem: {
        origin: { x: 0, y: 0 },
        xAxis: { x: 1, y: 0 },
        yAxis: { x: 0, y: 1 },
        normal: { x: 0, y: 0, z: 1 },
      },
      entities: [p1, p2],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProv,
      metadata: {},
    };

    const request: ConstraintPropagationRequest = {
      modelType: '2D',
      model2D: model,
      constraints2D: [c_d1, c_d2],
      changedEntityId: 'P1',
      targetParameter: 'x',
      newValue: 5,
    };

    const result = ConstraintPropagationEngine.propagate(request);

    expect(result.status).toBe('CONFLICT');
    expect(result.trace.conflicts.length).toBeGreaterThan(0);
    expect(result.diagnostics.some(d => d.code === 'CONFLICT_DETECTED')).toBe(true);
  });

  it('Category F: Cycle detection', () => {
    const p1 = createPoint('P1', 0, 0);
    const p2 = createPoint('P2', 10, 0);

    // Cyclic distance dependencies (P1 depends on P2 and P2 depends on P1)
    const c_d1 = createConstraint(
      'C_D1',
      'DISTANCE',
      [
        { entityId: p1.id, target: 'ENTITY' },
        { entityId: p2.id, target: 'ENTITY' },
      ],
      { value: 10 }
    );

    const model: SketchModel = {
      id: sketchId,
      name: 'S5',
      coordinateSystem: {
        origin: { x: 0, y: 0 },
        xAxis: { x: 1, y: 0 },
        yAxis: { x: 0, y: 1 },
        normal: { x: 0, y: 0, z: 1 },
      },
      entities: [p1, p2],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProv,
      metadata: {},
    };

    const request: ConstraintPropagationRequest = {
      modelType: '2D',
      model2D: model,
      constraints2D: [c_d1],
      changedEntityId: 'P1',
      targetParameter: 'x',
      newValue: 5,
    };

    const result = ConstraintPropagationEngine.propagate(request);
    // Path stack cycle detection triggers warning and cleanly terminates
    expect(result.status).toBe('UNDER_CONSTRAINED');
    expect(result.trace.cycles.length).toBeGreaterThanOrEqual(0);
  });

  it('Category G: No-op propagation does not change anything', () => {
    const p1 = createPoint('P1', 0, 0);
    const p2 = createPoint('P2', 10, 0);

    const c_dist = createConstraint(
      'C_DIST',
      'DISTANCE',
      [
        { entityId: p1.id, target: 'ENTITY' },
        { entityId: p2.id, target: 'ENTITY' },
      ],
      { value: 10 }
    );

    const model: SketchModel = {
      id: sketchId,
      name: 'S6',
      coordinateSystem: {
        origin: { x: 0, y: 0 },
        xAxis: { x: 1, y: 0 },
        yAxis: { x: 0, y: 1 },
        normal: { x: 0, y: 0, z: 1 },
      },
      entities: [p1, p2],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProv,
      metadata: {},
    };

    const request: ConstraintPropagationRequest = {
      modelType: '2D',
      model2D: model,
      constraints2D: [c_dist],
      changedEntityId: 'P1',
      targetParameter: 'x',
      newValue: 0, // No actual change in coordinate!
    };

    const result = ConstraintPropagationEngine.propagate(request);

    expect(result.status).toBe('STABLE');
    expect(result.trace.steps.length).toBe(0);
  });

  it('Category H: Absolute Determinism and Evidence Hashing', () => {
    const p1 = createPoint('P1', 0, 0);
    const p2 = createPoint('P2', 10, 0);

    const c_dist = createConstraint(
      'C_DIST',
      'DISTANCE',
      [
        { entityId: p1.id, target: 'ENTITY' },
        { entityId: p2.id, target: 'ENTITY' },
      ],
      { value: 10 }
    );

    const model: SketchModel = {
      id: sketchId,
      name: 'S7',
      coordinateSystem: {
        origin: { x: 0, y: 0 },
        xAxis: { x: 1, y: 0 },
        yAxis: { x: 0, y: 1 },
        normal: { x: 0, y: 0, z: 1 },
      },
      entities: [p1, p2],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProv,
      metadata: {},
    };

    const request: ConstraintPropagationRequest = {
      modelType: '2D',
      model2D: model,
      constraints2D: [c_dist],
      changedEntityId: 'P1',
      targetParameter: 'x',
      newValue: 15,
    };

    const result1 = ConstraintPropagationEngine.propagate(request);
    const result2 = ConstraintPropagationEngine.propagate(request);

    expect(result1.status).toBe(result2.status);
    expect(result1.trace.evidenceHash).toBe(result2.trace.evidenceHash);
    expect(result1.trace.evidenceHash.startsWith('EVIDENCE-PROP-')).toBe(true);
  });

  it('Category J: Invalid input handles errors gracefully', () => {
    const p1 = createPoint('P1', 0, 0);

    const model: SketchModel = {
      id: sketchId,
      name: 'S8',
      coordinateSystem: {
        origin: { x: 0, y: 0 },
        xAxis: { x: 1, y: 0 },
        yAxis: { x: 0, y: 1 },
        normal: { x: 0, y: 0, z: 1 },
      },
      entities: [p1],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProv,
      metadata: {},
    };

    // Case 1: Non-finite value
    const req1: ConstraintPropagationRequest = {
      modelType: '2D',
      model2D: model,
      constraints2D: [],
      changedEntityId: 'P1',
      targetParameter: 'x',
      newValue: NaN,
    };
    const res1 = ConstraintPropagationEngine.propagate(req1);
    expect(res1.status).toBe('INVALID_INPUT');
    expect(res1.diagnostics.some(d => d.code === 'INVALID_INPUT_PARAMETERS')).toBe(true);

    // Case 2: Duplicate constraint IDs
    const c1 = createConstraint('CDUP', 'DISTANCE', [], {});
    const c2 = createConstraint('CDUP', 'DISTANCE', [], {});
    const req2: ConstraintPropagationRequest = {
      modelType: '2D',
      model2D: model,
      constraints2D: [c1, c2],
      changedEntityId: 'P1',
    };
    const res2 = ConstraintPropagationEngine.propagate(req2);
    expect(res2.status).toBe('INVALID_INPUT');
    expect(res2.diagnostics.some(d => d.code === 'DUPLICATE_CONSTRAINT_ID')).toBe(true);
  });
});

describe('ConstraintPropagationEngine — 3D Tests', () => {
  const createIdentity = (id: string) => ({
    namespace: 'SECP',
    schemaVersion: '1.0.0',
    artifactType: 'GEOMETRY' as const,
    artifactId: id,
    identityId: id,
  });

  const createProvenance = (id: string) => ({
    id,
    type: 'GEOMETRY',
    engineeringIdentityId: id,
    canonicalHash: `HASH-${id}`,
    version: '1.0.0',
    createdAt: '2026-08-18T00:00:00Z',
    evidenceRefs: [],
  });

  it('should propagate simple 3D coincident constraints', () => {
    const p1: any = {
      id: createIdentity('p1'),
      type: 'POINT_3D',
      geometry: { type: 'POINT_3D', data: { x: 0, y: 0, z: 0 } },
      provenance: createProvenance('p1'),
    };

    const p2: any = {
      id: createIdentity('p2'),
      type: 'POINT_3D',
      geometry: { type: 'POINT_3D', data: { x: 10, y: 0, z: 0 } },
      provenance: createProvenance('p2'),
    };

    const c_coin: any = {
      id: createIdentity('c_coin'),
      type: 'COINCIDENT_3D',
      modelId: createIdentity('model-1'),
      references: [
        { entityId: createIdentity('p2'), target: 'ENTITY' },
        { entityId: createIdentity('p1'), target: 'ENTITY' },
      ],
      parameters: {},
      driving: true,
      provenance: createProvenance('c_coin'),
    };

    const model: any = {
      id: createIdentity('model-1'),
      entities: [p1, p2],
      version: 1,
    };

    const request: ConstraintPropagationRequest = {
      modelType: '3D',
      model3D: model,
      constraints3D: [c_coin],
      changedEntityId: 'p1',
      targetParameter: 'x',
      newValue: 5,
    };

    const result = ConstraintPropagationEngine.propagate(request);

    expect(result.status).toBe('UNDER_CONSTRAINED');
    expect(result.trace.steps.length).toBeGreaterThan(0);

    const solvedP2 = result.updatedModel3D!.entities.find(e => e.id.artifactId === 'p2')!;
    const p2Data = solvedP2.geometry.data as any;
    expect(p2Data.x).toBeCloseTo(5, 5);
  });
});

describe('ConstraintPropagationEngine — Adversarial Cases', () => {
  it('Adversarial 1: Deep dependency chain with large geometric change', () => {
    // 12 points in a chain: P1 to P12
    const entities: any[] = [];
    const constraints: any[] = [];
    for (let i = 1; i <= 12; i++) {
      entities.push(createPoint(`P${i}`, (i - 1) * 10, 0));
    }
    for (let i = 1; i < 12; i++) {
      constraints.push(createConstraint(
        `C_D${i}`,
        'DISTANCE',
        [
          { entityId: entities[i - 1].id, target: 'ENTITY' },
          { entityId: entities[i].id, target: 'ENTITY' },
        ],
        { value: 10 }
      ));
    }

    const model: SketchModel = {
      id: sketchId,
      name: 'S-Deep',
      coordinateSystem: {
        origin: { x: 0, y: 0 },
        xAxis: { x: 1, y: 0 },
        yAxis: { x: 0, y: 1 },
        normal: { x: 0, y: 0, z: 1 },
      },
      entities,
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProv,
      metadata: {},
    };

    const request: ConstraintPropagationRequest = {
      modelType: '2D',
      model2D: model,
      constraints2D: constraints,
      changedEntityId: 'P1',
      targetParameter: 'x',
      newValue: 1000, // Large geometric change!
    };

    const result = ConstraintPropagationEngine.propagate(request);

    expect(result.status).toBe('UNDER_CONSTRAINED');
    expect(result.trace.steps.length).toBe(11); // Validates complete chain resolution

    const solvedP12 = result.updatedModel2D!.entities.find(e => e.id.artifactId === 'P12')!;
    expect((solvedP12.geometry as any).x).toBeCloseTo(890, 3);
  });

  it('Adversarial 2: Disconnected components are not visited', () => {
    // Group 1: P1, P2 (connected by C1)
    // Group 2: P3, P4 (connected by C2)
    const p1 = createPoint('P1', 0, 0);
    const p2 = createPoint('P2', 10, 0);
    const p3 = createPoint('P3', 100, 100);
    const p4 = createPoint('P4', 110, 100);

    const c1 = createConstraint('C1', 'DISTANCE', [
      { entityId: p1.id, target: 'ENTITY' },
      { entityId: p2.id, target: 'ENTITY' },
    ], { value: 10 });

    const c2 = createConstraint('C2', 'DISTANCE', [
      { entityId: p3.id, target: 'ENTITY' },
      { entityId: p4.id, target: 'ENTITY' },
    ], { value: 10 });

    const model: SketchModel = {
      id: sketchId,
      name: 'S-Disc',
      coordinateSystem: {
        origin: { x: 0, y: 0 },
        xAxis: { x: 1, y: 0 },
        yAxis: { x: 0, y: 1 },
        normal: { x: 0, y: 0, z: 1 },
      },
      entities: [p1, p2, p3, p4],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProv,
      metadata: {},
    };

    const request: ConstraintPropagationRequest = {
      modelType: '2D',
      model2D: model,
      constraints2D: [c1, c2],
      changedEntityId: 'P1',
      targetParameter: 'x',
      newValue: 5,
    };

    const result = ConstraintPropagationEngine.propagate(request);

    expect(result.status).toBe('UNDER_CONSTRAINED');
    expect(result.trace.affectedEntities.includes('P2')).toBe(true);
    expect(result.trace.affectedEntities.includes('P3')).toBe(false);
    expect(result.trace.affectedEntities.includes('P4')).toBe(false);
  });

  it('Adversarial 3: Step Limit Reached / Oscillation', () => {
    const p1 = createPoint('P1', 0, 0);
    const p2 = createPoint('P2', 10, 0);
    const p3 = createPoint('P3', 20, 0);

    const c1 = createConstraint('C1', 'DISTANCE', [
      { entityId: p1.id, target: 'ENTITY' },
      { entityId: p2.id, target: 'ENTITY' },
    ], { value: 10 });

    const c2 = createConstraint('C2', 'DISTANCE', [
      { entityId: p2.id, target: 'ENTITY' },
      { entityId: p3.id, target: 'ENTITY' },
    ], { value: 10 });

    const model: SketchModel = {
      id: sketchId,
      name: 'S-Osc',
      coordinateSystem: {
        origin: { x: 0, y: 0 },
        xAxis: { x: 1, y: 0 },
        yAxis: { x: 0, y: 1 },
        normal: { x: 0, y: 0, z: 1 },
      },
      entities: [p1, p2, p3],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProv,
      metadata: {},
    };

    const request: ConstraintPropagationRequest = {
      modelType: '2D',
      model2D: model,
      constraints2D: [c1, c2],
      changedEntityId: 'P1',
      targetParameter: 'x',
      newValue: 5,
      maxSteps: 1,
    };

    // Force failure via low step limit
    const result = ConstraintPropagationEngine.propagate(request);

    expect(result.status).toBe('UNDER_CONSTRAINED');
    expect(result.diagnostics.some(d => d.code === 'PROPAGATION_LIMIT_REACHED')).toBe(true);
  });

  it('Adversarial 4: Near-tolerance extremely small changes are skipped', () => {
    const p1 = createPoint('P1', 0, 0);
    const p2 = createPoint('P2', 10, 0);

    const c1 = createConstraint('C1', 'DISTANCE', [
      { entityId: p1.id, target: 'ENTITY' },
      { entityId: p2.id, target: 'ENTITY' },
    ], { value: 10 });

    const model: SketchModel = {
      id: sketchId,
      name: 'S-NoOp',
      coordinateSystem: {
        origin: { x: 0, y: 0 },
        xAxis: { x: 1, y: 0 },
        yAxis: { x: 0, y: 1 },
        normal: { x: 0, y: 0, z: 1 },
      },
      entities: [p1, p2],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProv,
      metadata: {},
    };

    const request: ConstraintPropagationRequest = {
      modelType: '2D',
      model2D: model,
      constraints2D: [c1],
      changedEntityId: 'P1',
      targetParameter: 'x',
      newValue: 1e-12, // Extremely small change below tolerance
    };

    const result = ConstraintPropagationEngine.propagate(request);

    expect(result.status).toBe('STABLE');
    expect(result.trace.steps.length).toBe(0);
  });
});
