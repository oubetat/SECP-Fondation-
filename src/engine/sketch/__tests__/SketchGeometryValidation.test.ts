import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringIdentityFactory } from '../../identity/EngineeringIdentityFactory';
import { EngineeringObjectType } from '../../identity/CanonicalEngineeringIdentity';
import { SketchValidator } from '../SketchValidator';
import { SketchEntity } from '../SketchEntity';
import { SketchModel } from '../SketchModel';
import { ToleranceModel } from '../../cad-kernel/tolerance/ToleranceModel';
import { ProvenanceNode } from '../../provenance/ProvenanceGraphTypes';

describe('SketchEntityModel', () => {
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
    createdAt: new Date().toISOString(),
    evidenceRefs: [],
  };

  const sketchId = EngineeringIdentityFactory.createIdentity({ objectType: EngineeringObjectType.GEOMETRY,
    projectId: 'sketch-001',
        revisionId: "rev-01",
        createdBy: "system",
        seed: "seed" }, {});

  const createEntity = (id: string, type: any, geometry: any): SketchEntity => ({
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

  it('TEST 01: Create a valid SketchModel', () => {
    const model: SketchModel = {
      id: sketchId,
      name: 'Base Sketch',
      coordinateSystem: {
        origin: { x: 0, y: 0 },
        xAxis: { x: 1, y: 0 },
        yAxis: { x: 0, y: 1 },
        normal: { x: 0, y: 0, z: 1 }
      },
      entities: [
        createEntity('P1', 'POINT', { type: 'POINT', x: 10, y: 20 }),
        createEntity('L1', 'LINE', { type: 'LINE', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } })
      ],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProvenance,
      metadata: {}
    };

    const result = SketchValidator.validate(model);
    expect(result.valid).toBe(true);
  });

  it('TEST 02: Create POINT with NaN', () => {
    const entity = createEntity('P1', 'POINT', { type: 'POINT', x: NaN, y: 20 });
    const model: SketchModel = {
      id: sketchId,
      name: 'Invalid Sketch',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [entity],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProvenance,
      metadata: {}
    };

    const result = SketchValidator.validate(model);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'INVALID_COORDINATES')).toBe(true);
  });

  it('TEST 03: Create LINE whose endpoints are identical', () => {
    const entity = createEntity('L1', 'LINE', { type: 'LINE', start: { x: 0, y: 0 }, end: { x: 0, y: 0 } });
    const model: SketchModel = {
      id: sketchId,
      name: 'Invalid Sketch',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [entity],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProvenance,
      metadata: {}
    };

    const result = SketchValidator.validate(model);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'ZERO_LENGTH_LINE')).toBe(true);
  });

  it('TEST 04: Create CIRCLE with radius <= tolerance', () => {
    const entity = createEntity('C1', 'CIRCLE', { type: 'CIRCLE', center: { x: 0, y: 0 }, radius: 1e-9 });
    const model: SketchModel = {
      id: sketchId,
      name: 'Invalid Sketch',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [entity],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProvenance,
      metadata: {}
    };

    const result = SketchValidator.validate(model);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'INVALID_RADIUS')).toBe(true);
  });

  it('TEST 05: Create valid ARC', () => {
    const entity = createEntity('A1', 'ARC', { 
      type: 'ARC', 
      center: { x: 0, y: 0 }, 
      radius: 10, 
      startAngle: 0, 
      endAngle: Math.PI / 2, 
      direction: 'CCW' 
    });
    const model: SketchModel = {
      id: sketchId,
      name: 'Valid Sketch',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [entity],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProvenance,
      metadata: {}
    };

    const result = SketchValidator.validate(model);
    expect(result.valid).toBe(true);
  });

  it('TEST 06: Create invalid ELLIPSE where minorRadius > majorRadius', () => {
    const entity = createEntity('E1', 'ELLIPSE', { 
      type: 'ELLIPSE', 
      center: { x: 0, y: 0 }, 
      majorRadius: 10, 
      minorRadius: 20, 
      rotation: 0 
    });
    const model: SketchModel = {
      id: sketchId,
      name: 'Invalid Sketch',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [entity],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProvenance,
      metadata: {}
    };

    const result = SketchValidator.validate(model);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'INVALID_ELLIPSE_RATIO')).toBe(true);
  });

  it('TEST 07: Create POLYLINE with deterministic points', () => {
    const entity = createEntity('PL1', 'POLYLINE', { 
      type: 'POLYLINE', 
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 
      closed: true 
    });
    const model: SketchModel = {
      id: sketchId,
      name: 'Valid Sketch',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [entity],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProvenance,
      metadata: {}
    };

    const result = SketchValidator.validate(model);
    expect(result.valid).toBe(true);
  });

  it('TEST 08: Create invalid SPLINE knot/control-point configuration', () => {
    // degree 3 requires 4 control points. If we provide 3, it's invalid.
    const entity = createEntity('S1', 'SPLINE', { 
      type: 'SPLINE', 
      degree: 3, 
      controlPoints: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 
      knots: [0, 0, 0, 0, 1, 1, 1, 1], // Correct knot count for 3 CP and degree 3 is 3+3+2 = 8
      periodic: false 
    });
    const model: SketchModel = {
      id: sketchId,
      name: 'Invalid Sketch',
      coordinateSystem: { origin: { x: 0, y: 0 }, xAxis: { x: 1, y: 0 }, yAxis: { x: 0, y: 1 }, normal: { x: 0, y: 0, z: 1 } },
      entities: [entity],
      constraints: [],
      version: 1,
      units: 'mm',
      tolerance: defaultTolerance,
      provenance: mockProvenance,
      metadata: {}
    };

    const result = SketchValidator.validate(model);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'INSUFFICIENT_CONTROL_POINTS')).toBe(true);
  });
});
