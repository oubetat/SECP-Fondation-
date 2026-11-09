/**
 * SECP Industrial OS — Simulation Authority Integration Tests
 * SECP-ENGINEERING-TRUTH-INTEGRATION-004
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { FEMCore } from '../../fem/core/FEMCore';
import { Fvm3DNavierStokesSolver } from '../../cfd3d/Fvm3DNavierStokesSolver';
import { CanonicalDomainBindingEngine } from '../CanonicalDomainBindingEngine';
import { FemToCoreBinding, CfdToCoreBinding } from '../CanonicalDomainBinding';
import { initializeAuthorityHandshake } from '../../simulation/SimulationAuthorityInternal';
import { issueSealingCapability, SealingCapability } from '../../simulation/SimulationSealingAuthorization';

describe('SECP-ENGINEERING-TRUTH-INTEGRATION-004 — Simulation Authority Verification', () => {
  let testCap: SealingCapability;

  beforeAll(() => {
    initializeAuthorityHandshake();
    testCap = issueSealingCapability('AUTHORITY_TEST', ['FEM', 'CFD']);
  });

  it('QUAL-07: FEM Solver rejects unauthoritative bindings', () => {
    const femCore = new FEMCore();
    const mockFemModel: any = { nodes: [], elements: [], materials: [], bc: { displacements: [], forces: [] } };
    
    const binding = CanonicalDomainBindingEngine.createBinding(
      'FEM',
      'ENTITY-FEM-001',
      'REV-A',
      mockFemModel,
      'g-1',
      't-1',
      'm-1',
      'e-1',
      'p-1'
    ) as FemToCoreBinding;

    // isAuthoritative is false by default in createBinding
    expect(() => femCore.solve(binding)).toThrow('SIMULATION_AUTHORITY_VIOLATION: FEM solve attempted without valid execution authorization.');
  });

  it('QUAL-08: CFD Solver rejects unauthoritative bindings', () => {
    const mockCfdPayload: any = { 
      mesh: { cells: [], faces: [], quality: {}, boundingBox: { min: {x:0,y:0,z:0}, max: {x:1,y:1,z:1} } }, 
      fluid: { densityKgM3: 1.225, viscosityPaS: 1.8e-5 } 
    };
    
    const binding = CanonicalDomainBindingEngine.createBinding(
      'CFD',
      'ENTITY-CFD-001',
      'REV-A',
      mockCfdPayload,
      'g-1',
      't-1',
      'm-1',
      'e-1',
      'p-1'
    ) as CfdToCoreBinding;

    expect(() => Fvm3DNavierStokesSolver.solve(binding, {})).toThrow('SIMULATION_AUTHORITY_VIOLATION: CFD solve attempted without valid execution authorization.');
  });

  it('QUAL-09: FEM Solver accepts sealed authoritative bindings', () => {
    const femCore = new FEMCore();
    // Minimal valid model to avoid other errors
    const mockFemModel: any = { 
      nodes: [{ id: 'n1', x: 0, y: 0, z: 0 }], 
      elements: [], 
      materials: [], 
      loads: [],
      boundaryConditions: [] 
    };
    
    let binding = CanonicalDomainBindingEngine.createBinding(
      'FEM',
      'ENTITY-FEM-002',
      'REV-B',
      mockFemModel,
      'g-2',
      't-2',
      'm-2',
      'e-2',
      'p-2'
    ) as FemToCoreBinding;

    // Authoritatively seal within authority boundary
    CanonicalDomainBindingEngine.sealBinding(binding, testCap);

    // We expect it to pass authority check, even if it fails later due to empty model
    expect(() => femCore.solve(binding)).not.toThrow('SIMULATION_AUTHORITY_VIOLATION');
    // It should throw [EMPTY_MODEL_ERROR] instead of authority violation
    expect(() => femCore.solve(binding)).toThrow('[EMPTY_MODEL_ERROR]');
  });
});

