/**
 * SECP CAD Kernel — Real Extrude Test
 * Phase 2 (PATCH-KERNEL-004)
 */

import { describe, it, expect } from 'vitest';
import { FeatureHistory } from '../FeatureHistory';
import { BRepSolid } from '../../topology/BRepTopology';

describe('PATCH-KERNEL-004 — Real Extrude Pipeline', () => {
  it('TEST-01: Extrudes rectangular sketch geometry into real B-Rep Solid using SketchProfileExtractor', () => {
    const history = new FeatureHistory('DOC_REAL_EXTRUDE_001');

    // 1. Sketch profile with 4 corners
    const sketch = history.addFeature('SKETCH', 'Sketch001', {
      type: 'SKETCH',
      name: 'Sketch001',
      parameters: {
        plane: 'XY',
        closedProfile: true,
        entities: [
          { type: 'LINE', id: 'L1', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
          { type: 'LINE', id: 'L2', points: [{ x: 100, y: 0 }, { x: 100, y: 50 }] },
          { type: 'LINE', id: 'L3', points: [{ x: 100, y: 50 }, { x: 0, y: 50 }] },
          { type: 'LINE', id: 'L4', points: [{ x: 0, y: 50 }, { x: 0, y: 0 }] }
        ]
      },
      inputReferences: []
    }, [], undefined, 'Sketch001');

    // 2. Real Extrude feature referencing Sketch001 profile
    const extrude = history.addFeature('EXTRUDE', 'Extrude001', {
      type: 'EXTRUDE',
      name: 'Extrude001',
      parameters: {
        profileId: 'Sketch001',
        depth: 40
      },
      inputReferences: [{ type: 'PROFILE', targetFeatureId: 'Sketch001' }]
    }, ['Sketch001'], 'Sketch001', 'Extrude001');

    const result = history.regenerate();
    expect(result.success).toBe(true);

    const solid = extrude.outputGeometry as BRepSolid;
    expect(solid).toBeDefined();
    expect(solid.shapeType).toBe('SOLID');

    // Topological assertions
    const verts = new Set<string>();
    const edges = new Set<string>();
    for (const of of solid.outerShell.orientedFaces) {
      for (const oe of of.face.outerLoop.orientedEdges) {
        edges.add(oe.edge.id);
        verts.add(oe.edge.startVertex.id);
        verts.add(oe.edge.endVertex.id);
      }
    }

    expect(verts.size).toBe(8); // 8 3D vertices
    expect(edges.size).toBe(12); // 12 edges
    expect(solid.outerShell.orientedFaces.length).toBe(6); // 6 faces
  });

  it('TEST-02: Extrudes hexagonal sketch profile into 8-faced B-Rep prism with 12 vertices and 18 edges', () => {
    const history = new FeatureHistory('DOC_REAL_EXTRUDE_HEX');

    const sketch = history.addFeature('SKETCH', 'HexSketch', {
      type: 'SKETCH',
      name: 'HexSketch',
      parameters: {
        plane: 'XY',
        closedProfile: true,
        entities: [
          { type: 'POLYGON', id: 'Hex1', points: [{ x: 0, y: 0 }], params: { sides: 6, radius: 50 } }
        ]
      },
      inputReferences: []
    }, [], undefined, 'HexSketch');

    const extrude = history.addFeature('EXTRUDE', 'HexExtrude', {
      type: 'EXTRUDE',
      name: 'HexExtrude',
      parameters: {
        profileId: 'HexSketch',
        depth: 30
      },
      inputReferences: [{ type: 'PROFILE', targetFeatureId: 'HexSketch' }]
    }, ['HexSketch'], 'HexSketch', 'HexExtrude');

    const result = history.regenerate();
    expect(result.success).toBe(true);

    const solid = extrude.outputGeometry as BRepSolid;
    const verts = new Set<string>();
    const edges = new Set<string>();
    for (const of of solid.outerShell.orientedFaces) {
      for (const oe of of.face.outerLoop.orientedEdges) {
        edges.add(oe.edge.id);
        verts.add(oe.edge.startVertex.id);
        verts.add(oe.edge.endVertex.id);
      }
    }

    expect(verts.size).toBe(12); // 12 vertices for hex prism
    expect(edges.size).toBe(18); // 18 edges for hex prism
    expect(solid.outerShell.orientedFaces.length).toBe(8); // 2 caps + 6 sides
  });
});
