import { describe, it, expect } from 'vitest';
import { CanonicalSerializer } from '../../serialization/CanonicalSerializer';
import { TopoShapeEnum, Vertex } from '../topology/TopologyContracts';

describe('PATCH-015 — Architecture Extra Tests', () => {
  it('TEST-13: Canonical Serialization produces stable representation for the same kernel object', () => {
    const vertex: Vertex = {
      id: 'SECP:TOPOLOGY:V1',
      shapeType: TopoShapeEnum.VERTEX,
      geometry: { x: 1, y: 2, z: 3 },
      tolerance: 1e-7
    };
    
    const serialization1 = CanonicalSerializer.serialize(vertex);
    
    // Create equivalent object with different property order
    const vertex2: any = {
      tolerance: 1e-7,
      geometry: { z: 3, y: 2, x: 1 },
      shapeType: TopoShapeEnum.VERTEX,
      id: 'SECP:TOPOLOGY:V1'
    };
    
    const serialization2 = CanonicalSerializer.serialize(vertex2);
    expect(serialization1.canonicalString).toBe(serialization2.canonicalString);
  });
});
