/**
 * SECP Industrial OS — EPC-004: Engineering Configuration Baseline Test Suite
 * Comprehensive Validation, Verification, Lifecycle, and Adversarial Tests for EPC-004.
 */

import { describe, it, expect } from 'vitest';
import { ConfigurationBaselineManager } from '../ConfigurationBaselineManager';
import { ConfigurationBaselineValidator } from '../ConfigurationBaselineValidator';
import { ConfigurationBaselineSerializer } from '../ConfigurationBaselineSerializer';
import { EPC004Verifier } from '../EPC004Verifier';
import { ConfigurationBaselineValidationError } from '../ConfigurationBaselineTypes';

describe('EPC-004: Engineering Configuration Baseline', () => {
  // 1. Create Baseline Draft
  it('1. creates a valid DRAFT engineering configuration baseline with all 8 mandatory components', () => {
    const mgr = EPC004Verifier.createSampleBaselineManager('001');
    const data = mgr.getData();

    expect(data.baselineId).toBe('BASELINE-001');
    expect(data.status).toBe('DRAFT');
    expect(data.isFrozen).toBe(false);
    expect(data.cad).toBeDefined();
    expect(data.materials.length).toBe(1);
    expect(data.parameters.parameters.length).toBe(2);
    expect(data.simulationModels.length).toBe(1);
    expect(data.mesh).toBeDefined();
    expect(data.solver).toBeDefined();
    expect(data.controls).toBeDefined();
    expect(data.manufacturingDefinition).toBeDefined();
  });

  // 2. Validate Baseline Structure
  it('2. validates baseline data structure against validator rules', () => {
    const mgr = EPC004Verifier.createSampleBaselineManager('002');
    const data = mgr.getData();
    expect(() => ConfigurationBaselineValidator.validate(data)).not.toThrow();
  });

  // 3. Compute Deterministic Canonical Hash
  it('3. computes deterministic canonical content hash for baseline payload', () => {
    const mgr = EPC004Verifier.createSampleBaselineManager('003');
    const data = mgr.getData();
    const result = ConfigurationBaselineSerializer.serialize(data);

    expect(result.canonicalString).toBeDefined();
    expect(result.contentHash).toBeDefined();
    expect(result.contentHash.length).toBe(64);
  });

  // 4. Qualify and Freeze Baseline
  it('4. qualifies and freezes baseline, producing immutable status and contentHash', () => {
    const mgr = EPC004Verifier.createSampleBaselineManager('004');
    const qualified = mgr.qualify();

    expect(qualified.status).toBe('QUALIFIED');
    expect(qualified.isFrozen).toBe(true);
    expect(qualified.contentHash).toBeDefined();
    expect(qualified.provenance.contentHash).toBe(qualified.contentHash);
  });

  // 5. Immutability Enforcement
  it('5. enforces immutability by rejecting direct component mutation on qualified baseline', () => {
    const mgr = EPC004Verifier.createSampleBaselineManager('005');
    mgr.qualify();

    expect(() => {
      mgr.updateCad({
        ...mgr.getData().cad,
        revision: 'v9.9.9'
      });
    }).toThrowError(ConfigurationBaselineValidationError);

    try {
      mgr.updateCad({ ...mgr.getData().cad, revision: 'v9.9.9' });
    } catch (e: any) {
      expect(e.code).toBe('IMMUTABILITY_VIOLATION');
    }
  });

  // 6. Drift Detection - CAD Geometry
  it('6. detects configuration drift when CAD geometry hash is modified', () => {
    const mgr1 = EPC004Verifier.createSampleBaselineManager('006A');
    const mgr2 = EPC004Verifier.createSampleBaselineManager('006B');

    mgr2.updateCad({
      ...mgr2.getData().cad,
      geometryHash: '1111111111111111111111111111111111111111111111111111111111111111'
    });

    const report = mgr1.detectDrift(mgr2);
    expect(report.isDriftDetected).toBe(true);
    expect(report.driftedComponents).toContain('CAD');
    expect(report.details.some(d => d.field === 'geometryHash')).toBe(true);
  });

  // 7. Drift Detection - Material Properties
  it('7. detects configuration drift when material properties change', () => {
    const mgr1 = EPC004Verifier.createSampleBaselineManager('007A');
    const mgr2 = EPC004Verifier.createSampleBaselineManager('007B');

    const updatedMaterials = [...mgr2.getData().materials];
    updatedMaterials[0] = {
      ...updatedMaterials[0],
      properties: { ...updatedMaterials[0].properties, yieldStrengthMPa: 600 }
    };
    mgr2.updateMaterials(updatedMaterials);

    const report = mgr1.detectDrift(mgr2);
    expect(report.isDriftDetected).toBe(true);
    expect(report.driftedComponents).toContain('MATERIALS');
  });

  // 8. Drift Detection - Parameter Value
  it('8. detects configuration drift when operating parameter value changes', () => {
    const mgr1 = EPC004Verifier.createSampleBaselineManager('008A');
    const mgr2 = EPC004Verifier.createSampleBaselineManager('008B');

    const params = { ...mgr2.getData().parameters };
    params.parameters = params.parameters.map(p =>
      p.name === 'max_operating_pressure' ? { ...p, value: 400 } : p
    );
    mgr2.updateParameters(params);

    const report = mgr1.detectDrift(mgr2);
    expect(report.isDriftDetected).toBe(true);
    expect(report.driftedComponents).toContain('PARAMETERS');
  });

  // 9. Drift Detection - Solver Tolerances
  it('9. detects configuration drift when solver tolerances change', () => {
    const mgr1 = EPC004Verifier.createSampleBaselineManager('009A');
    const mgr2 = EPC004Verifier.createSampleBaselineManager('009B');

    const solver = { ...mgr2.getData().solver };
    solver.tolerances = { absTol: 1e-12, relTol: 1e-9 };
    mgr2.updateSolver(solver);

    const report = mgr1.detectDrift(mgr2);
    expect(report.isDriftDetected).toBe(true);
    expect(report.driftedComponents).toContain('SOLVER');
  });

  // 10. Revisioning - Create New Baseline Revision
  it('10. creates a new baseline revision referencing parent while leaving parent qualified baseline unchanged', () => {
    const mgr1 = EPC004Verifier.createSampleBaselineManager('010');
    const parentData = mgr1.qualify();

    const mgr2 = mgr1.createRevision({
      newBaselineId: 'BASELINE-010-REV2',
      newConfigurationRevision: 'CFG-REV2',
      createdBy: 'ENGINEER-LEAD-02'
    });

    const rev2Data = mgr2.getData();

    expect(parentData.status).toBe('QUALIFIED');
    expect(parentData.isFrozen).toBe(true);

    expect(rev2Data.baselineId).toBe('BASELINE-010-REV2');
    expect(rev2Data.configurationRevision).toBe('CFG-REV2');
    expect(rev2Data.status).toBe('DRAFT');
    expect(rev2Data.isFrozen).toBe(false);
    expect(rev2Data.provenance.parentBaselineId).toBe('BASELINE-010');
  });

  // 11. Reproducibility & Integrity Verification
  it('11. verifies reproducibility by round-tripping deserialized baseline and recomputing hash', () => {
    const mgr = EPC004Verifier.createSampleBaselineManager('011');
    const qualified = mgr.qualify();

    const serialized = ConfigurationBaselineSerializer.serialize(qualified);
    const restoredData = ConfigurationBaselineSerializer.deserialize(serialized.canonicalString);
    const reserialized = ConfigurationBaselineSerializer.serialize(restoredData);

    expect(serialized.contentHash).toBe(reserialized.contentHash);
    expect(mgr.verifyIntegrity()).toBe(true);
  });

  // 12. Adversarial - Missing Solver Component
  it('12. rejects baseline qualification when solver component is missing', () => {
    const mgr = EPC004Verifier.createSampleBaselineManager('012');
    const data = mgr.getData();
    (data as any).solver = undefined;

    expect(() => ConfigurationBaselineValidator.validate(data)).toThrowError(
      ConfigurationBaselineValidationError
    );
  });

  // 13. Adversarial - Missing Mesh Component
  it('13. rejects baseline qualification when mesh component is missing', () => {
    const mgr = EPC004Verifier.createSampleBaselineManager('013');
    const data = mgr.getData();
    (data as any).mesh = undefined;

    expect(() => ConfigurationBaselineValidator.validate(data)).toThrowError(
      ConfigurationBaselineValidationError
    );
  });

  // 14. Adversarial - Broken CAD Geometry Reference in Simulation
  it('14. rejects baseline when simulation model references nonexistent CAD geometry', () => {
    const mgr = EPC004Verifier.createSampleBaselineManager('014');

    expect(() => {
      mgr.updateSimulationModels([
        {
          ...mgr.getData().simulationModels[0],
          referencedGeometryId: 'BROKEN_CAD_ID'
        }
      ]);
    }).toThrowError(ConfigurationBaselineValidationError);
  });

  // 15. Adversarial - Broken Material Reference in Simulation
  it('15. rejects baseline when simulation model references nonexistent material ID', () => {
    const mgr = EPC004Verifier.createSampleBaselineManager('015');

    expect(() => {
      mgr.updateSimulationModels([
        {
          ...mgr.getData().simulationModels[0],
          referencedMaterialIds: ['NONEXISTENT_MAT_ID']
        }
      ]);
    }).toThrowError(ConfigurationBaselineValidationError);
  });

  // 16. Adversarial - Circular Dependency Graph
  it('16. rejects baseline dependency graph containing circular references', () => {
    const mgr = EPC004Verifier.createSampleBaselineManager('016');
    const data = mgr.getData();

    data.dependencyGraph = {
      nodes: [
        { nodeId: 'N1', componentType: 'CAD', artifactId: 'CAD-1', revision: 'v1' },
        { nodeId: 'N2', componentType: 'MESH', artifactId: 'MESH-1', revision: 'v1' }
      ],
      edges: [
        { edgeId: 'E1', sourceNodeId: 'N1', targetNodeId: 'N2', relationship: 'USES' },
        { edgeId: 'E2', sourceNodeId: 'N2', targetNodeId: 'N1', relationship: 'USES' }
      ]
    };

    expect(() => ConfigurationBaselineValidator.validate(data)).toThrowError(
      ConfigurationBaselineValidationError
    );
  });

  // 17. Automated EPC-004 Verifier
  it('17. passes automated EPC004Verifier execution with PASS verdict and evidence hash', () => {
    const report = EPC004Verifier.runVerification();
    expect(report.verdict).toBe('PASS');
    expect(report.evidenceHash).toBeDefined();
    expect(report.evidenceHash.length).toBe(64);
    expect(Object.values(report.checks).every(v => v === true)).toBe(true);
  });
});
