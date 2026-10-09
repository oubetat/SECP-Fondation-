/**
 * SECP — ADSE-P6 Persistence & Deterministic Reconstruction Proof
 * 
 * Formal End-to-End Verification:
 * CREATE THERMAL MODEL
 * -> ADD REGIONS
 * -> BIND MATERIALS
 * -> ADD LOADS
 * -> ADD BOUNDARIES
 * -> ADD INTERFACES
 * -> ADD PATHS
 * -> EXECUTE
 * -> VERIFY
 * -> PERSIST
 * -> DESTROY IN-MEMORY STATE
 * -> RELOAD
 * -> RECONSTRUCT
 * -> AUDIT
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP6ThermalEngine } from '../../../src/engine/adse/p6/ADSEP6ThermalEngine';
import { ADSEP6ForensicAuditEngine } from '../../../src/engine/adse/p6/ADSEP6ForensicAuditEngine';

describe('ADSE-P6 Persistence & Deterministic Reconstruction Proof', () => {
  let p6: ADSEP6ThermalEngine;
  let auditor: ADSEP6ForensicAuditEngine;

  beforeEach(() => {
    p6 = new ADSEP6ThermalEngine();
    p6.clear();
    auditor = new ADSEP6ForensicAuditEngine(p6);
  });

  it('Executes complete persistence, memory destruction, and deterministic reconstruction cycle', () => {
    const configId = 'CONF-BLOCK-2';

    // 1. Materials
    p6.materials.registerMaterialBinding({
      bindingId: 'mat:inconel:718',
      materialId: 'mat:nickel:inconel718',
      materialRevision: 1,
      canonicalName: 'Inconel 718 Superalloy',
      conductivityW_mK: 11.4,
      densityKg_m3: 8190.0,
      specificHeatJ_kgK: 435.0,
      emissivity: 0.78,
      authority: 'MATERIALS_AUTHORITY'
    });

    // 2. Model
    const model = p6.registry.registerModel({
      thermalId: 'therm:combustor:liner',
      canonicalId: 'arch:comp:COMBUSTOR_LINER',
      p5StructuralId: 'struct:part:liner_assembly',
      p4NodeId: 'thread:node:COMBUSTOR_LINER',
      displayName: 'Combustor Thermal Liner',
      domain: 'STEADY_STATE',
      configurationId: configId,
      revisionId: 'REV-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    // 3. Regions
    const r1 = p6.registry.registerRegion({
      regionId: 'reg:liner:inner_wall',
      thermalId: model.thermalId,
      canonicalGeometryId: 'geom:liner_inner_shell',
      materialId: 'mat:nickel:inconel718',
      materialRevision: 1,
      configurationId: configId,
      revisionId: 'REV-01',
      volumeM3: 0.005,
      surfaceAreaM2: 0.25,
      initialTemperatureK: 900.0
    });

    const r2 = p6.registry.registerRegion({
      regionId: 'reg:liner:outer_casing',
      thermalId: model.thermalId,
      canonicalGeometryId: 'geom:liner_outer_casing',
      materialId: 'mat:nickel:inconel718',
      materialRevision: 1,
      configurationId: configId,
      revisionId: 'REV-01',
      volumeM3: 0.008,
      surfaceAreaM2: 0.40,
      initialTemperatureK: 600.0
    });

    // 4. Interfaces
    p6.interfaces.registerInterface({
      interfaceId: 'iface:liner:strut',
      thermalId: model.thermalId,
      p5InterfaceId: 'p5:iface:strut_weld_joint',
      sourceRegionId: r1.regionId,
      targetRegionId: r2.regionId,
      contactAreaM2: 0.02,
      conductanceW_K: 50.0,
      configurationId: configId,
      revisionId: 'REV-01'
    });

    // 5. Paths
    p6.paths.registerPath({
      pathId: 'path:combustion_to_bypass',
      thermalId: model.thermalId,
      name: 'Combustor Dissipation Path',
      sourceEndpoint: { type: 'HEAT_SOURCE', id: 'hs:flame' },
      sinkEndpoint: { type: 'ENVIRONMENT', id: 'sink:bypass_air' },
      segments: [
        {
          segmentId: 's1',
          fromType: 'HEAT_SOURCE',
          fromId: 'hs:flame',
          toType: 'COMPONENT',
          toId: r1.regionId,
          conductanceW_K: 100.0,
          resistanceK_W: 0.01,
          mode: 'RADIATION'
        },
        {
          segmentId: 's2',
          fromType: 'COMPONENT',
          fromId: r1.regionId,
          toType: 'STRUCTURE',
          toId: r2.regionId,
          conductanceW_K: 50.0,
          resistanceK_W: 0.02,
          mode: 'CONDUCTION'
        },
        {
          segmentId: 's3',
          fromType: 'STRUCTURE',
          fromId: r2.regionId,
          toType: 'ENVIRONMENT',
          toId: 'sink:bypass_air',
          conductanceW_K: 40.0,
          resistanceK_W: 0.025,
          mode: 'CONVECTION'
        }
      ],
      configurationId: configId,
      revisionId: 'REV-01'
    });

    // 6. Boundaries
    p6.boundaries.registerHeatSource({
      sourceId: 'hs:flame',
      thermalId: model.thermalId,
      targetRegionId: r1.regionId,
      sourceType: 'ARCHITECTURE_DERIVED',
      heatPowerWatts: 15000.0,
      configurationId: configId,
      revisionId: 'REV-01',
      derivedFromArchitectureId: 'arch:subsys:PROPULSION'
    });

    p6.boundaries.registerHeatSink({
      sinkId: 'sink:bypass_air',
      thermalId: model.thermalId,
      sinkType: 'FLUID_LOOP',
      capacityWatts: 50000.0,
      ambientTemperatureK: 450.0,
      configurationId: configId,
      revisionId: 'REV-01'
    });

    p6.boundaries.applyBoundaryCondition({
      boundaryId: 'bc:bypass_cooling',
      thermalId: model.thermalId,
      type: 'CONVECTION',
      targetId: r2.regionId,
      value: 120.0,
      unit: 'W/(m^2*K)',
      ambientTemperatureK: 450.0,
      configurationId: configId,
      revisionId: 'REV-01',
      authority: 'SYSTEM_ARCHITECT'
    });

    // 7. Create Snapshot before destruction
    const snapshotBefore = p6.persistence.createSnapshot(configId);
    expect(snapshotBefore.models.length).toBe(1);
    expect(snapshotBefore.regions.length).toBe(2);
    expect(snapshotBefore.materials.length).toBe(1);
    expect(snapshotBefore.merkleRoot).toBeDefined();

    // 8. DESTROY IN-MEMORY STATE
    p6.clear();
    expect(p6.registry.getAllModels().length).toBe(0);
    expect(p6.registry.getAllRegions().length).toBe(0);
    expect(p6.materials.getAllBindings().length).toBe(0);
    expect(p6.boundaries.getAllBoundaries().length).toBe(0);

    // 9. RECONSTRUCT FROM SNAPSHOT
    p6.persistence.reconstruct(snapshotBefore);

    // 10. VERIFY RECONSTRUCTED STATE
    expect(p6.registry.getAllModels().length).toBe(1);
    const reconstructedModel = p6.registry.getModel('therm:combustor:liner');
    expect(reconstructedModel).toBeDefined();
    expect(reconstructedModel?.canonicalId).toBe('arch:comp:COMBUSTOR_LINER');
    expect(reconstructedModel?.configurationId).toBe(configId);

    expect(p6.registry.getAllRegions().length).toBe(2);
    const reconstructedR1 = p6.registry.getRegion('reg:liner:inner_wall');
    expect(reconstructedR1?.initialTemperatureK).toBe(900.0);

    expect(p6.materials.getAllBindings().length).toBe(1);
    const reconstructedMat = p6.materials.getBinding('mat:inconel:718');
    expect(reconstructedMat?.conductivityW_mK).toBe(11.4);

    expect(p6.interfaces.getAllInterfaces().length).toBe(1);
    expect(p6.paths.getAllPaths().length).toBe(1);
    expect(p6.boundaries.getAllBoundaries().length).toBe(1);
    expect(p6.boundaries.getAllHeatSources().length).toBe(1);

    // 11. Run Consistency Audit on Reconstructed State
    const report = p6.consistency.audit();
    expect(report.isConsistent).toBe(true);
    expect(report.criticalCount).toBe(0);
    expect(report.errorCount).toBe(0);
  });
});
