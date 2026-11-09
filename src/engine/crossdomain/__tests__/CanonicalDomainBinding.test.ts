/**
 * SECP Industrial OS — Canonical Domain Binding Qualification Tests
 * SECP-ENGINEERING-TRUTH-INTEGRATION-004
 */

import { describe, it, expect } from 'vitest';
import { CanonicalDomainBindingEngine } from '../CanonicalDomainBindingEngine';
import { PcbToCoreBinding } from '../CanonicalDomainBinding';

describe('SECP-ENGINEERING-TRUTH-INTEGRATION-004 — Canonical Domain Binding', () => {
  it('QUAL-01: Deterministic Binding ID Generation', () => {
    const entityId = 'PCB-123';
    const domainId = 'PCB';
    const revisionId = 'REV-A';
    
    const binding = CanonicalDomainBindingEngine.createBinding(
      domainId,
      entityId,
      revisionId,
      { boardWidthMm: 100 },
      'geom-hash-1',
      'topo-hash-1',
      'manifest-hash-1',
      'evidence-root-1',
      'prov-chain-1'
    );

    expect(binding.bindingId).toBeDefined();
    expect(binding.bindingId.length).toBe(64); // SHA-256

    // Validating same input produces same ID
    const binding2 = CanonicalDomainBindingEngine.createBinding(
      domainId,
      entityId,
      revisionId,
      { boardWidthMm: 100 },
      'geom-hash-1',
      'topo-hash-1',
      'manifest-hash-1',
      'evidence-root-1',
      'prov-chain-1'
    );
    expect(binding2.bindingId).toBe(binding.bindingId);
  });

  it('QUAL-02: Binding Validation Failure on Tampered ID', () => {
    const binding = CanonicalDomainBindingEngine.createBinding(
      'PCB',
      'PCB-1',
      'REV-A',
      {},
      'g1',
      't1',
      'm1',
      'e1',
      'p1'
    );

    // Tamper with entityId without updating bindingId
    const tamperedBinding = { ...binding, canonicalEntityId: 'PCB-TAMPERED' };
    const result = CanonicalDomainBindingEngine.validateBinding(tamperedBinding);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Binding ID mismatch'))).toBe(true);
  });

  it('QUAL-03: Domain Specific Payloads', () => {
    const pcbBinding: PcbToCoreBinding = CanonicalDomainBindingEngine.createBinding(
      'PCB',
      'PCB-1',
      'REV-B',
      { boardWidthMm: 50, boardHeightMm: 50, components: [], schematicNets: [], placements: [], traces: [], vias: [], mountingHoles: [], footprintLibrary: {}, rules: { minClearanceMm: 0.1, minTraceWidthMm: 0.1, boardMarginMm: 1 }, version: '1' },
      'g1',
      't1',
      'm1',
      'e1',
      'p1'
    ) as PcbToCoreBinding;

    expect(pcbBinding.domainId).toBe('PCB');
    expect(pcbBinding.payload.boardWidthMm).toBe(50);
  });
});
