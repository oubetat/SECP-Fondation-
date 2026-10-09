import { describe, it, expect } from 'vitest';
import { GCSIndependentGeometricOracle } from '../GCSIndependentGeometricOracle';

describe('PATCH-GCS-001 — Canonical 3D Geometry Contract Tests (Kill Suite)', () => {
  
  it('KILL-CANONICAL-001: Nested canonical geometry must override/reject misleading flat fields', () => {
    const sketch = {
      entities: {
        'p1': {
          type: 'POINT_3D',
          x: 0,
          y: 0,
          z: 0, // Misleading flat fields (all zero)
          geometry: {
            type: 'POINT_3D',
            data: { x: 100, y: 100, z: 100 } // Real canonical data
          }
        }
      },
      constraints: [
        {
          type: 'DISTANCE',
          entities: [{ entityId: 'p1' }, { entityId: 'origin' }],
          value: 0
        }
      ]
    };
    
    // Mock origin for the test
    (sketch.entities as any)['origin'] = {
      type: 'POINT_3D',
      geometry: { type: 'POINT_3D', data: { x: 0, y: 0, z: 0 } }
    };

    const result = GCSIndependentGeometricOracle.verifySketch(sketch, 1e-4);
    
    // In the old implementation, this would PASS because it would read x:0, y:0, z:0 from the flat fields.
    // In the new implementation, it MUST FAIL because it reads x:100, y:100, z:100 from canonical data.
    expect(result.satisfied).toBe(false);
    expect(result.violations?.[0]).toContain('measured=173.2051'); // sqrt(100^2 + 100^2 + 100^2)
  });

  it('KILL-CANONICAL-002: Missing canonical coordinates must FAIL, never default to zero', () => {
    const sketch = {
      entities: {
        'p1': {
          type: 'POINT_3D',
          geometry: {
            type: 'POINT_3D',
            data: { x: 100 } // Missing y and z
          }
        }
      },
      constraints: [
        {
          type: 'DISTANCE',
          entities: [{ entityId: 'p1' }, { entityId: 'p1' }],
          value: 0
        }
      ]
    };

    const result = GCSIndependentGeometricOracle.verifySketch(sketch, 1e-4);
    
    // Old implementation might return 0 (passing).
    // New implementation must fail fast on incomplete schema.
    expect(result.satisfied).toBe(false);
    expect(result.violations?.[0]).toContain('incomplete canonical coordinates');
  });

  it('KILL-CANONICAL-003: Unresolvable entity reference must FAIL, never become zero-error', () => {
    const sketch = {
      entities: {
        'p1': {
          type: 'POINT_3D',
          geometry: { type: 'POINT_3D', data: { x: 0, y: 0, z: 0 } }
        }
      },
      constraints: [
        {
          type: 'DISTANCE',
          entities: [{ entityId: 'p1' }, { entityId: 'NON_EXISTENT' }],
          value: 0
        }
      ]
    };

    const result = GCSIndependentGeometricOracle.verifySketch(sketch, 1e-4);
    
    expect(result.satisfied).toBe(false);
    expect(result.violations?.[0]).toContain('Unresolved entity reference');
  });

  it('KILL-CANONICAL-004: Non-finite coordinates (NaN/Infinity) must FAIL, never be treated as valid', () => {
    const sketch = {
      entities: {
        'p1': {
          type: 'POINT_3D',
          geometry: {
            type: 'POINT_3D',
            data: { x: NaN, y: 0, z: 0 }
          }
        }
      },
      constraints: [
        {
          type: 'DISTANCE',
          entities: [{ entityId: 'p1' }, { entityId: 'p1' }],
          value: 0
        }
      ]
    };

    const result = GCSIndependentGeometricOracle.verifySketch(sketch, 1e-4);
    
    expect(result.satisfied).toBe(false);
    expect(result.violations?.[0]).toContain('non-finite canonical coordinates');
  });

});
