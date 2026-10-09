/**
 * SECP — ADSE-P6 Thermal Integration Forensic & Verification Suite
 * 
 * Formal Verification of the 32 Forensic Gates (P6-V1 through P6-V32)
 * and 35/35 Capability Registry Reconciliation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP6ThermalEngine } from '../../../src/engine/adse/p6/ADSEP6ThermalEngine';
import { ADSEP6ForensicAuditEngine } from '../../../src/engine/adse/p6/ADSEP6ForensicAuditEngine';
import { ADSEEngine } from '../../../src/engine/adse/p0/ADSEEngine';

describe('ADSE-P6 Thermal Integration Forensics & 32 Gates', () => {
  let p6: ADSEP6ThermalEngine;
  let auditor: ADSEP6ForensicAuditEngine;

  beforeEach(() => {
    p6 = new ADSEP6ThermalEngine();
    p6.clear();
    auditor = new ADSEP6ForensicAuditEngine(p6);
  });

  it('P6-CAP-001 through P6-CAP-035: Reconciles all 35 Capabilities in ADSEEngine', () => {
    const adse = ADSEEngine.getInstance();
    const allCaps = adse.getAllCapabilities().filter(c => c.stage === 'P6_THERMAL_INTEGRATION');
    expect(allCaps.length).toBe(35);

    const requiredCaps = [
      'ADSE_THERMAL_INTEGRATION',
      'ADSE_THERMAL_TRUTH',
      'ADSE_THERMAL_MODEL',
      'ADSE_THERMAL_REGIONS',
      'ADSE_THERMAL_TOPOLOGY',
      'ADSE_THERMAL_PATHS',
      'ADSE_HEAT_SOURCE_TRUTH',
      'ADSE_HEAT_SINK_TRUTH',
      'ADSE_THERMAL_LOADS',
      'ADSE_THERMAL_BOUNDARIES',
      'ADSE_THERMAL_INTERFACES',
      'ADSE_THERMAL_MATERIAL_BINDING',
      'ADSE_THERMAL_PROPERTY_TRUTH',
      'ADSE_CONDUCTION_ANALYSIS',
      'ADSE_CONVECTION_ANALYSIS',
      'ADSE_RADIATION_ANALYSIS',
      'ADSE_STEADY_STATE_THERMAL',
      'ADSE_TRANSIENT_THERMAL',
      'ADSE_THERMAL_EXECUTION',
      'ADSE_THERMAL_SOLVER_BINDING',
      'ADSE_THERMAL_RESULT_INVALIDATION',
      'ADSE_THERMAL_CONSTRAINTS',
      'ADSE_THERMAL_MARGINS',
      'ADSE_THERMAL_IMPACT_ANALYSIS',
      'ADSE_THERMAL_STRUCTURAL_COUPLING',
      'ADSE_THERMAL_DIGITAL_THREAD',
      'ADSE_THERMAL_VERIFICATION',
      'ADSE_THERMAL_EVIDENCE',
      'ADSE_THERMAL_PROVENANCE',
      'ADSE_THERMAL_PERSISTENCE',
      'ADSE_THERMAL_RECONSTRUCTION',
      'ADSE_THERMAL_AI_GOVERNANCE',
      'ADSE_THERMAL_FORENSIC_AUDIT',
      'ADSE_THERMAL_PUBLICATION',
      'ADSE_THERMAL_TRUTH_CLOSURE'
    ];

    for (const cap of requiredCaps) {
      expect(adse.getCapability(cap)).toBeDefined();
    }
  });

  it('P6-V1 to P6-V32: Audits all 32 Forensic Gates successfully on a complete canonical model', () => {
    // 1. Register Authoritative Material
    p6.materials.registerMaterialBinding({
      bindingId: 'bind:mat:al6061',
      materialId: 'mat:aluminum:6061-T6',
      materialRevision: 1,
      canonicalName: 'Aluminum 6061-T6',
      conductivityW_mK: 167.0,
      densityKg_m3: 2700.0,
      specificHeatJ_kgK: 896.0,
      emissivity: 0.82,
      authority: 'MATERIALS_AUTHORITY'
    });

    // 2. Register Canonical Model
    const model = p6.registry.registerModel({
      thermalId: 'therm:avionics:chassis',
      canonicalId: 'arch:comp:AVIONICS_BAY',
      p5StructuralId: 'struct:part:chassis_001',
      p4NodeId: 'thread:node:AVIONICS_BAY',
      displayName: 'Avionics Thermal Protection Model',
      domain: 'STEADY_STATE',
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    // 3. Register Canonical Regions
    const r1 = p6.registry.registerRegion({
      regionId: 'reg:chassis:base',
      thermalId: model.thermalId,
      canonicalGeometryId: 'geom:chassis_base_solid',
      materialId: 'mat:aluminum:6061-T6',
      materialRevision: 1,
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01',
      volumeM3: 0.002,
      surfaceAreaM2: 0.05,
      initialTemperatureK: 295.15
    });

    const r2 = p6.registry.registerRegion({
      regionId: 'reg:chassis:fin',
      thermalId: model.thermalId,
      canonicalGeometryId: 'geom:chassis_fin_solid',
      materialId: 'mat:aluminum:6061-T6',
      materialRevision: 1,
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01',
      volumeM3: 0.001,
      surfaceAreaM2: 0.12,
      initialTemperatureK: 295.15
    });

    // 4. Register Thermal Interface to P5
    p6.interfaces.registerInterface({
      interfaceId: 'iface:th:base_to_fin',
      thermalId: model.thermalId,
      p5InterfaceId: 'p5:iface:bolted_flange_01',
      sourceRegionId: r1.regionId,
      targetRegionId: r2.regionId,
      contactAreaM2: 0.01,
      conductanceW_K: 200.0,
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01'
    });

    // 5. Register Thermal Path
    p6.paths.registerPath({
      pathId: 'path:core_to_sink',
      thermalId: model.thermalId,
      name: 'Primary Heat Dissipation Path',
      sourceEndpoint: { type: 'HEAT_SOURCE', id: 'hs:fpga' },
      sinkEndpoint: { type: 'ENVIRONMENT', id: 'sink:ambient' },
      segments: [
        {
          segmentId: 'seg:1',
          fromType: 'HEAT_SOURCE',
          fromId: 'hs:fpga',
          toType: 'COMPONENT',
          toId: r1.regionId,
          conductanceW_K: 50.0,
          resistanceK_W: 0.02,
          mode: 'CONDUCTION'
        },
        {
          segmentId: 'seg:2',
          fromType: 'COMPONENT',
          fromId: r1.regionId,
          toType: 'STRUCTURE',
          toId: r2.regionId,
          conductanceW_K: 200.0,
          resistanceK_W: 0.005,
          mode: 'CONTACT'
        },
        {
          segmentId: 'seg:3',
          fromType: 'STRUCTURE',
          fromId: r2.regionId,
          toType: 'ENVIRONMENT',
          toId: 'sink:ambient',
          conductanceW_K: 10.0,
          resistanceK_W: 0.1,
          mode: 'CONVECTION'
        }
      ],
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01'
    });

    // 6. Register Boundaries & Loads
    p6.boundaries.registerHeatSource({
      sourceId: 'hs:fpga',
      thermalId: model.thermalId,
      targetRegionId: r1.regionId,
      sourceType: 'ARCHITECTURE_DERIVED',
      heatPowerWatts: 45.0,
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01',
      derivedFromArchitectureId: 'arch:comp:FPGA_UNIT'
    });

    p6.boundaries.registerHeatSink({
      sinkId: 'sink:ambient',
      thermalId: model.thermalId,
      sinkType: 'ENVIRONMENT',
      capacityWatts: 1000.0,
      ambientTemperatureK: 295.15,
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01'
    });

    p6.boundaries.applyBoundaryCondition({
      boundaryId: 'bc:sink_convection',
      thermalId: model.thermalId,
      type: 'CONVECTION',
      targetId: r2.regionId,
      value: 25.0,
      unit: 'W/(m^2*K)',
      ambientTemperatureK: 295.15,
      configurationId: 'CONF-BLOCK-1',
      revisionId: 'REV-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    // 7. Execute Solver
    const exec = p6.solver.prepareExecution(
      model,
      [r1, r2],
      p6.materials.getAllBindings(),
      p6.boundaries.getAllBoundaries()
    );

    const solverResult = p6.solver.execute1DSteadyConduction(exec.executionId, {
      hotBoundaryK: 340.0,
      coldBoundaryK: 295.15,
      lengthM: 0.05,
      areaM2: 0.01,
      conductivityW_mK: 167.0
    });

    // 8. Register Verification Intent & Prove Evidence
    const intent = p6.verifications.registerVerificationIntent({
      intentId: 'intent:verify:avionics_chassis',
      thermalId: model.thermalId,
      executionId: exec.executionId,
      maxAllowableTemperatureK: 355.0,
      minAllowableTemperatureK: 280.0,
      maxAllowableEnergyBalanceErrorPercent: 0.01,
      verificationMethod: 'ANALYTICAL_CHECK'
    });

    p6.verifications.verifyExecution(intent.intentId, solverResult, 'SYSTEM_ARCHITECT');

    // 9. Execute Formal 32-Gate Audit
    const audit = auditor.auditAllGates();

    expect(audit.totalGates).toBe(32);
    expect(audit.passedCount).toBe(32);
    expect(audit.isForensicallyClosed).toBe(true);

    for (let i = 1; i <= 32; i++) {
      expect(audit.gates[`P6-V${i}`]).toBe(true);
    }
  });
});
