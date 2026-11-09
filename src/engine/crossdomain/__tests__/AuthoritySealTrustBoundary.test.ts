/**
 * SECP Engineering OS — Authority Seal Trust Boundary Security Test Battery
 * Task ID: SECP-STAGE3-SECURITY-CLOSURE-003
 * Reference Findings: RESIDUAL-RISK-001 and RESIDUAL-RISK-002 Remediation Verification
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CanonicalDomainBindingEngine } from '../CanonicalDomainBindingEngine';
import { FemToCoreBinding } from '../CanonicalDomainBinding';
import { 
  initializeAuthorityHandshake, 
  revokeAuthorityState, 
  getAuthorityInitializationState 
} from '../../simulation/SimulationAuthorityInternal';
import { FEMCore } from '../../fem/core/FEMCore';
import { issueSealingCapability, SealingCapability } from '../../simulation/SimulationSealingAuthorization';

describe('SECP-STAGE3-SECURITY-CLOSURE-003: Authority Key Isolation & Fail-Closed Cryptographic Initialization', () => {

  beforeEach(() => {
    revokeAuthorityState();
  });

  it('1. No production module exposes getAuthorityBootKey export', async () => {
    const internalModule = await import('../../simulation/SimulationAuthorityInternal');
    expect((internalModule as any).getAuthorityBootKey).toBeUndefined();
  });

  it('2. Sealing before authority initialization FAILS CLOSED with SIMULATION_AUTHORITY_NOT_INITIALIZED', () => {
    expect(getAuthorityInitializationState()).toBe('UNINITIALIZED');

    const binding = CanonicalDomainBindingEngine.createBinding(
      'FEM', 'ENT-SEC-001', 'REV-1', {}, 'geo-1', 'topo-1', 'mat-1', 'env-1', 'phys-1'
    );

    expect(() => {
      // @ts-ignore
      CanonicalDomainBindingEngine.sealBinding(binding);
    }).toThrow(/SIMULATION_AUTHORITY_NOT_INITIALIZED/);
  });

  it('3. Sealing after failed initialization FAILS CLOSED with SIMULATION_AUTHORITY_INITIALIZATION_FAILED', () => {
    expect(() => {
      initializeAuthorityHandshake({ simulateFailure: true });
    }).toThrow(/SIMULATION_AUTHORITY_INITIALIZATION_FAILED/);

    expect(getAuthorityInitializationState()).toBe('INITIALIZATION_FAILED');

    const binding = CanonicalDomainBindingEngine.createBinding(
      'FEM', 'ENT-SEC-002', 'REV-1', {}, 'geo-1', 'topo-1', 'mat-1', 'env-1', 'phys-1'
    );

    const testCap = issueSealingCapability('TEST', ['FEM']);
    expect(() => {
      CanonicalDomainBindingEngine.sealBinding(binding, testCap);
    }).toThrow(/SIMULATION_AUTHORITY_INITIALIZATION_FAILED/);
  });

  it('4. Direct key presentation using forged symbol or object is REJECTED with SIMULATION_AUTHORITY_VIOLATION', () => {
    initializeAuthorityHandshake();

    const binding = CanonicalDomainBindingEngine.createBinding(
      'FEM', 'ENT-SEC-003', 'REV-1', {}, 'geo-1', 'topo-1', 'mat-1', 'env-1', 'phys-1'
    );

    const fakeSymbol = Symbol('FAKE_BOOT_KEY');
    expect(() => {
      CanonicalDomainBindingEngine.sealBinding(binding, fakeSymbol);
    }).toThrow(/SIMULATION_AUTHORITY_VIOLATION/);

    const fakeObject = { key: 'FABRICATED_TOKEN' };
    expect(() => {
      CanonicalDomainBindingEngine.sealBinding(binding, fakeObject as any);
    }).toThrow(/SIMULATION_AUTHORITY_VIOLATION/);
  });

  it('5. Valid authorized sealing operation succeeds after handshake', () => {
    initializeAuthorityHandshake();

    const binding = CanonicalDomainBindingEngine.createBinding(
      'FEM', 'ENT-SEC-004', 'REV-1', { nodes: [], elements: [] }, 'geo-1', 'topo-1', 'mat-1', 'env-1', 'phys-1'
    ) as FemToCoreBinding;

    const testCap = issueSealingCapability('VALID_CONTEXT', ['FEM']);
    CanonicalDomainBindingEngine.sealBinding(binding, testCap);

    const validation = CanonicalDomainBindingEngine.validateBinding(binding);
    expect(validation.valid).toBe(true);
    expect(binding.executionAuthority.isAuthoritative).toBe(true);
    expect(binding.executionAuthority.executionSealToken).toBeDefined();
    expect(binding.executionAuthority.keyVersion).toBeDefined();
  });

  it('6. Unsealed CanonicalDomainBinding cannot authorize solver execution', () => {
    initializeAuthorityHandshake();

    const unsealedBinding = CanonicalDomainBindingEngine.createBinding(
      'FEM', 'ENT-SEC-005', 'REV-1', { nodes: [], elements: [] }, 'geo-1', 'topo-1', 'mat-1', 'env-1', 'phys-1'
    ) as FemToCoreBinding;

    const validation = CanonicalDomainBindingEngine.validateBinding(unsealedBinding);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Binding is not marked as authoritative');

    const femCore = new FEMCore();
    expect(() => {
      femCore.solve(unsealedBinding);
    }).toThrow(/SIMULATION_AUTHORITY_VIOLATION/);
  });

  it('7. Manually forged executionSealToken is rejected by validateBinding', () => {
    initializeAuthorityHandshake();

    const unsealedBinding = CanonicalDomainBindingEngine.createBinding(
      'FEM', 'ENT-SEC-006', 'REV-1', {}, 'geo-1', 'topo-1', 'mat-1', 'env-1', 'phys-1'
    );

    unsealedBinding.executionAuthority = {
      isAuthoritative: true,
      executionSealToken: 'FORGED_HMAC_SIGNATURE_1234567890ABCDEF',
      keyVersion: 'SECP-AUTH-KEY-FORGED',
      timestamp: new Date().toISOString(),
      originatingCoreRevision: 'REV-1'
    };

    const validation = CanonicalDomainBindingEngine.validateBinding(unsealedBinding);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some(e => e.includes('INVALID_SEAL_TOKEN'))).toBe(true);
  });

  it('8. Tampering with geometryHash, revisionId, domain, or entityId invalidates seal', () => {
    initializeAuthorityHandshake();

    const binding = CanonicalDomainBindingEngine.createBinding(
      'FEM', 'ENT-SEC-007', 'REV-1', {}, 'geo-orig', 'topo-1', 'mat-1', 'env-1', 'phys-1'
    ) as FemToCoreBinding;

    const testCap = issueSealingCapability('TEST_CONTEXT', ['FEM']);
    CanonicalDomainBindingEngine.sealBinding(binding, testCap);
    expect(CanonicalDomainBindingEngine.validateBinding(binding).valid).toBe(true);

    // Tamper geometryHash
    (binding as any).geometryHash = 'geo-TAMPERED';
    expect(CanonicalDomainBindingEngine.validateBinding(binding).valid).toBe(false);

    // Reset geometryHash and tamper revisionId
    (binding as any).geometryHash = 'geo-orig';
    (binding as any).revisionId = 'REV-TAMPERED';
    expect(CanonicalDomainBindingEngine.validateBinding(binding).valid).toBe(false);

    // Reset revisionId and tamper domain
    (binding as any).revisionId = 'REV-1';
    (binding as any).domain = 'CFD';
    expect(CanonicalDomainBindingEngine.validateBinding(binding).valid).toBe(false);
  });

  it('9. Stale binding or old key version after authority state reset/revocation is rejected', () => {
    initializeAuthorityHandshake();

    const binding = CanonicalDomainBindingEngine.createBinding(
      'FEM', 'ENT-SEC-008', 'REV-1', {}, 'geo-1', 'topo-1', 'mat-1', 'env-1', 'phys-1'
    ) as FemToCoreBinding;

    const testCap = issueSealingCapability('CTX-BEFORE-RESET', ['FEM']);
    CanonicalDomainBindingEngine.sealBinding(binding, testCap);
    expect(CanonicalDomainBindingEngine.validateBinding(binding).valid).toBe(true);

    // Process restart / key revocation
    revokeAuthorityState();
    initializeAuthorityHandshake(); // New key version and secret generated

    const validationAfterReset = CanonicalDomainBindingEngine.validateBinding(binding);
    expect(validationAfterReset.valid).toBe(false);
    expect(validationAfterReset.errors.some(e => e.includes('INVALID_SEAL_TOKEN'))).toBe(true);
  });

  it('10. Stale or Invalid status binding is strictly rejected', () => {
    initializeAuthorityHandshake();

    const binding = CanonicalDomainBindingEngine.createBinding(
      'FEM', 'ENT-SEC-009', 'REV-1', {}, 'geo-1', 'topo-1', 'mat-1', 'env-1', 'phys-1'
    ) as FemToCoreBinding;

    const testCap = issueSealingCapability('TEST_STATUS', ['FEM']);
    CanonicalDomainBindingEngine.sealBinding(binding, testCap);

    binding.status = 'STALE';
    let val = CanonicalDomainBindingEngine.validateBinding(binding);
    expect(val.valid).toBe(false);
    expect(val.errors).toContain('Binding status is STALE');

    binding.status = 'INVALID';
    val = CanonicalDomainBindingEngine.validateBinding(binding);
    expect(val.valid).toBe(false);
    expect(val.errors).toContain('Binding status is INVALID');
  });
});

