/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-072: Independent CFD Verifier Adversarial Tests
 */

import { describe, it, expect } from 'vitest';
import { InputIntegrityVerifier, ResultIntegrityVerifier, GeometryVerifier } from '../IndependentVerifierCore';
import { CFDCaseManifest } from '../IndependentTypes';

describe('PATCH-072: Independent CFD Verifier Adversarial Battery', () => {
  const manifest: CFDCaseManifest = {
    caseId: 'laminar-cavity-72',
    caseVersion: '1.0.0',
    geometryHash: 'geom-hash-72',
    meshHash: 'mesh-hash-72',
    physicsHash: 'phys-hash-72',
    materialHash: 'mat-hash-72',
    bcHash: 'bc-hash-72',
    icHash: 'ic-hash-72',
    solverConfigHash: 'solver-hash-72',
    numericalSchemeHash: 'scheme-hash-72',
    convergencePolicyHash: 'conv-hash-72',
    resultHash: 'res-hash-72',
    residualHistoryHash: 'resid-hash-72',
    conservationReportHash: 'cons-hash-72',
    meshStudyHash: 'mesh-study-hash-72',
    timestepStudyHash: 'time-study-hash-72',
    provenanceHash: 'proven-hash-72',
    evidenceHash: 'evidence-hash-72',
    softwareVersion: '2.0.0', timestamp: Date.now().toString()
  };

  it('1. input tampering / hash mismatch detection', () => {
    const tamperedHashes = {
      geometry: 'geom-hash-72',
      mesh: 'mesh-hash-72-TAMPERED', // altered mesh file
      material: 'mat-hash-72',
      bc: 'bc-hash-72',
      ic: 'ic-hash-72',
      solverConfig: 'solver-hash-72'
    };

    const res = InputIntegrityVerifier.verifyHashes(manifest, tamperedHashes);
    expect(res).toBe(false); // INPUT_TAMPERED
  });

  it('2. negative density boundedness violation detection', () => {
    const res = ResultIntegrityVerifier.verifyResult([1.2, -0.5, 1.4], 3, false);
    expect(res.isValid).toBe(false); // density must be strictly positive
  });

  it('3. characteristic volume mismatch detection', () => {
    const res = GeometryVerifier.verifyGeometry([2.0, 3.0, 4.0], 25.0, 1e-4); // expected 25 instead of 24
    expect(res.isValid).toBe(false);
  });
});
