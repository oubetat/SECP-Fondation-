/**
 * SECP Industrial OS — EPC-007: CAD / CAE / CAM Dependency Graph Tests
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { EPC007Verifier } from '../EPC007Verifier';
import { MultidisciplinaryModelRegistry } from '../MultidisciplinaryModelRegistry';
import { ProductConfigurationManager } from '../ProductConfigurationManager';
import { EPC006Verifier } from '../EPC006Verifier';
import { ModelType } from '../MultidisciplinaryModelTypes';
import { DependencyStatus } from '../dependency/EngineeringDependencyTypes';

describe('EPC-007: Dependency Graph', () => {
  let registry: MultidisciplinaryModelRegistry;
  let configManager: ProductConfigurationManager;
  let verifier: EPC007Verifier;

  const mockConfig: any = {
    configurationId: 'CONF-001',
    productId: 'PROD-001',
    revisionId: 'REV-01',
    variantId: 'VAR-01'
  };

  beforeEach(() => {
    registry = new MultidisciplinaryModelRegistry();
    configManager = new ProductConfigurationManager();
    verifier = new EPC007Verifier(registry, configManager);
  });

  test('A. Valid chain: CAD -> CAE -> Mesh -> Simulation -> CAM', () => {
    const cad = EPC006Verifier.createMockModel({ id: 'CAD-01', type: ModelType.CAD, config: mockConfig, rev: 'R12' });
    const cae = EPC006Verifier.createMockModel({ id: 'CAE-01', type: ModelType.FEA, config: mockConfig, rev: 'R12', deps: ['CAD-01'] });
    const mesh = EPC006Verifier.createMockModel({ id: 'MSH-01', type: ModelType.FEA, config: mockConfig, rev: 'R12', deps: ['CAE-01'] });
    const sim = EPC006Verifier.createMockModel({ id: 'SIM-01', type: ModelType.FEA, config: mockConfig, rev: 'R12', deps: ['MSH-01'] });
    const cam = EPC006Verifier.createMockModel({ id: 'CAM-01', type: ModelType.MANUFACTURING, config: mockConfig, rev: 'R12', deps: ['SIM-01'] });

    // Fix provenance
    (cae.provenance as any).dependencies = ['CAD-01@R12'];
    (mesh.provenance as any).dependencies = ['CAE-01@R12'];
    (sim.provenance as any).dependencies = ['MSH-01@R12'];
    (cam.provenance as any).dependencies = ['SIM-01@R12'];

    registry.registerModel(cad);
    registry.registerModel(cae);
    registry.registerModel(mesh);
    registry.registerModel(sim);
    registry.registerModel(cam);

    const report = verifier.verify(mockConfig.configurationId);
    expect(report.verdict).toBe('PASS');
    expect(report.nodesValidated).toBe(true);
  });

  test('B. Broken dependency: Missing CAD', () => {
    const cae = EPC006Verifier.createMockModel({ id: 'CAE-01', type: ModelType.FEA, config: mockConfig, rev: 'R12', deps: ['CAD-MISSING'] });
    registry.registerModel(cae);

    const report = verifier.verify(mockConfig.configurationId);
    expect(report.verdict).toBe('FAIL');
    expect(report.brokenDependencyDetectionValidated).toBe(false); // In our logic, true means NO broken dependencies detected? 
    // Wait, let's look at EngineeringDependencyTypes.ts
    // brokenDependencyDetectionValidated: !validation.issues.some(i => i.includes('BROKEN'))
    // So if it fails, it means it DETECTED a broken dependency.
  });

  test('D. Stale CAD revision', () => {
    // Initial State: R12
    const cadR12 = EPC006Verifier.createMockModel({ id: 'CAD-01', type: ModelType.CAD, config: mockConfig, rev: 'R12' });
    const caeR12 = EPC006Verifier.createMockModel({ id: 'CAE-01', type: ModelType.FEA, config: mockConfig, rev: 'R12', deps: ['CAD-01'] });
    
    // Fix provenance to point to R12 instead of default REV-A
    (caeR12.provenance as any).dependencies = ['CAD-01@R12'];

    registry.registerModel(cadR12);
    registry.registerModel(caeR12);

    // New CAD Revision: R13
    const cadR13 = EPC006Verifier.createMockModel({ id: 'CAD-01', type: ModelType.CAD, config: mockConfig, rev: 'R13' });
    registry.registerModel(cadR13);

    const report = verifier.verify(mockConfig.configurationId);
    expect(report.verdict).toBe('FAIL');
    expect(report.revisionPropagationValidated).toBe(false); // Detected staleness
  });

  test('E. Configuration mismatch', () => {
    const mockConfigB: any = { ...mockConfig, configurationId: 'CONF-002' };
    const cad = EPC006Verifier.createMockModel({ id: 'CAD-01', type: ModelType.CAD, config: mockConfigB, rev: 'R12' });
    
    registry.registerModel(cad);

    const report = verifier.verify(mockConfig.configurationId);
    // The verifier builds graph for CONF-001, but we registered a model for CONF-002.
    // registry.getModelsByConfiguration('CONF-001') will return empty.
    expect(report.nodesValidated).toBe(false);
  });

  test('H. Cycle: CAD -> CAE -> Simulation -> CAD', () => {
    const cad = EPC006Verifier.createMockModel({ id: 'CAD-01', type: ModelType.CAD, config: mockConfig, rev: 'R12', deps: ['SIM-01'] });
    const cae = EPC006Verifier.createMockModel({ id: 'CAE-01', type: ModelType.FEA, config: mockConfig, rev: 'R12', deps: ['CAD-01'] });
    const sim = EPC006Verifier.createMockModel({ id: 'SIM-01', type: ModelType.FEA, config: mockConfig, rev: 'R12', deps: ['CAE-01'] });

    // Fix provenance
    (cad.provenance as any).dependencies = ['SIM-01@R12'];
    (cae.provenance as any).dependencies = ['CAD-01@R12'];
    (sim.provenance as any).dependencies = ['CAE-01@R12'];

    registry.registerModel(cad);
    registry.registerModel(cae);
    registry.registerModel(sim);

    const report = verifier.verify(mockConfig.configurationId);
    expect(report.verdict).toBe('FAIL');
    expect(report.cycleDetectionValidated).toBe(false); // Detected cycle
  });

  test('I. Impact Analysis', () => {
    const cad = EPC006Verifier.createMockModel({ id: 'CAD-01', type: ModelType.CAD, config: mockConfig, rev: 'R12' });
    const cae = EPC006Verifier.createMockModel({ id: 'CAE-01', type: ModelType.FEA, config: mockConfig, rev: 'R12', deps: ['CAD-01'] });
    const mesh = EPC006Verifier.createMockModel({ id: 'MSH-01', type: ModelType.FEA, config: mockConfig, rev: 'R12', deps: ['CAE-01'] });

    // Fix provenance for correct linking
    (cae.provenance as any).dependencies = ['CAD-01@R12'];
    (mesh.provenance as any).dependencies = ['CAE-01@R12'];

    registry.registerModel(cad);
    registry.registerModel(cae);
    registry.registerModel(mesh);

    const impact = verifier.getImpact('CAD-01', mockConfig.configurationId);
    expect(impact.directImpacts).toContain('CAE-01');
    expect(impact.indirectImpacts).toContain('MSH-01');
    expect(impact.requiresRegeneration).toContain('CAE-01');
    expect(impact.requiresRegeneration).toContain('MSH-01');
  });

  test('F. Geometry hash mismatch', () => {
    const cad = EPC006Verifier.createMockModel({ id: 'CAD-01', type: ModelType.CAD, config: mockConfig, rev: 'R12' });
    registry.registerModel(cad);

    // Build graph
    const graph = (verifier as any).graphService.buildGraph(mockConfig.configurationId);
    
    // Maliciously alter hash in graph node
    const tamperedNode = graph.nodes.find((n: any) => n.id === 'CAD-01');
    (tamperedNode as any).contentHash = 'FORGED_HASH';

    const validation = (verifier as any).validator.validate(graph);
    expect(validation.verdict).toBe('INVALID');
    expect(validation.issues.some((i: string) => i.includes('HASH_MISMATCH'))).toBe(true);
  });

  test('L. Adversarial: Incompatible configuration', () => {
    const cad = EPC006Verifier.createMockModel({ id: 'CAD-01', type: ModelType.CAD, config: { ...mockConfig, configurationId: 'WRONG-CONFIG' }, rev: 'R12' });
    // Manually register it under CONF-001 in our local test logic if possible, or just build graph for CONF-001
    // Actually, getModelsByConfiguration will only return it if the configurationId matches.
    
    // Let's force a node into a graph that shouldn't be there
    const graph = (verifier as any).graphService.buildGraph(mockConfig.configurationId);
    const node = (verifier as any).graphService.mapModelToNode(cad);
    graph.nodes.push(node);

    const validation = (verifier as any).validator.validate(graph);
    expect(validation.verdict).toBe('INVALID');
    expect(validation.issues.some((i: string) => i.includes('INCOMPATIBLE_CONFIGURATION'))).toBe(true);
  });
});
