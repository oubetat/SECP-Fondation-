/**
 * SECP Industrial OS v2 — Mesh Adversarial Tests
 * PATCH-047: Mesh Abstraction
 */

import { describe, it, expect } from 'vitest';
import { MeshSet } from '../MeshTypes';
import { MeshValidator } from '../MeshValidator';

describe('PATCH-047: Mesh Adversarial', () => {

  it('rejects nodes with NaN or Infinity coordinates', () => {
    const mesh: MeshSet = {
      meshId: 'MESH-ADV-NAN',
      modelId: 'M-1',
      meshVersion: '1.0',
      dimension: '2D',
      topologyType: 'UNSTRUCTURED',
      elementFamily: 'TRI',
      revision: '1.0',
      nodes: [
        { nodeId: 'N1', coordinates: [0, 0] },
        { nodeId: 'N2', coordinates: [NaN, 0] }, // NaN
        { nodeId: 'N3', coordinates: [0, Infinity] } // Infinity
      ],
      elements: [
        { elementId: 'E1', type: 'TRIANGLE', nodeIds: ['N1', 'N2', 'N3'], dimension: 2 }
      ],
      regions: []
    };

    const res = MeshValidator.validateMesh(mesh);
    expect(res.valid).toBe(false);
    expect(res.status).toBe('INVALID');
    expect(res.errors.some(e => e.includes('invalid (NaN or Infinity)'))).toBe(true);
  });

  it('rejects duplicate node IDs', () => {
    const mesh: MeshSet = {
      meshId: 'MESH-ADV-DUPNODE',
      modelId: 'M-1',
      meshVersion: '1.0',
      dimension: '2D',
      topologyType: 'UNSTRUCTURED',
      elementFamily: 'TRI',
      revision: '1.0',
      nodes: [
        { nodeId: 'N1', coordinates: [0, 0] },
        { nodeId: 'N1', coordinates: [1, 0] }, // Duplicate N1
        { nodeId: 'N3', coordinates: [0, 1] }
      ],
      elements: [
        { elementId: 'E1', type: 'TRIANGLE', nodeIds: ['N1', 'N2', 'N3'], dimension: 2 }
      ],
      regions: []
    };

    const res = MeshValidator.validateMesh(mesh);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('Duplicate nodeId detected'))).toBe(true);
  });

  it('rejects elements referencing non-existent node IDs', () => {
    const mesh: MeshSet = {
      meshId: 'MESH-ADV-MISSINGNODE',
      modelId: 'M-1',
      meshVersion: '1.0',
      dimension: '2D',
      topologyType: 'UNSTRUCTURED',
      elementFamily: 'TRI',
      revision: '1.0',
      nodes: [
        { nodeId: 'N1', coordinates: [0, 0] },
        { nodeId: 'N2', coordinates: [1, 0] },
        { nodeId: 'N3', coordinates: [0, 1] }
      ],
      elements: [
        { elementId: 'E1', type: 'TRIANGLE', nodeIds: ['N1', 'N2', 'N999'], dimension: 2 } // N999 missing
      ],
      regions: []
    };

    const res = MeshValidator.validateMesh(mesh);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('references non-existent node'))).toBe(true);
  });

  it('rejects element with incorrect node count for its type', () => {
    const mesh: MeshSet = {
      meshId: 'MESH-ADV-WRONGNODECOUNT',
      modelId: 'M-1',
      meshVersion: '1.0',
      dimension: '2D',
      topologyType: 'UNSTRUCTURED',
      elementFamily: 'TRI',
      revision: '1.0',
      nodes: [
        { nodeId: 'N1', coordinates: [0, 0] },
        { nodeId: 'N2', coordinates: [1, 0] },
        { nodeId: 'N3', coordinates: [0, 1] },
        { nodeId: 'N4', coordinates: [1, 1] }
      ],
      elements: [
        { elementId: 'E1', type: 'TRIANGLE', nodeIds: ['N1', 'N2', 'N3', 'N4'], dimension: 2 } // Triangle needs 3 nodes, got 4
      ],
      regions: []
    };

    const res = MeshValidator.validateMesh(mesh);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('must have 3 nodes, got 4'))).toBe(true);
  });

  it('rejects element with duplicate node references inside itself', () => {
    const mesh: MeshSet = {
      meshId: 'MESH-ADV-DUPELREF',
      modelId: 'M-1',
      meshVersion: '1.0',
      dimension: '2D',
      topologyType: 'UNSTRUCTURED',
      elementFamily: 'TRI',
      revision: '1.0',
      nodes: [
        { nodeId: 'N1', coordinates: [0, 0] },
        { nodeId: 'N2', coordinates: [1, 0] }
      ],
      elements: [
        { elementId: 'E1', type: 'TRIANGLE', nodeIds: ['N1', 'N1', 'N2'], dimension: 2 } // [N1, N1, N2]
      ],
      regions: []
    };

    const res = MeshValidator.validateMesh(mesh);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('contains duplicate node references'))).toBe(true);
  });

  it('detects zero-volume / inverted degenerate tetrahedron elements', () => {
    const mesh: MeshSet = {
      meshId: 'MESH-ADV-ZEROVOL',
      modelId: 'M-1',
      meshVersion: '1.0',
      dimension: '3D',
      topologyType: 'UNSTRUCTURED',
      elementFamily: 'TETRAHEDRON',
      revision: '1.0',
      nodes: [
        { nodeId: 'N1', coordinates: [0, 0, 0] },
        { nodeId: 'N2', coordinates: [1, 0, 0] },
        { nodeId: 'N3', coordinates: [2, 0, 0] }, // Collinear nodes -> 0 volume
        { nodeId: 'N4', coordinates: [3, 0, 0] }
      ],
      elements: [
        { elementId: 'E1', type: 'TETRAHEDRON', nodeIds: ['N1', 'N2', 'N3', 'N4'], dimension: 3 }
      ],
      regions: []
    };

    const res = MeshValidator.validateMesh(mesh);
    expect(res.valid).toBe(false);
    expect(res.status).toBe('GEOMETRY_DEGENERATE');
    expect(res.errors.some(e => e.includes('degenerate/inverted non-positive elements'))).toBe(true);
  });

  it('flags region referencing non-existent element or node ID', () => {
    const mesh: MeshSet = {
      meshId: 'MESH-ADV-BADREG',
      modelId: 'M-1',
      meshVersion: '1.0',
      dimension: '2D',
      topologyType: 'UNSTRUCTURED',
      elementFamily: 'TRI',
      revision: '1.0',
      nodes: [
        { nodeId: 'N1', coordinates: [0, 0] },
        { nodeId: 'N2', coordinates: [1, 0] },
        { nodeId: 'N3', coordinates: [0, 1] }
      ],
      elements: [
        { elementId: 'E1', type: 'TRIANGLE', nodeIds: ['N1', 'N2', 'N3'], dimension: 2 }
      ],
      regions: [
        { regionId: 'R1', name: 'Bad Region', regionType: 'INLET', entityIds: ['GHOST_ENTITY'] }
      ]
    };

    const res = MeshValidator.validateMesh(mesh);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes('references non-existent node or element'))).toBe(true);
  });

});
