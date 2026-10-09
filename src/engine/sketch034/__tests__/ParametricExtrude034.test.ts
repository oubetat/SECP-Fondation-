import { describe, it, expect } from 'vitest';
import { FeatureCommandRegistry } from '../FeatureCommandRegistry';
import { SketchProfileExtractor } from '../SketchProfileExtractor';
import { FeatureHistoryRegenerationEngine } from '../FeatureHistoryRegenerationEngine';
import { BRepValidator } from '../../cad-kernel/brep/BRepValidator';
import { SketchEntity034 } from '../SketchEntityRegistry';

describe('PATCH-034-EXTRUDE-001 — Real Parametric Sketch Extrusion Pipeline', () => {

  it('TEST-01: Profile Extraction from Closed Rectangle', () => {
    const sketchEnts: SketchEntity034[] = [
      {
        id: 'RECT-1',
        type: 'RECTANGLE',
        points: [{ x: 0, y: 0 }, { x: 120, y: 80 }],
        params: { width: 120, height: 80 },
        constraints: ['HORIZONTAL', 'VERTICAL'],
        isConstruction: false
      }
    ];

    const profile = SketchProfileExtractor.extractClosedProfile(sketchEnts);
    expect(profile.isValid).toBe(true);
    expect(profile.isClosed).toBe(true);
    expect(profile.points.length).toBe(4);
    expect(profile.areaMm2).toBeCloseTo(9600, 1);
    expect(profile.perimeterMm).toBeCloseTo(400, 1);
  });

  it('TEST-02: Profile Extraction from Closed Line Chain', () => {
    const sketchEnts: SketchEntity034[] = [
      {
        id: 'L1',
        type: 'LINE',
        points: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
        params: {},
        constraints: [],
        isConstruction: false
      },
      {
        id: 'L2',
        type: 'LINE',
        points: [{ x: 50, y: 0 }, { x: 50, y: 40 }],
        params: {},
        constraints: [],
        isConstruction: false
      },
      {
        id: 'L3',
        type: 'LINE',
        points: [{ x: 50, y: 40 }, { x: 0, y: 40 }],
        params: {},
        constraints: [],
        isConstruction: false
      },
      {
        id: 'L4',
        type: 'LINE',
        points: [{ x: 0, y: 40 }, { x: 0, y: 0 }],
        params: {},
        constraints: [],
        isConstruction: false
      }
    ];

    const profile = SketchProfileExtractor.extractClosedProfile(sketchEnts);
    expect(profile.isValid).toBe(true);
    expect(profile.points.length).toBe(4);
    expect(profile.areaMm2).toBeCloseTo(2000, 1);
  });

  it('TEST-03: Rejection of Degenerate Collinear Profile', () => {
    const degenerateEnts: SketchEntity034[] = [
      {
        id: 'L1',
        type: 'LINE',
        points: [{ x: 0, y: 0 }, { x: 0, y: 0 }],
        params: {},
        constraints: [],
        isConstruction: false
      }
    ];

    const profile = SketchProfileExtractor.extractClosedProfile(degenerateEnts);
    expect(profile.isValid).toBe(false);

    const featRes = FeatureCommandRegistry.executeFeature('EXTRUDE_BOSS', {
      sketchEntities: degenerateEnts,
      depthMm: 50
    });

    expect(featRes.regenerationStatus).toBe('FAILED');
    expect(featRes.error).toBeDefined();
  });

  it('TEST-04: Real B-Rep Solid Topology, Euler Characteristic & Manifoldness', () => {
    const sketchEnts: SketchEntity034[] = [
      {
        id: 'RECT-1',
        type: 'RECTANGLE',
        points: [{ x: 0, y: 0 }, { x: 100, y: 60 }],
        params: { width: 100, height: 60 },
        constraints: [],
        isConstruction: false
      }
    ];

    const featRes = FeatureCommandRegistry.executeFeature('EXTRUDE_BOSS', {
      sketchEntities: sketchEnts,
      depthMm: 50
    });

    expect(featRes.regenerationStatus).toBe('SUCCESS');
    const solid = featRes.solidEntity;
    expect(solid.brep).toBeDefined();

    // Validate using BRepValidator
    const validator = new BRepValidator();
    const valResult = validator.validate(solid.brep!);

    expect(valResult.status).toBe('VALID');
    expect(valResult.manifoldStatus).toBe('MANIFOLD');
    expect(valResult.topologyValid).toBe(true);
    expect(valResult.incidenceValid).toBe(true);
    expect(valResult.orientationValid).toBe(true);
    expect(valResult.diagnostics.length).toBe(0);

    // Topological counts for N=4 polygon extrusion:
    // OuterShell has 4 lateral faces + 1 bottom + 1 top = 6 faces
    const shell = solid.brep!.outerShell;
    expect(shell.orientedFaces.length).toBe(6);
  });

  it('TEST-05: Strict Unit Contract & Physical Volume / Surface Area Calculation', () => {
    // 100mm x 50mm rectangle, extruded by 40mm depth
    // 2D Area = 100 * 50 = 5000 mm2 = 0.005 m2
    // Depth = 40 mm = 0.04 m
    // Volume = 0.005 m2 * 0.04 m = 0.0002 m3 = 2e-4 m3
    // Perimeter = 2 * (100 + 50) = 300 mm = 0.3 m
    // Surface Area = 2 * 0.005 + 0.3 * 0.04 = 0.01 + 0.012 = 0.022 m2
    const sketchEnts: SketchEntity034[] = [
      {
        id: 'RECT-1',
        type: 'RECTANGLE',
        points: [{ x: 0, y: 0 }, { x: 100, y: 50 }],
        params: { width: 100, height: 50 },
        constraints: [],
        isConstruction: false
      }
    ];

    const featRes = FeatureCommandRegistry.executeFeature('EXTRUDE_BOSS', {
      sketchEntities: sketchEnts,
      depthMm: 40
    });

    const solid = featRes.solidEntity;
    expect(solid.volumeM3).toBeCloseTo(0.0002, 6);
    expect(solid.surfaceAreaM2).toBeCloseTo(0.022, 5);
    expect(solid.dimensions.dz).toBeCloseTo(0.04, 4);
    expect(solid.dimensions.dx).toBeCloseTo(0.1, 4);
    expect(solid.dimensions.dy).toBeCloseTo(0.05, 4);
    expect(solid.centerOfGravity.z).toBeCloseTo(0.02, 4);
  });

  it('TEST-06: Geometric Dependency on Sketch Shape (Circle vs Rectangle vs Hexagon)', () => {
    const circleEnts: SketchEntity034[] = [
      {
        id: 'CIRC-1',
        type: 'CIRCLE',
        points: [{ x: 0, y: 0 }],
        params: { radius: 50 },
        constraints: [],
        isConstruction: false
      }
    ];

    const circleFeat = FeatureCommandRegistry.executeFeature('EXTRUDE_BOSS', {
      sketchEntities: circleEnts,
      depthMm: 100
    });

    // 32-sided polygon extrusion => 32 side faces + 2 caps = 34 faces
    expect(circleFeat.facesCount).toBe(34);
    // Area of circle R=50mm: pi * 0.05^2 = ~0.00785398 m2
    // Volume: ~0.0007854 m3
    expect(circleFeat.solidEntity.volumeM3).toBeCloseTo(0.0007854, 4);

    const rectEnts: SketchEntity034[] = [
      {
        id: 'RECT-1',
        type: 'RECTANGLE',
        points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
        params: { width: 100, height: 100 },
        constraints: [],
        isConstruction: false
      }
    ];

    const rectFeat = FeatureCommandRegistry.executeFeature('EXTRUDE_BOSS', {
      sketchEntities: rectEnts,
      depthMm: 100
    });

    // 4-sided polygon extrusion => 4 side faces + 2 caps = 6 faces
    expect(rectFeat.facesCount).toBe(6);
    // Volume of 100x100x100mm cube: 0.1^3 = 0.001 m3
    expect(rectFeat.solidEntity.volumeM3).toBeCloseTo(0.001, 5);

    // Verify volumes and topology differ appropriately
    expect(circleFeat.solidEntity.volumeM3).not.toBe(rectFeat.solidEntity.volumeM3);
  });

  it('TEST-07: Linear Scaling with Depth Parameter', () => {
    const sketchEnts: SketchEntity034[] = [
      {
        id: 'RECT-1',
        type: 'RECTANGLE',
        points: [{ x: 0, y: 0 }, { x: 50, y: 50 }],
        params: { width: 50, height: 50 },
        constraints: [],
        isConstruction: false
      }
    ];

    const feat50 = FeatureCommandRegistry.executeFeature('EXTRUDE_BOSS', {
      sketchEntities: sketchEnts,
      depthMm: 50
    });

    const feat100 = FeatureCommandRegistry.executeFeature('EXTRUDE_BOSS', {
      sketchEntities: sketchEnts,
      depthMm: 100
    });

    expect(feat100.solidEntity.volumeM3).toBeCloseTo(feat50.solidEntity.volumeM3 * 2.0, 7);
  });

  it('TEST-08: Deterministic Regeneration & Identity Survival', () => {
    const sketchEnts: SketchEntity034[] = [
      {
        id: 'RECT-1',
        type: 'RECTANGLE',
        points: [{ x: 0, y: 0 }, { x: 80, y: 80 }],
        params: { width: 80, height: 80 },
        constraints: [],
        isConstruction: false
      }
    ];

    const run1 = FeatureHistoryRegenerationEngine.executeFullRegeneration(sketchEnts);
    const run2 = FeatureHistoryRegenerationEngine.executeFullRegeneration(sketchEnts);

    expect(run1.pipelineSuccess).toBe(true);
    expect(run2.pipelineSuccess).toBe(true);
    expect(run1.finalBRepHash).toBe(run2.finalBRepHash);
    expect(run1.steps.length).toBe(run2.steps.length);
  });
});
