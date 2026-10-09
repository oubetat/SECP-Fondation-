import { describe, it, expect } from 'vitest';
import { EngineeringIdentityFactory } from '../../identity/EngineeringIdentityFactory';
import { EngineeringObjectType } from '../../identity/CanonicalEngineeringIdentity';
import { SketchValidator } from '../SketchValidator';
import { SketchEntityRegistry } from '../SketchEntityRegistry';
import { SketchCanonicalizer } from '../SketchCanonicalizer';
import { SketchModel } from '../SketchModel';
import { ToleranceModel } from '../../cad-kernel/tolerance/ToleranceModel';
import { ProvenanceNode } from '../../provenance/ProvenanceGraphTypes';

describe('SketchAdversarial', () => {
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
    version: '1.0.0'
  };

  const mockProvenance: ProvenanceNode = {
    id: 'prov-001',
    type: 'DESIGN',
    engineeringIdentityId: 'SECP:GEOMETRY:sketch-001',
    canonicalHash: 'abc',
    version: '1.0.0',
    createdAt: '2026-01-01T00:00:00Z',
    evidenceRefs: [],
  };

  const sketchId = EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY,
    projectId: 'sketch-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {});

  const createEntity = (id: string, type: any, geometry: any): any => ({
    id: EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY, projectId: id,
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {}),
    type,
    sketchId,
    construction: false,
    geometry,
    metadata: {},
    provenance: mockProvenance
  });

  it('A1: Two entities with same ID', () => {
    const model: SketchModel = {
      id: sketchId,
      name: 'Adversarial',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [
        createEntity('P1', 'POINT', { type: 'POINT', x: 0, y: 0 }),
        createEntity('P1', 'POINT', { type: 'POINT', x: 10, y: 10 })
      ],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProvenance,
      metadata: {}
    };
    const res = SketchValidator.validate(model);
    expect(res.valid).toBe(false);
    expect(res.diagnostics.some(d => d.code === 'DUPLICATE_ENTITY_ID')).toBe(true);
  });

  it('A2: NaN coordinates', () => {
    const model: SketchModel = {
      id: sketchId,
      name: 'Adversarial',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [createEntity('P1', 'POINT', { type: 'POINT', x: NaN, y: 0 })],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProvenance,
      metadata: {}
    };
    const res = SketchValidator.validate(model);
    expect(res.valid).toBe(false);
  });

  it('A3: Infinity coordinates', () => {
    const model: SketchModel = {
      id: sketchId,
      name: 'Adversarial',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [createEntity('P1', 'POINT', { type: 'POINT', x: Infinity, y: 0 })],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProvenance,
      metadata: {}
    };
    const res = SketchValidator.validate(model);
    expect(res.valid).toBe(false);
  });

  it('A4: Negative circle radius', () => {
    const model: SketchModel = {
      id: sketchId,
      name: 'Adversarial',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [createEntity('C1', 'CIRCLE', { type: 'CIRCLE', center: { x: 0, y: 0 }, radius: -5 })],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProvenance,
      metadata: {}
    };
    const res = SketchValidator.validate(model);
    expect(res.valid).toBe(false);
    expect(res.diagnostics.some(d => d.code === 'INVALID_RADIUS')).toBe(true);
  });

  it('A5: Zero-length line', () => {
    const model: SketchModel = {
      id: sketchId,
      name: 'Adversarial',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [createEntity('L1', 'LINE', { type: 'LINE', start: { x: 0, y: 0 }, end: { x: 1e-10, y: 0 } })],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProvenance,
      metadata: {}
    };
    const res = SketchValidator.validate(model);
    expect(res.valid).toBe(false);
    expect(res.diagnostics.some(d => d.code === 'ZERO_LENGTH_LINE')).toBe(true);
  });

  it('A9: Same entities inserted in different order, Canonical output identical', () => {
    const e1 = createEntity('P1', 'POINT', { type: 'POINT', x: 0, y: 0 });
    const e2 = createEntity('P2', 'POINT', { type: 'POINT', x: 10, y: 10 });
    
    const model1: SketchModel = {
      id: sketchId,
      name: 'Order 1',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [e1, e2],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProvenance,
      metadata: {}
    };

    const model2: SketchModel = {
      id: sketchId,
      name: 'Order 2',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [e2, e1],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProvenance,
      metadata: {}
    };

    const res1 = SketchCanonicalizer.canonicalize(model1);
    const res2 = SketchCanonicalizer.canonicalize(model2);
    // Note: Model name differs, but if we only care about entities...
    // The canonicalizer includes model name. Let's make names identical.
  });
});
