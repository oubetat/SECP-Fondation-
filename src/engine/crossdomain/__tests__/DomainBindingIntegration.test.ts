/**
 * SECP Industrial OS — Domain Binding Integration Tests
 * SECP-ENGINEERING-TRUTH-INTEGRATION-004
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PcbVerificationService } from '../../pcb/PcbVerificationService';
import { NodalCircuitSolver } from '../../engineeringCore/NodalCircuitSolver';
import { CanonicalDomainBindingEngine } from '../CanonicalDomainBindingEngine';
import { PcbToCoreBinding, ElectricalToCoreBinding } from '../CanonicalDomainBinding';
import { initializeAuthorityHandshake } from '../../simulation/SimulationAuthorityInternal';
import { issueSealingCapability, SealingCapability } from '../../simulation/SimulationSealingAuthorization';

describe('SECP-ENGINEERING-TRUTH-INTEGRATION-004 — Domain Binding Integration', () => {
  let testCap: SealingCapability;
  
  beforeEach(() => {
    initializeAuthorityHandshake();
    testCap = issueSealingCapability('INTEGRATION_TEST', ['PCB', 'ELECTRICAL']);
  });

  it('QUAL-04: PCB Verification requires valid PcbToCoreBinding (TD-001)', () => {
    const mockModel: any = {
      designId: 'PCB-PROD-001',
      revisionId: 'REV-A',
      boardWidthMm: 100,
      boardHeightMm: 80,
      thicknessMm: 1.6,
      layerCount: 2,
      components: [],
      schematicNets: [],
      placements: [],
      traces: [],
      vias: [],
      mountingHoles: [],
      footprintLibrary: {},
      rules: { minClearanceMm: 0.1, minTraceWidthMm: 0.1, boardMarginMm: 1 }
    };

    const binding = CanonicalDomainBindingEngine.createBinding(
      'PCB',
      'ENTITY-PCB-001',
      'REV-A',
      mockModel,
      'g-1',
      't-1',
      'm-1',
      'e-1',
      'p-1'
    ) as PcbToCoreBinding;

    CanonicalDomainBindingEngine.sealBinding(binding, testCap);

    const result = PcbVerificationService.verifyAndAttest(binding, undefined, false);
    expect(result.overallStatus).toBeDefined();
    expect(result.evidence.designId).toBe('ENTITY-PCB-001');
    expect(result.evidence.revisionId).toBe('REV-A');
  });

  it('QUAL-05: Electrical MNA Solver requires valid ElectricalToCoreBinding (TD-002)', () => {
    const mockCircuit: any = {
      id: 'CIRC-001',
      components: [
        { id: 'V1', type: 'VOLTAGE_SOURCE', value: 12, nodes: ['N1', 'GND'] },
        { id: 'R1', type: 'RESISTOR', value: 1000, nodes: ['N1', 'GND'] }
      ]
    };

    const binding = CanonicalDomainBindingEngine.createBinding(
      'ELECTRICAL',
      'ENTITY-ELEC-001',
      'REV-B',
      mockCircuit,
      'N/A',
      't-1',
      'm-1',
      'e-1',
      'p-1'
    ) as ElectricalToCoreBinding;

    CanonicalDomainBindingEngine.sealBinding(binding, testCap);

    const result = NodalCircuitSolver.solveDetailed(binding);
    expect(result.success).toBe(true);
    expect(result.nodeVoltages['N1']).toBeCloseTo(12, 4);
  });

  it('QUAL-06: Electrical MNA Solver rejects STALE bindings', () => {
    const mockCircuit: any = { id: 'C1', components: [{ id: 'V1', type: 'VOLTAGE_SOURCE', value: 5, nodes: ['A', 'GND'] }] };
    const binding: any = CanonicalDomainBindingEngine.createBinding('ELECTRICAL', 'E1', 'R1', mockCircuit, 'g', 't', 'm', 'e', 'p');
    
    CanonicalDomainBindingEngine.sealBinding(binding, testCap);
    
    // Explicitly mark as STALE
    binding.status = 'STALE';

    expect(() => NodalCircuitSolver.solveDetailed(binding)).toThrow('CANONICAL_VIOLATION: Attempting to solve STALE electrical model');
  });
});

