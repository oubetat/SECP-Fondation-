import { describe, it, expect } from 'vitest';
import { NativeSECPFixtures } from '../__fixtures__/NativeSECPFixtures';
import { NativeSECPReader } from '../NativeSECPReader';
import { HardAcceptanceGateNativeSECP } from '../verification/HardAcceptanceGateNativeSECP';

describe('PATCH-039: Native SECP Adversarial & Tamper Detection Tests', () => {

  it('detects corrupted JSON container (INVALID)', () => {
    const corruptedJson = '{"header": {"formatId": "SECP-NATIVE"}, incomplete...';
    const result = NativeSECPReader.read(corruptedJson);

    expect(result.success).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'SECP-CORRUPTED-CONTAINER')).toBe(true);

    const gate = HardAcceptanceGateNativeSECP.evaluate(corruptedJson);
    expect(gate.passed).toBe(false);
    expect(gate.verdict).toBe('INVALID');
  });

  it('detects unsupported format identifier or major version (INVALID)', () => {
    const doc = NativeSECPFixtures.createValidCubeDocument();
    const badVersionDoc = {
      ...doc,
      header: {
        ...doc.header,
        formatVersion: '99.0.0'
      }
    };

    const result = NativeSECPReader.read(badVersionDoc);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'SECP-UNSUPPORTED-SCHEMA-VERSION')).toBe(true);

    const gate = HardAcceptanceGateNativeSECP.evaluate(badVersionDoc as any);
    expect(gate.passed).toBe(false);
    expect(gate.verdict).toBe('INVALID');
  });

  it('detects missing required sections (INVALID)', () => {
    const doc: any = NativeSECPFixtures.createValidCubeDocument();
    delete doc.model;

    const result = NativeSECPReader.read(doc);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'SECP-MISSING-MODEL-SECTION')).toBe(true);
  });

  it('detects dangling point reference from vertex (FAIL)', () => {
    const doc = NativeSECPFixtures.createValidCubeDocument();
    const brokenDoc = {
      ...doc,
      model: {
        ...doc.model,
        topology: {
          ...doc.model.topology,
          vertices: [
            ...doc.model.topology.vertices,
            { id: 'v_dangling', pointId: 'non_existent_point_id', tolerance: 1e-6 }
          ]
        }
      }
    };

    const result = NativeSECPReader.read(brokenDoc);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'SECP-DANGLING-POINT-REFERENCE')).toBe(true);
  });

  it('detects dangling vertex reference from edge (FAIL)', () => {
    const doc = NativeSECPFixtures.createValidCubeDocument();
    const brokenDoc = {
      ...doc,
      model: {
        ...doc.model,
        topology: {
          ...doc.model.topology,
          edges: [
            ...doc.model.topology.edges,
            {
              id: 'e_dangling',
              startVertexId: 'non_existent_v1',
              endVertexId: 'non_existent_v2',
              curveId: doc.model.geometry.analyticCurves[0].id,
              parameterRange: [0, 1] as const,
              orientation: 'FORWARD' as const,
              tolerance: 1e-6
            }
          ]
        }
      }
    };

    const result = NativeSECPReader.read(brokenDoc);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'SECP-DANGLING-VERTEX-REFERENCE')).toBe(true);
  });

  it('detects modified geometry without updating canonical hash (TAMPER DETECTION / FAIL)', () => {
    const doc = NativeSECPFixtures.createValidCubeDocument();
    
    // Maliciously tamper with a point coordinate
    const tamperedDoc = {
      ...doc,
      model: {
        ...doc.model,
        geometry: {
          ...doc.model.geometry,
          points: doc.model.geometry.points.map(p =>
            p.id === 'p1' ? { ...p, x: 999.999 } : p
          )
        }
      }
    };

    const result = NativeSECPReader.read(tamperedDoc);
    expect(result.success).toBe(false);
    expect(result.integrityValid).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'SECP-CANONICAL-HASH-MISMATCH')).toBe(true);

    const gate = HardAcceptanceGateNativeSECP.evaluate(tamperedDoc);
    expect(gate.passed).toBe(false);
    expect(gate.verdict).toBe('FAIL');
  });

  it('detects modified NURBS control points (TAMPER DETECTION / FAIL)', () => {
    const doc = NativeSECPFixtures.createValidCubeDocument();
    
    // Tamper with NURBS curve control point
    const tamperedDoc = {
      ...doc,
      model: {
        ...doc.model,
        geometry: {
          ...doc.model.geometry,
          nurbsCurves: doc.model.geometry.nurbsCurves.map(nc => ({
            ...nc,
            controlPoints: nc.controlPoints.map(cp =>
              cp.id === 'cp1' ? { ...cp, y: 888.88 } : cp
            )
          }))
        }
      }
    };

    const result = NativeSECPReader.read(tamperedDoc);
    expect(result.integrityValid).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'SECP-CANONICAL-HASH-MISMATCH')).toBe(true);
  });

  it('detects modified feature parameter value (TAMPER DETECTION / FAIL)', () => {
    const doc = NativeSECPFixtures.createValidCubeDocument();
    
    // Tamper with feature depth input
    const tamperedDoc = {
      ...doc,
      model: {
        ...doc.model,
        features: {
          ...doc.model.features,
          features: doc.model.features.features.map(f => ({
            ...f,
            inputs: [{ name: 'depth', type: 'NUMBER' as const, value: 9999 }]
          }))
        }
      }
    };

    const result = NativeSECPReader.read(tamperedDoc);
    expect(result.integrityValid).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'SECP-CANONICAL-HASH-MISMATCH')).toBe(true);
  });

  it('detects duplicate point identifiers in geometry (FAIL)', () => {
    const doc = NativeSECPFixtures.createValidCubeDocument();
    const dupDoc = {
      ...doc,
      model: {
        ...doc.model,
        geometry: {
          ...doc.model.geometry,
          points: [
            ...doc.model.geometry.points,
            { id: 'p0', x: 50, y: 50, z: 50 } // Duplicate 'p0'
          ]
        }
      }
    };

    const result = NativeSECPReader.read(dupDoc);
    expect(result.success).toBe(false);
    expect(result.diagnostics.some(d => d.code === 'SECP-DUPLICATE-POINT-ID')).toBe(true);
  });
});
