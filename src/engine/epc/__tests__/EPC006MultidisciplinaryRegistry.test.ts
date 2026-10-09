/**
 * SECP Industrial OS — EPC-006: Multidisciplinary Model Registry Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MultidisciplinaryModelRegistry } from '../MultidisciplinaryModelRegistry';
import { EPC006Verifier } from '../EPC006Verifier';
import { ModelType } from '../MultidisciplinaryModelTypes';
import { ProductConfigurationData } from '../ProductConfigurationTypes';

describe('EPC-006: Multidisciplinary Model Registry', () => {
  let registry: MultidisciplinaryModelRegistry;
  let verifier: EPC006Verifier;

  const mockConfig: ProductConfigurationData = {
    configurationId: 'CONF-001',
    productId: 'PROD-001',
    revisionId: 'REV-01',
    variantId: 'VAR-01',
    configurationCode: 'C1',
    status: 'QUALIFIED',
    assembly: { assemblyId: 'A1', assemblyRevision: 'R1', rootComponentId: 'C1', componentReferences: [], assemblyHash: 'h1' },
    bom: { bomId: 'B1', bomRevision: 'R1', entries: [], bomHash: 'h1' },
    createdAt: new Date().toISOString(),
    createdBy: 'test-user',
    provenance: { creator: 'test-user', createdAt: new Date().toISOString(), productId: 'PROD-001', revisionId: 'REV-01', variantId: 'VAR-01', configurationId: 'CONF-001', assemblyId: 'A1', assemblyRevision: 'R1', bomId: 'B1', bomRevision: 'R1', sourceRevisions: {} }
  };

  beforeEach(() => {
    registry = new MultidisciplinaryModelRegistry();
    verifier = new EPC006Verifier(registry);
  });

  describe('Core Functionality', () => {
    it('should register valid CAD and FEA models', () => {
      const cad = EPC006Verifier.createMockModel({ id: 'CAD-001', type: ModelType.CAD, config: mockConfig });
      const fea = EPC006Verifier.createMockModel({ id: 'FEA-001', type: ModelType.FEA, config: mockConfig, deps: ['CAD-001'] });

      registry.registerModel(cad);
      registry.registerModel(fea);

      expect(registry.getModel('CAD-001')).toBeDefined();
      expect(registry.getModel('FEA-001')).toBeDefined();
      expect(registry.getModel('FEA-001')?.dependencyIds).toContain('CAD-001');
    });

    it('should prevent mutation of released models', () => {
      const cad = EPC006Verifier.createMockModel({ id: 'CAD-001', type: ModelType.CAD, config: mockConfig, status: 'RELEASED' });
      registry.registerModel(cad);

      const mutatedCad = { ...cad, name: 'Mutated Name' };
      // We need to re-hash if we were actually testing hash mismatch, 
      // but here we test the "RELEASED" check.
      
      expect(() => registry.registerModel(mutatedCad)).toThrow(/Cannot mutate released model/);
    });

    it('should detect circular dependencies', () => {
      const m1 = EPC006Verifier.createMockModel({ id: 'M1', type: ModelType.CAD, config: mockConfig, deps: ['M2'] });
      const m2 = EPC006Verifier.createMockModel({ id: 'M2', type: ModelType.CAD, config: mockConfig, deps: ['M1'] });

      registry.registerModel(m1);
      registry.registerModel(m2);

      const integrity = registry.validateRegistryIntegrity();
      expect(integrity.valid).toBe(false);
      expect(integrity.checks.noCycles).toBe(false);
    });
  });

  describe('EPC-006 Verification', () => {
    it('should PASS when all required domains are registered correctly', () => {
      const cad = EPC006Verifier.createMockModel({ id: 'CAD-01', type: ModelType.CAD, config: mockConfig });
      const fea = EPC006Verifier.createMockModel({ id: 'FEA-01', type: ModelType.FEA, config: mockConfig, deps: ['CAD-01'] });
      const cfd = EPC006Verifier.createMockModel({ id: 'CFD-01', type: ModelType.CFD, config: mockConfig, deps: ['CAD-01'] });

      registry.registerModel(cad);
      registry.registerModel(fea);
      registry.registerModel(cfd);

      const result = verifier.verify(mockConfig);
      expect(result.verdict).toBe('PASS');
    });

    it('should FAIL if CAD registration is missing', () => {
      const fea = EPC006Verifier.createMockModel({ id: 'FEA-01', type: ModelType.FEA, config: mockConfig });
      registry.registerModel(fea);

      const result = verifier.verify(mockConfig);
      expect(result.verdict).toBe('FAIL');
      expect(result.checks.cadRegistration).toBe(false);
    });
  });

  describe('Cross-Domain Use Cases', () => {
    it('should support Robotic Arm model set', () => {
      const robotConfig: ProductConfigurationData = { ...mockConfig, productId: 'ROBOT-001' };
      
      const cad = EPC006Verifier.createMockModel({ id: 'ROBOT-CAD', type: ModelType.CAD, config: robotConfig });
      const dynamics = EPC006Verifier.createMockModel({ id: 'ROBOT-DYN', type: ModelType.DYNAMICS, config: robotConfig, deps: ['ROBOT-CAD'] });
      const control = EPC006Verifier.createMockModel({ id: 'ROBOT-CTRL', type: ModelType.CONTROL, config: robotConfig, deps: ['ROBOT-DYN'] });

      registry.registerModel(cad);
      registry.registerModel(dynamics);
      registry.registerModel(control);

      const models = registry.getModelsByConfiguration(robotConfig.configurationId);
      expect(models.length).toBe(3);
    });
  });

  describe('Adversarial Testing', () => {
    it('should detect content hash tampering', () => {
      const cad = EPC006Verifier.createMockModel({ id: 'CAD-001', type: ModelType.CAD, config: mockConfig });
      const tamperedCad = { ...cad, contentHash: 'wrong-hash' };

      expect(() => registry.registerModel(tamperedCad)).toThrow(/Content hash mismatch/);
    });

    it('should detect stale dependencies', () => {
      const cadV1 = EPC006Verifier.createMockModel({ id: 'CAD-1', type: ModelType.CAD, config: mockConfig, rev: 'REV-A' });
      const fea = EPC006Verifier.createMockModel({ id: 'FEA-1', type: ModelType.FEA, config: mockConfig, deps: ['CAD-1'] });
      
      registry.registerModel(cadV1);
      registry.registerModel(fea);

      const cadV2 = EPC006Verifier.createMockModel({ id: 'CAD-1', type: ModelType.CAD, config: mockConfig, rev: 'REV-B' });
      registry.registerModel(cadV2);

      const validation = registry.validateCompatibility(fea, cadV2);
      expect(validation.status).toBe('STALE');
    });
  });
});
