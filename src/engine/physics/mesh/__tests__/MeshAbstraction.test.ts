/**
 * SECP Industrial OS v2 — Mesh Abstraction Tests
 * PATCH-047: Mesh Abstraction
 */

import { describe, it, expect } from 'vitest';
import { MeshSet } from '../MeshTypes';
import { MeshValidator } from '../MeshValidator';
import { MeshQualityEngine } from '../MeshQualityEngine';
import { MeshGate047 } from '../MeshGate047';

describe('PATCH-047: Mesh Abstraction', () => {

  it('validates a valid 2D Triangle Mesh', () => {
    const mesh: MeshSet = {
      meshId: 'MESH-2D-TRI',
      modelId: 'MODEL-1',
      meshVersion: '1.0',
      dimension: '2D',
      topologyType: 'UNSTRUCTURED',
      elementFamily: 'SIMPLEX_TRIANGLE',
      revision: '1.0',
      nodes: [
        { nodeId: 'N1', coordinates: [0.0, 0.0] },
        { nodeId: 'N2', coordinates: [1.0, 0.0] },
        { nodeId: 'N3', coordinates: [0.0, 1.0] }
      ],
      elements: [
        { elementId: 'E1', type: 'TRIANGLE', nodeIds: ['N1', 'N2', 'N3'], dimension: 2 }
      ],
      regions: [
        { regionId: 'REG-WALL', name: 'Wall', regionType: 'WALL', entityIds: ['N1', 'N2'] }
      ]
    };

    const res = MeshValidator.validateMesh(mesh);
    expect(res.valid).toBe(true);
    expect(res.quality?.status).toBe('COMPUTED');
    expect(res.quality?.minVolumeOrArea).toBeCloseTo(0.5, 5);
  });

  it('validates a valid 2D Quadrilateral Mesh', () => {
    const mesh: MeshSet = {
      meshId: 'MESH-2D-QUAD',
      modelId: 'MODEL-1',
      meshVersion: '1.0',
      dimension: '2D',
      topologyType: 'STRUCTURED',
      elementFamily: 'QUAD',
      revision: '1.0',
      nodes: [
        { nodeId: 'N1', coordinates: [0.0, 0.0] },
        { nodeId: 'N2', coordinates: [1.0, 0.0] },
        { nodeId: 'N3', coordinates: [1.0, 1.0] },
        { nodeId: 'N4', coordinates: [0.0, 1.0] }
      ],
      elements: [
        { elementId: 'E1', type: 'QUADRILATERAL', nodeIds: ['N1', 'N2', 'N3', 'N4'], dimension: 2 }
      ],
      regions: []
    };

    const res = MeshValidator.validateMesh(mesh);
    expect(res.valid).toBe(true);
    expect(res.quality?.status).toBe('COMPUTED');
    expect(res.quality?.minVolumeOrArea).toBeCloseTo(1.0, 5);
  });

  it('validates a valid 3D Tetrahedral Mesh', () => {
    const mesh: MeshSet = {
      meshId: 'MESH-3D-TET',
      modelId: 'MODEL-1',
      meshVersion: '1.0',
      dimension: '3D',
      topologyType: 'UNSTRUCTURED',
      elementFamily: 'TETRAHEDRON',
      revision: '1.0',
      nodes: [
        { nodeId: 'N1', coordinates: [0.0, 0.0, 0.0] },
        { nodeId: 'N2', coordinates: [1.0, 0.0, 0.0] },
        { nodeId: 'N3', coordinates: [0.0, 1.0, 0.0] },
        { nodeId: 'N4', coordinates: [0.0, 0.0, 1.0] }
      ],
      elements: [
        { elementId: 'E1', type: 'TETRAHEDRON', nodeIds: ['N1', 'N2', 'N3', 'N4'], dimension: 3 }
      ],
      regions: [
        { regionId: 'INLET-1', name: 'Inlet Face', regionType: 'INLET', entityIds: ['N1', 'N2', 'N3'] }
      ]
    };

    const res = MeshValidator.validateMesh(mesh);
    expect(res.valid).toBe(true);
    expect(res.quality?.status).toBe('COMPUTED');
    expect(res.quality?.minVolumeOrArea).toBeCloseTo(1.0 / 6.0, 5);
  });

  it('validates a valid 3D Hexahedral Mesh', () => {
    const mesh: MeshSet = {
      meshId: 'MESH-3D-HEX',
      modelId: 'MODEL-1',
      meshVersion: '1.0',
      dimension: '3D',
      topologyType: 'STRUCTURED',
      elementFamily: 'HEXAHEDRON',
      revision: '1.0',
      nodes: [
        { nodeId: 'N1', coordinates: [0, 0, 0] },
        { nodeId: 'N2', coordinates: [1, 0, 0] },
        { nodeId: 'N3', coordinates: [1, 1, 0] },
        { nodeId: 'N4', coordinates: [0, 1, 0] },
        { nodeId: 'N5', coordinates: [0, 0, 1] },
        { nodeId: 'N6', coordinates: [1, 0, 1] },
        { nodeId: 'N7', coordinates: [1, 1, 1] },
        { nodeId: 'N8', coordinates: [0, 1, 1] }
      ],
      elements: [
        { elementId: 'E1', type: 'HEXAHEDRON', nodeIds: ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8'], dimension: 3 }
      ],
      regions: []
    };

    const res = MeshValidator.validateMesh(mesh);
    expect(res.valid).toBe(true);
    expect(res.quality?.status).toBe('COMPUTED');
    expect(res.quality?.minVolumeOrArea).toBeGreaterThan(0.9);
  });

  it('generates a deterministic canonical hash independent of node and element ordering', () => {
    const meshA: MeshSet = {
      meshId: 'MESH-DET',
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
        { elementId: 'E1', type: 'TRIANGLE', nodeIds: ['N1', 'N2', 'N3'], dimension: 2 },
        { elementId: 'E2', type: 'TRIANGLE', nodeIds: ['N2', 'N4', 'N3'], dimension: 2 }
      ],
      regions: []
    };

    const meshB: MeshSet = {
      meshId: 'MESH-DET',
      modelId: 'M-1',
      meshVersion: '1.0',
      dimension: '2D',
      topologyType: 'UNSTRUCTURED',
      elementFamily: 'TRI',
      revision: '1.0',
      nodes: [
        { nodeId: 'N4', coordinates: [1, 1] },
        { nodeId: 'N2', coordinates: [1, 0] },
        { nodeId: 'N1', coordinates: [0, 0] },
        { nodeId: 'N3', coordinates: [0, 1] }
      ],
      elements: [
        { elementId: 'E2', type: 'TRIANGLE', nodeIds: ['N2', 'N4', 'N3'], dimension: 2 },
        { elementId: 'E1', type: 'TRIANGLE', nodeIds: ['N1', 'N2', 'N3'], dimension: 2 }
      ],
      regions: []
    };

    const hashA = MeshValidator.calculateCanonicalHash(meshA);
    const hashB = MeshValidator.calculateCanonicalHash(meshB);
    expect(hashA).toBe(hashB);
  });

  it('detects tampering and changes hash when node coordinates or connectivity change', () => {
    const meshOriginal: MeshSet = {
      meshId: 'MESH-TAMPER',
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
      regions: []
    };

    const meshTampered: MeshSet = {
      ...meshOriginal,
      nodes: [
        { nodeId: 'N1', coordinates: [0, 0] },
        { nodeId: 'N2', coordinates: [1.0001, 0] }, // Tampered coordinate
        { nodeId: 'N3', coordinates: [0, 1] }
      ]
    };

    const hashOrig = MeshValidator.calculateCanonicalHash(meshOriginal);
    const hashTampered = MeshValidator.calculateCanonicalHash(meshTampered);
    expect(hashOrig).not.toBe(hashTampered);
  });

  it('passes MeshGate047 evaluation for valid mesh', () => {
    const mesh: MeshSet = {
      meshId: 'MESH-GATE',
      modelId: 'MODEL-1',
      meshVersion: '1.0',
      dimension: '2D',
      topologyType: 'UNSTRUCTURED',
      elementFamily: 'TRIANGLE',
      revision: '1.0',
      nodes: [
        { nodeId: 'N1', coordinates: [0, 0] },
        { nodeId: 'N2', coordinates: [1, 0] },
        { nodeId: 'N3', coordinates: [0, 1] }
      ],
      elements: [
        { elementId: 'E1', type: 'TRIANGLE', nodeIds: ['N1', 'N2', 'N3'], dimension: 2 }
      ],
      regions: []
    };

    const gateRes = MeshGate047.evaluate(mesh);
    expect(gateRes.status).toBe('PASS');
    expect(gateRes.capabilities.MESH_ABSTRACTION).toBe(true);
    expect(gateRes.capabilities.CONNECTIVITY_VALIDATION).toBe(true);
    expect(gateRes.capabilities.MESH_GENERATION).toBe('UNPROVEN');
  });

});
