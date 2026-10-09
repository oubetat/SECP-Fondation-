/**
 * SECP Industrial OS — EPC-005 Test Suite
 * Tests Product Configuration Manager, Revision, Variant, Assembly, BOM, Immutability,
 * Determinism, Drift Detection, Diff Comparison, and Cross-Domain Reusability.
 */

import { describe, expect, it } from 'vitest';
import { EPC004Verifier } from '../EPC004Verifier';
import { EPC005Verifier } from '../EPC005Verifier';
import { ProductConfigurationManager } from '../ProductConfigurationManager';
import { ProductConfigurationSerializer } from '../ProductConfigurationSerializer';
import { ProductConfigurationValidationError } from '../ProductConfigurationTypes';
import { ProductConfigurationValidator } from '../ProductConfigurationValidator';

describe('EPC-005 Product Configuration Manager', () => {
  it('should create Product and initial ProductRevision correctly', () => {
    const mgr = new ProductConfigurationManager();
    const { product, revision } = mgr.createProduct({
      productId: 'PROD-PUMP-01',
      name: 'High Pressure Centrifugal Pump',
      description: 'Industrial liquid pump',
      productType: 'HYDRAULICS'
    });

    expect(product.productId).toBe('PROD-PUMP-01');
    expect(product.name).toBe('High Pressure Centrifugal Pump');
    expect(product.lifecycleStatus).toBe('DRAFT');
    expect(product.currentRevisionId).toBe('PROD-PUMP-01-REV-1');

    expect(revision.revisionId).toBe('PROD-PUMP-01-REV-1');
    expect(revision.revisionCode).toBe('A');
    expect(revision.revisionNumber).toBe(1);
    expect(revision.status).toBe('DRAFT');
  });

  it('should support revision incrementing with parent revision chaining', () => {
    const mgr = new ProductConfigurationManager();
    const { product, revision: rev1 } = mgr.createProduct({
      productId: 'PROD-VALVE-01',
      name: 'Control Valve',
      description: 'Pneumatic valve',
      productType: 'VALVES'
    });

    mgr.releaseRevision(rev1.revisionId);

    const rev2 = mgr.createRevision({
      productId: product.productId,
      revisionCode: 'B',
      parentRevisionId: rev1.revisionId
    });

    expect(rev2.revisionNumber).toBe(2);
    expect(rev2.parentRevisionId).toBe(rev1.revisionId);
    expect(rev2.revisionCode).toBe('B');

    const updatedProd = mgr.getProduct(product.productId);
    expect(updatedProd.currentRevisionId).toBe(rev2.revisionId);
  });

  it('should allow multiple ProductVariants for the same Product', () => {
    const mgr = new ProductConfigurationManager();
    const { product } = mgr.createProduct({
      productId: 'PROD-MOTOR-01',
      name: 'Electric Motor',
      description: 'AC Induction Motor',
      productType: 'ELECTRICAL'
    });

    const v1 = mgr.createVariant({
      variantId: 'VAR-11KW',
      productId: product.productId,
      variantCode: '11KW',
      name: '11kW 400V',
      description: 'Standard 11kW spec'
    });

    const v2 = mgr.createVariant({
      variantId: 'VAR-22KW',
      productId: product.productId,
      variantCode: '22KW',
      name: '22kW 400V',
      description: 'High power 22kW spec'
    });

    expect(v1.variantId).toBe('VAR-11KW');
    expect(v2.variantId).toBe('VAR-22KW');
    expect(v1.productId).toBe(product.productId);
    expect(v2.productId).toBe(product.productId);
  });

  it('should compute deterministic Assembly and BOM content hashes', () => {
    const assembly = {
      assemblyId: 'ASSY-001',
      assemblyRevision: 'REV-A',
      rootComponentId: 'C-FRAME',
      componentReferences: [
        { componentId: 'C-FRAME', name: 'Frame', revision: 'REV-1', quantity: 1 },
        { componentId: 'C-MOTOR', name: 'Motor', revision: 'REV-2', quantity: 2 }
      ]
    };

    const hash1 = ProductConfigurationSerializer.computeAssemblyHash(assembly);
    const hash2 = ProductConfigurationSerializer.computeAssemblyHash(assembly);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);

    const bom = {
      bomId: 'BOM-001',
      bomRevision: 'REV-A',
      entries: [
        { entryId: 'E-1', componentId: 'C-FRAME', name: 'Frame', revision: 'REV-1', quantity: 1, unit: 'PCS' },
        { entryId: 'E-2', componentId: 'C-MOTOR', name: 'Motor', revision: 'REV-2', quantity: 2, unit: 'PCS' }
      ]
    };

    const bomHash1 = ProductConfigurationSerializer.computeBOMHash(bom);
    const bomHash2 = ProductConfigurationSerializer.computeBOMHash(bom);

    expect(bomHash1).toBe(bomHash2);
    expect(bomHash1).toHaveLength(64);
  });

  it('should enforce assembly-BOM revision and component compatibility', () => {
    const assembly = {
      assemblyId: 'ASSY-ERR',
      assemblyRevision: 'REV-A',
      rootComponentId: 'C-1',
      componentReferences: [
        { componentId: 'C-1', name: 'C1', revision: 'REV-1', quantity: 1 },
        { componentId: 'C-2', name: 'C2', revision: 'REV-1', quantity: 1 }
      ],
      assemblyHash: ''
    };

    const bomRevisionMismatch = {
      bomId: 'BOM-ERR',
      bomRevision: 'REV-A',
      entries: [
        { entryId: 'E-1', componentId: 'C-1', name: 'C1', revision: 'REV-1', quantity: 1, unit: 'EA' },
        { entryId: 'E-2', componentId: 'C-2', name: 'C2', revision: 'REV-99', quantity: 1, unit: 'EA' }
      ],
      bomHash: ''
    };

    expect(() => {
      ProductConfigurationValidator.validateAssemblyBOMCompatibility(assembly, bomRevisionMismatch);
    }).toThrow(ProductConfigurationValidationError);
  });

  it('should qualify configuration, freeze it, compute SHA-256 contentHash, and enforce immutability', () => {
    const mgr = new ProductConfigurationManager();
    const { product, revision } = mgr.createProduct({
      productId: 'PROD-IMMU-1',
      name: 'Immutability Test Product',
      description: 'Test',
      productType: 'TEST'
    });
    const variant = mgr.createVariant({
      variantId: 'VAR-IMMU',
      productId: product.productId,
      variantCode: 'VI',
      name: 'VI',
      description: 'VI'
    });

    const assy = mgr.registerAssembly({
      assemblyId: 'ASSY-I',
      assemblyRevision: 'REV-1',
      rootComponentId: 'C-MAIN',
      componentReferences: [{ componentId: 'C-MAIN', name: 'Main', revision: 'REV-1', quantity: 1 }]
    });

    const bom = mgr.registerBOM({
      bomId: 'BOM-I',
      bomRevision: 'REV-1',
      entries: [{ entryId: 'E-1', componentId: 'C-MAIN', name: 'Main', revision: 'REV-1', quantity: 1, unit: 'EA' }]
    });

    const config = mgr.createConfiguration({
      configurationId: 'CFG-IMMU-01',
      productId: product.productId,
      revisionId: revision.revisionId,
      variantId: variant.variantId,
      configurationCode: 'CFG-I1',
      assemblyId: assy.assemblyId,
      bomId: bom.bomId
    });

    expect(config.status).toBe('DRAFT');
    expect(config.isFrozen).toBe(false);

    const qualified = mgr.qualifyConfiguration(config.configurationId);

    expect(qualified.status).toBe('QUALIFIED');
    expect(qualified.isFrozen).toBe(true);
    expect(qualified.contentHash).toBeDefined();
    expect(qualified.contentHash).toHaveLength(64);

    // Verify integrity passes
    expect(mgr.verifyIntegrity(config.configurationId)).toBe(true);

    // Attempting to update qualified configuration must throw IMMUTABILITY_VIOLATION
    expect(() => {
      mgr.updateDraftConfiguration(config.configurationId, { configurationCode: 'MODIFIED_CODE' });
    }).toThrow(ProductConfigurationValidationError);
  });

  it('should detect configuration drift accurately', () => {
    const mgr = new ProductConfigurationManager();
    const { product, revision } = mgr.createProduct({
      productId: 'PROD-DRIFT-TEST',
      name: 'Drift Test',
      description: 'Test',
      productType: 'TEST'
    });
    const variant = mgr.createVariant({
      variantId: 'VAR-D',
      productId: product.productId,
      variantCode: 'VD',
      name: 'VD',
      description: 'VD'
    });

    const assy = mgr.registerAssembly({
      assemblyId: 'ASSY-DRIFT',
      assemblyRevision: 'REV-1',
      rootComponentId: 'COMP-1',
      componentReferences: [{ componentId: 'COMP-1', name: 'Component 1', revision: 'REV-1', quantity: 1 }]
    });

    const bom = mgr.registerBOM({
      bomId: 'BOM-DRIFT',
      bomRevision: 'REV-1',
      entries: [{ entryId: 'E-1', componentId: 'COMP-1', name: 'Component 1', revision: 'REV-1', quantity: 1, unit: 'EA' }]
    });

    const config = mgr.createConfiguration({
      configurationId: 'CFG-DRIFT-01',
      productId: product.productId,
      revisionId: revision.revisionId,
      variantId: variant.variantId,
      configurationCode: 'CFG-D1',
      assemblyId: assy.assemblyId,
      bomId: bom.bomId
    });

    mgr.qualifyConfiguration(config.configurationId);

    // Baseline check without drift
    const noDrift = mgr.detectDrift(config.configurationId);
    expect(noDrift.isDriftDetected).toBe(false);

    // Simulate modified assembly revision drift
    const driftedAssyPayload = {
      assemblyId: assy.assemblyId,
      assemblyRevision: 'REV-2',
      rootComponentId: assy.rootComponentId,
      componentReferences: assy.componentReferences
    };
    const driftedAssy = {
      ...driftedAssyPayload,
      assemblyHash: ProductConfigurationSerializer.computeAssemblyHash(driftedAssyPayload)
    };

    const driftReport = mgr.detectDrift(config.configurationId, driftedAssy);
    expect(driftReport.isDriftDetected).toBe(true);
    expect(driftReport.driftedItems).toContain('assemblyRevision');
  });

  it('should compare two configurations and produce structured diffs', () => {
    const mgr = new ProductConfigurationManager();
    const { product, revision } = mgr.createProduct({
      productId: 'PROD-DIFF-TEST',
      name: 'Diff Test',
      description: 'Test',
      productType: 'TEST'
    });
    const variant = mgr.createVariant({
      variantId: 'VAR-DIFF',
      productId: product.productId,
      variantCode: 'VDF',
      name: 'VDF',
      description: 'VDF'
    });

    const assy1 = mgr.registerAssembly({
      assemblyId: 'ASSY-DIFF-1',
      assemblyRevision: 'REV-1',
      rootComponentId: 'C-1',
      componentReferences: [{ componentId: 'C-1', name: 'C1', revision: 'REV-1', quantity: 1 }]
    });
    const bom1 = mgr.registerBOM({
      bomId: 'BOM-DIFF-1',
      bomRevision: 'REV-1',
      entries: [{ entryId: 'E-1', componentId: 'C-1', name: 'C1', revision: 'REV-1', quantity: 1, unit: 'EA' }]
    });

    const assy2 = mgr.registerAssembly({
      assemblyId: 'ASSY-DIFF-2',
      assemblyRevision: 'REV-2',
      rootComponentId: 'C-1',
      componentReferences: [
        { componentId: 'C-1', name: 'C1', revision: 'REV-1', quantity: 1 },
        { componentId: 'C-2', name: 'C2', revision: 'REV-1', quantity: 3 }
      ]
    });
    const bom2 = mgr.registerBOM({
      bomId: 'BOM-DIFF-2',
      bomRevision: 'REV-2',
      entries: [
        { entryId: 'E-1', componentId: 'C-1', name: 'C1', revision: 'REV-1', quantity: 1, unit: 'EA' },
        { entryId: 'E-2', componentId: 'C-2', name: 'C2', revision: 'REV-1', quantity: 3, unit: 'EA' }
      ]
    });

    const cfg1 = mgr.createConfiguration({
      configurationId: 'CFG-DIFF-1',
      productId: product.productId,
      revisionId: revision.revisionId,
      variantId: variant.variantId,
      configurationCode: 'CD1',
      assemblyId: assy1.assemblyId,
      bomId: bom1.bomId
    });

    const cfg2 = mgr.createConfiguration({
      configurationId: 'CFG-DIFF-2',
      productId: product.productId,
      revisionId: revision.revisionId,
      variantId: variant.variantId,
      configurationCode: 'CD2',
      assemblyId: assy2.assemblyId,
      bomId: bom2.bomId
    });

    const comp = mgr.compareConfigurations(cfg1.configurationId, cfg2.configurationId);

    expect(comp.isIdentical).toBe(false);
    expect(comp.diffs.length).toBeGreaterThan(0);
    const addedComp = comp.diffs.find(d => d.path === 'assembly.components.C-2');
    expect(addedComp).toBeDefined();
    expect(addedComp?.changeType).toBe('ADDED');
  });

  it('should support historical reconstruction of exact prior states', () => {
    const mgr = new ProductConfigurationManager();
    const { product, revision: rev1 } = mgr.createProduct({
      productId: 'PROD-HIST-RECON',
      name: 'Historical Reconstruction Test',
      description: 'Test',
      productType: 'TEST'
    });
    const variant = mgr.createVariant({
      variantId: 'VAR-H',
      productId: product.productId,
      variantCode: 'VH',
      name: 'VH',
      description: 'VH'
    });

    const assy = mgr.registerAssembly({
      assemblyId: 'ASSY-H1',
      assemblyRevision: 'REV-1',
      rootComponentId: 'C-1',
      componentReferences: [{ componentId: 'C-1', name: 'C1', revision: 'REV-1', quantity: 1 }]
    });
    const bom = mgr.registerBOM({
      bomId: 'BOM-H1',
      bomRevision: 'REV-1',
      entries: [{ entryId: 'E-1', componentId: 'C-1', name: 'C1', revision: 'REV-1', quantity: 1, unit: 'EA' }]
    });

    const cfg1 = mgr.createConfiguration({
      configurationId: 'CFG-HIST-V1',
      productId: product.productId,
      revisionId: rev1.revisionId,
      variantId: variant.variantId,
      configurationCode: 'CH1',
      assemblyId: assy.assemblyId,
      bomId: bom.bomId
    });
    mgr.qualifyConfiguration(cfg1.configurationId);

    // Advance product to Revision B
    mgr.releaseRevision(rev1.revisionId);
    const rev2 = mgr.createRevision({
      productId: product.productId,
      revisionCode: 'B',
      parentRevisionId: rev1.revisionId
    });

    const cfg2 = mgr.createConfiguration({
      configurationId: 'CFG-HIST-V2',
      productId: product.productId,
      revisionId: rev2.revisionId,
      variantId: variant.variantId,
      configurationCode: 'CH2',
      assemblyId: assy.assemblyId,
      bomId: bom.bomId
    });
    mgr.qualifyConfiguration(cfg2.configurationId);

    // Reconstruct historical V1
    const histV1 = mgr.reconstructHistoricalConfiguration('CFG-HIST-V1');
    expect(histV1.revision.revisionId).toBe(rev1.revisionId);
    expect(histV1.configuration.configurationCode).toBe('CH1');

    // Reconstruct V2
    const histV2 = mgr.reconstructHistoricalConfiguration('CFG-HIST-V2');
    expect(histV2.revision.revisionId).toBe(rev2.revisionId);
    expect(histV2.configuration.configurationCode).toBe('CH2');
  });

  it('should pass all automated verification checks in EPC005Verifier', () => {
    const result = EPC005Verifier.runVerification();

    expect(result.epc).toBe('EPC-005');
    expect(result.verdict).toBe('PASS');
    expect(result.evidenceHash).toBeDefined();
    expect(result.evidenceHash).toHaveLength(64);

    expect(result.checks.PRODUCT_MODEL).toBe(true);
    expect(result.checks.REVISION_IMMUTABILITY).toBe(true);
    expect(result.checks.VARIANT_MANAGEMENT).toBe(true);
    expect(result.checks.CONFIGURATION_BINDING).toBe(true);
    expect(result.checks.ASSEMBLY_INTEGRITY).toBe(true);
    expect(result.checks.BOM_INTEGRITY).toBe(true);
    expect(result.checks.REVISION_COMPATIBILITY).toBe(true);
    expect(result.checks.DETERMINISTIC_SERIALIZATION).toBe(true);
    expect(result.checks.CRYPTOGRAPHIC_HASH).toBe(true);
    expect(result.checks.CONFIGURATION_FREEZE).toBe(true);
    expect(result.checks.DRIFT_DETECTION).toBe(true);
    expect(result.checks.HISTORICAL_RECONSTRUCTION).toBe(true);
    expect(result.checks.CONFIGURATION_COMPARISON).toBe(true);
    expect(result.checks.EPC004_BASELINE_INTEGRATION).toBe(true);
    expect(result.checks.EPC003_TRACEABILITY_INTEGRATION).toBe(true);
    expect(result.checks.CROSS_DOMAIN_REUSE).toBe(true);
    expect(result.checks.ADVERSARIAL_RESISTANCE).toBe(true);
  });
});
