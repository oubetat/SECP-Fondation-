/**
 * SECP Industrial OS — EPC-008: Simulation Scenario Registry Tests
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { SimulationScenarioRegistry } from '../SimulationScenarioRegistry';
import { 
  SimulationScenario, 
  ScenarioLifecycle, 
  ParameterType,
  SimulationScenarioError 
} from '../SimulationScenarioTypes';

describe('EPC-008: Simulation Scenario Registry', () => {
  let registry: SimulationScenarioRegistry;

  const validScenario: SimulationScenario = {
    id: 'SCN-001',
    name: 'Drone Wing Stress Analysis',
    description: 'Structural analysis of the main wing spar',
    domain: 'DRONE',
    status: ScenarioLifecycle.DRAFT,
    geometry: { modelId: 'CAD-WING-001', revision: 'R1', hash: 'abc123hash' },
    material: { materialId: 'MAT-AL-6061', revision: 'V2', propertiesHash: 'mat-hash' },
    loads: [{ id: 'L1', type: 'PRESSURE', magnitude: 5000, unit: 'Pa', reference: 'Top_Surface' }],
    boundaryConditions: [{ id: 'BC1', type: 'FIXED', value: 0, unit: 'mm', location: 'Root', reference: 'Root_Face' }],
    solver: { solverId: 'FEA-CORE-X', version: 'v1.2', configurationHash: 'solver-cfg', settings: {} },
    mesh: { meshId: 'MSH-WING-01', revision: 'R1', elementType: 'TET10', elementCount: 45000, hash: 'msh-hash' },
    parameters: [{ id: 'P1', name: 'Airspeed', value: 35, unit: 'm/s', type: ParameterType.NUMBER }],
    revision: 'R1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'A. Oubetat'
  };

  beforeEach(() => {
    registry = new SimulationScenarioRegistry();
  });

  test('Test 1: Register complete scenario', () => {
    expect(() => registry.registerScenario(validScenario)).not.toThrow();
    const retrieved = registry.getScenario('SCN-001', 'R1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('SCN-001');
  });

  test('Test 2: Reject scenario without Geometry', () => {
    const invalid = { ...validScenario, geometry: {} as any };
    expect(() => registry.registerScenario(invalid)).toThrow(/MISSING_GEOMETRY/);
  });

  test('Test 3: Reject scenario without Material', () => {
    const invalid = { ...validScenario, material: {} as any };
    expect(() => registry.registerScenario(invalid)).toThrow(/MISSING_MATERIAL/);
  });

  test('Test 4: Reject scenario without Solver', () => {
    const invalid = { ...validScenario, solver: {} as any };
    expect(() => registry.registerScenario(invalid)).toThrow(/MISSING_SOLVER/);
  });

  test('Test 5: Reject scenario without Mesh', () => {
    const invalid = { ...validScenario, mesh: {} as any };
    expect(() => registry.registerScenario(invalid)).toThrow(/MISSING_MESH/);
  });

  test('Test 6: Reject scenario without Boundary Conditions', () => {
    const invalid = { ...validScenario, boundaryConditions: [] };
    expect(() => registry.registerScenario(invalid)).toThrow(/MISSING_BOUNDARY_CONDITION/);
  });

  test('Test 7: Revisioning R1 -> R2', () => {
    registry.registerScenario(validScenario);
    
    const r2 = registry.createRevision('SCN-001', 'R2', (base) => ({
      description: 'Revised analysis with higher airspeed',
      parameters: [{ ...base.parameters[0], value: 45 }]
    }));

    expect(r2.revision).toBe('R2');
    expect(r2.parameters[0].value).toBe(45);

    const r1 = registry.getScenario('SCN-001', 'R1');
    expect(r1).toBeDefined();
    expect(r1?.parameters[0].value).toBe(35);
  });

  test('Test 8: Attempt to modify Frozen Scenario', () => {
    registry.registerScenario(validScenario);
    registry.freezeScenario('SCN-001', 'R1');

    const frozen = registry.getScenario('SCN-001', 'R1');
    expect(frozen?.status).toBe(ScenarioLifecycle.FROZEN);

    expect(() => registry.updateScenario('SCN-001', 'R1', { name: 'Changed Name' }))
      .toThrow(SimulationScenarioError.FROZEN_MODIFICATION_DENIED);
  });

  test('Test 9: Execution Baseline (Reproducibility)', () => {
    registry.registerScenario(validScenario);
    registry.freezeScenario('SCN-001', 'R1');
    
    const baseline = registry.createExecutionBaseline('SCN-001', 'R1');
    expect(baseline).toBeDefined();
    expect(baseline.snapshot.revision).toBe('R1');
    expect(baseline.snapshot.geometry.hash).toBe(validScenario.geometry.hash);
    
    const scenario = registry.getScenario('SCN-001', 'R1');
    expect(scenario?.status).toBe(ScenarioLifecycle.EXECUTED);
  });

  test('Test 10: Referential Integrity (Rejected duplicate revision)', () => {
    registry.registerScenario(validScenario);
    expect(() => registry.registerScenario(validScenario)).toThrow(/already exists/);
  });

  test('Verification of Parameter structure and types', () => {
    registry.registerScenario(validScenario);
    const scenario = registry.getScenario('SCN-001');
    const param = scenario?.parameters[0];
    expect(param?.type).toBe(ParameterType.NUMBER);
    expect(param?.value).toBe(35);
  });
});
