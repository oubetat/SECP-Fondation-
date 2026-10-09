import { describe, it, expect } from 'vitest';
import { CanonicalSerializer } from '../CanonicalSerializer';
import { performance } from 'perf_hooks';

describe('PATCH-009 — CanonicalSerialization Benchmark Suite', () => {
  it('benchmarks small, medium, and large engineering objects', () => {
    // 1. Small object
    const smallObj = {
      id: 'part-001',
      type: 'GEOMETRY',
      params: { radius: 10.5, length: 100.0, threads: 4 },
      active: true
    };
    const t0 = performance.now();
    for (let i = 0; i < 500; i++) {
      CanonicalSerializer.serialize(smallObj);
    }
    const tSmall = performance.now() - t0;

    // 2. Medium engineering object (~100 nodes)
    const mediumObj: any = {
      meshId: 'mesh-turbomachinery-001',
      nodes: [],
      properties: { elementsCount: 100, solver: 'NAVIER_STOKES' }
    };
    for (let i = 0; i < 100; i++) {
      mediumObj.nodes.push({
        id: i,
        coords: [i * 0.1, i * 0.2, i * 0.3],
        velocity: [10.5, 0.2, 0.0]
      });
    }
    const t1 = performance.now();
    for (let i = 0; i < 50; i++) {
      CanonicalSerializer.serialize(mediumObj);
    }
    const tMedium = performance.now() - t1;

    // 3. Large synthetic object (~1000 items)
    const largeObj: any = {
      assemblyId: 'cad-assembly-1000',
      components: []
    };
    for (let i = 0; i < 1000; i++) {
      largeObj.components.push({
        componentId: `comp-${i}`,
        mass: 1.25,
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, i, 0, 0, 1]
      });
    }
    const t2 = performance.now();
    const largeRes = CanonicalSerializer.serialize(largeObj);
    const tLarge = performance.now() - t2;

    expect(largeRes.byteLength).toBeGreaterThan(50000);
    expect(tSmall).toBeGreaterThan(0);
    expect(tMedium).toBeGreaterThan(0);
    expect(tLarge).toBeGreaterThan(0);
  });
});
