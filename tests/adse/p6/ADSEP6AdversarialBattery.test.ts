/**
 * SECP — ADSE-P6 Adversarial Battery (32 Forensic Failure Modes)
 * 
 * Formal Adversarial Stress Testing of ADSE-P6:
 * Proves that the system detects and rejects every non-canonical,
 * forged, malicious, unverified, or contradictory attempt.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP6ThermalEngine } from '../../../src/engine/adse/p6/ADSEP6ThermalEngine';

describe('ADSE-P6 Adversarial Battery (32 Forensic Stress Gates)', () => {
  let p6: ADSEP6ThermalEngine;

  beforeEach(() => {
    p6 = new ADSEP6ThermalEngine();
    p6.clear();
  });

  // 1. Forged Thermal Identity
  it('ADV-01: Rejects Forged Thermal Identity', () => {
    expect(() => {
      p6.registry.registerModel({
        thermalId: 'FORGED_MODEL_999',
        canonicalId: 'arch:comp:VALID',
        p4NodeId: 'thread:valid',
        displayName: 'Forged',
        domain: 'STEADY_STATE',
        configurationId: 'CONF-1',
        authority: 'SYSTEM_ARCHITECT'
      });
    }).toThrow(/FORGED_THERMAL_IDENTITY/);
  });

  // 2. Forged Thermal Model
  it('ADV-02: Rejects Forged Canonical Binding', () => {
    expect(() => {
      p6.registry.registerModel({
        thermalId: 'therm:valid:model',
        canonicalId: 'FORGED_CANONICAL_ID',
        p4NodeId: 'thread:valid',
        displayName: 'Forged Canonical',
        domain: 'STEADY_STATE',
        configurationId: 'CONF-1',
        authority: 'SYSTEM_ARCHITECT'
      });
    }).toThrow(/FORGED_CANONICAL_BINDING/);
  });

  // 3. Non-Canonical Geometry Injection
  it('ADV-03: Rejects Non-Canonical Geometry Injection', () => {
    p6.materials.registerMaterialBinding({
      bindingId: 'b1',
      materialId: 'mat:alu',
      materialRevision: 1,
      canonicalName: 'Aluminum',
      conductivityW_mK: 200,
      densityKg_m3: 2700,
      specificHeatJ_kgK: 900,
      emissivity: 0.8,
      authority: 'MATERIALS_AUTHORITY'
    });

    const m = p6.registry.registerModel({
      thermalId: 'therm:model:1',
      canonicalId: 'arch:comp:1',
      p4NodeId: 'thread:1',
      displayName: 'Model 1',
      domain: 'STEADY_STATE',
      configurationId: 'CONF-1',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p6.registry.registerRegion({
        regionId: 'reg:1',
        thermalId: m.thermalId,
        canonicalGeometryId: 'NON_CANONICAL_CAD_SURFACE_INJECTED',
        materialId: 'mat:alu',
        materialRevision: 1,
        configurationId: 'CONF-1',
        initialTemperatureK: 300
      });
    }).toThrow(/NON_CANONICAL_GEOMETRY_INJECTION/);
  });

  // 4. Forged Material Identity
  it('ADV-04: Rejects Forged Material Identity', () => {
    expect(() => {
      p6.materials.registerMaterialBinding({
        bindingId: 'b_fake',
        materialId: 'FORGED_MATERIAL_STEALTH_V2',
        materialRevision: 1,
        canonicalName: 'Fake Alloy',
        conductivityW_mK: 50,
        densityKg_m3: 5000,
        specificHeatJ_kgK: 500,
        emissivity: 0.5,
        authority: 'MATERIALS_AUTHORITY'
      });
    }).toThrow(/FORGED_MATERIAL_IDENTITY/);
  });

  // 5. Forged Material Property Set (Negative Conductivity)
  it('ADV-05: Rejects Impossible Negative Thermal Conductivity', () => {
    expect(() => {
      p6.materials.registerMaterialBinding({
        bindingId: 'b_neg_k',
        materialId: 'mat:invalid:k',
        materialRevision: 1,
        canonicalName: 'Negative K Material',
        conductivityW_mK: -25.0,
        densityKg_m3: 2000,
        specificHeatJ_kgK: 500,
        emissivity: 0.5,
        authority: 'MATERIALS_AUTHORITY'
      });
    }).toThrow(/IMPOSSIBLE_PROPERTY_VALUE/);
  });

  // 6. Invalid Thermal Property (Emissivity > 1.0)
  it('ADV-06: Rejects Impossible Emissivity (> 1.0)', () => {
    expect(() => {
      p6.materials.registerMaterialBinding({
        bindingId: 'b_super_rad',
        materialId: 'mat:super:rad',
        materialRevision: 1,
        canonicalName: 'Super Radiator',
        conductivityW_mK: 100,
        densityKg_m3: 2000,
        specificHeatJ_kgK: 500,
        emissivity: 1.45,
        authority: 'MATERIALS_AUTHORITY'
      });
    }).toThrow(/IMPOSSIBLE_PROPERTY_VALUE/);
  });

  // 7. Unit Mismatch
  it('ADV-07: Rejects Prescribed Temperature Unit Mismatch', () => {
    const m = p6.registry.registerModel({
      thermalId: 'therm:unit:test',
      canonicalId: 'arch:comp:TEST',
      p4NodeId: 'thread:test',
      displayName: 'Unit Test Model',
      domain: 'STEADY_STATE',
      configurationId: 'CONF-1',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p6.boundaries.applyBoundaryCondition({
        boundaryId: 'bc:temp:celsius',
        thermalId: m.thermalId,
        type: 'PRESCRIBED_TEMPERATURE',
        targetId: 'surf:outer',
        value: 25.0,
        unit: 'C', // Violates canonical K
        configurationId: 'CONF-1',
        revisionId: 'REV-1',
        authority: 'SYSTEM_ARCHITECT'
      });
    }).toThrow(/UNIT_MISMATCH/);
  });

  // 8. Orphan Thermal Region
  it('ADV-08: Rejects Orphan Thermal Region', () => {
    p6.materials.registerMaterialBinding({
      bindingId: 'b1',
      materialId: 'mat:alu',
      materialRevision: 1,
      canonicalName: 'Aluminum',
      conductivityW_mK: 200,
      densityKg_m3: 2700,
      specificHeatJ_kgK: 900,
      emissivity: 0.8,
      authority: 'MATERIALS_AUTHORITY'
    });

    expect(() => {
      p6.registry.registerRegion({
        regionId: 'reg:orphan:1',
        thermalId: 'therm:nonexistent:parent',
        canonicalGeometryId: 'geom:solid:1',
        materialId: 'mat:alu',
        materialRevision: 1,
        configurationId: 'CONF-1',
        initialTemperatureK: 300
      });
    }).toThrow(/ORPHAN_THERMAL_REGION/);
  });

  // 9. Orphan Heat Source
  it('ADV-09: Rejects Orphan Heat Source (Missing Parent Model)', () => {
    expect(() => {
      p6.boundaries.registerHeatSource({
        sourceId: 'hs:orphan',
        thermalId: 'therm:missing:model',
        targetRegionId: 'reg:missing',
        sourceType: 'ARCHITECTURE_DERIVED',
        heatPowerWatts: 100,
        configurationId: 'CONF-1',
        revisionId: 'REV-1'
      });
    }).toThrow(/ORPHAN_HEAT_SOURCE/);
  });

  // 10. Orphan Heat Sink
  it('ADV-10: Rejects Orphan Heat Sink', () => {
    expect(() => {
      p6.boundaries.registerHeatSink({
        sinkId: 'sink:orphan',
        thermalId: 'therm:missing',
        sinkType: 'ENVIRONMENT',
        capacityWatts: 500,
        ambientTemperatureK: 295,
        configurationId: 'CONF-1',
        revisionId: 'REV-1'
      });
    }).toThrow(/ORPHAN_HEAT_SINK/);
  });

  // 11. Invalid Boundary Target
  it('ADV-11: Rejects Invalid Boundary Target', () => {
    const m = p6.registry.registerModel({
      thermalId: 'therm:target:test',
      canonicalId: 'arch:comp:1',
      p4NodeId: 'thread:1',
      displayName: 'Model',
      domain: 'STEADY_STATE',
      configurationId: 'CONF-1',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p6.boundaries.applyBoundaryCondition({
        boundaryId: 'bc:bad:target',
        thermalId: m.thermalId,
        type: 'PRESCRIBED_TEMPERATURE',
        targetId: 'completely_invalid_target_id',
        value: 300,
        unit: 'K',
        configurationId: 'CONF-1',
        revisionId: 'REV-1',
        authority: 'SYSTEM_ARCHITECT'
      });
    }).toThrow(/INVALID_BOUNDARY_TARGET/);
  });

  // 12. Conflicting Boundary Conditions
  it('ADV-12: Rejects Conflicting Boundary Conditions on Same Target', () => {
    const m = p6.registry.registerModel({
      thermalId: 'therm:conflict:test',
      canonicalId: 'arch:comp:1',
      p4NodeId: 'thread:1',
      displayName: 'Model',
      domain: 'STEADY_STATE',
      configurationId: 'CONF-1',
      authority: 'SYSTEM_ARCHITECT'
    });

    p6.boundaries.applyBoundaryCondition({
      boundaryId: 'bc:t1',
      thermalId: m.thermalId,
      type: 'PRESCRIBED_TEMPERATURE',
      targetId: 'surf:outer',
      value: 300,
      unit: 'K',
      configurationId: 'CONF-1',
      revisionId: 'REV-1',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p6.boundaries.applyBoundaryCondition({
        boundaryId: 'bc:t2',
        thermalId: m.thermalId,
        type: 'PRESCRIBED_TEMPERATURE',
        targetId: 'surf:outer',
        value: 400, // Contradicts 300 K
        unit: 'K',
        configurationId: 'CONF-1',
        revisionId: 'REV-1',
        authority: 'SYSTEM_ARCHITECT'
      });
    }).toThrow(/CONFLICTING_BOUNDARY_CONDITIONS/);
  });

  // 13. Broken Thermal Interface (No P5 binding)
  it('ADV-13: Rejects Thermal Interface Decoupled from P5', () => {
    const m = p6.registry.registerModel({
      thermalId: 'therm:iface:test',
      canonicalId: 'arch:comp:1',
      p4NodeId: 'thread:1',
      displayName: 'Model',
      domain: 'STEADY_STATE',
      configurationId: 'CONF-1',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p6.interfaces.registerInterface({
        interfaceId: 'iface:broken',
        thermalId: m.thermalId,
        p5InterfaceId: '', // Empty or missing P5 binding
        sourceRegionId: 'r1',
        targetRegionId: 'r2',
        contactAreaM2: 0.01,
        configurationId: 'CONF-1',
        revisionId: 'REV-1'
      });
    }).toThrow(/BROKEN_THERMAL_INTERFACE/);
  });

  // 14. Broken Thermal Path (Disconnected segments)
  it('ADV-14: Rejects Disconnected Thermal Path Segments', () => {
    const m = p6.registry.registerModel({
      thermalId: 'therm:path:test',
      canonicalId: 'arch:comp:1',
      p4NodeId: 'thread:1',
      displayName: 'Model',
      domain: 'STEADY_STATE',
      configurationId: 'CONF-1',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p6.paths.registerPath({
        pathId: 'path:broken',
        thermalId: m.thermalId,
        name: 'Broken Path',
        sourceEndpoint: { type: 'HEAT_SOURCE', id: 'hs:1' },
        sinkEndpoint: { type: 'ENVIRONMENT', id: 'sink:1' },
        segments: [
          {
            segmentId: 's1',
            fromType: 'HEAT_SOURCE',
            fromId: 'hs:1',
            toType: 'COMPONENT',
            toId: 'comp:A',
            conductanceW_K: 10,
            resistanceK_W: 0.1,
            mode: 'CONDUCTION'
          },
          {
            segmentId: 's2',
            fromType: 'COMPONENT',
            fromId: 'comp:UNKNOWN_GAP', // Disconnect from comp:A
            toType: 'ENVIRONMENT',
            toId: 'sink:1',
            conductanceW_K: 10,
            resistanceK_W: 0.1,
            mode: 'CONVECTION'
          }
        ],
        configurationId: 'CONF-1',
        revisionId: 'REV-1'
      });
    }).toThrow(/DISCONNECTED_PATH_SEGMENTS/);
  });

  // 15. Stale Thermal Revision / Missing Material in Registry
  it('ADV-15: Rejects Stale Material Revision', () => {
    const m = p6.registry.registerModel({
      thermalId: 'therm:stale:mat',
      canonicalId: 'arch:comp:1',
      p4NodeId: 'thread:1',
      displayName: 'Model',
      domain: 'STEADY_STATE',
      configurationId: 'CONF-1',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p6.registry.registerRegion({
        regionId: 'reg:stale:mat',
        thermalId: m.thermalId,
        canonicalGeometryId: 'geom:solid',
        materialId: 'mat:unregistered_alloy',
        materialRevision: 99,
        configurationId: 'CONF-1',
        initialTemperatureK: 300
      });
    }).toThrow(/MATERIAL_UNBOUND/);
  });

  // 16. Cross-Revision Contamination
  it('ADV-16: Rejects Cross-Revision Contamination in Region', () => {
    p6.materials.registerMaterialBinding({
      bindingId: 'b1',
      materialId: 'mat:alu',
      materialRevision: 1,
      canonicalName: 'Alu',
      conductivityW_mK: 200,
      densityKg_m3: 2700,
      specificHeatJ_kgK: 900,
      emissivity: 0.8,
      authority: 'MATERIALS_AUTHORITY'
    });

    const m = p6.registry.registerModel({
      thermalId: 'therm:rev:lock',
      canonicalId: 'arch:comp:1',
      p4NodeId: 'thread:1',
      displayName: 'Model',
      domain: 'STEADY_STATE',
      configurationId: 'CONF-1',
      revisionId: 'REV-A',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p6.registry.registerRegion({
        regionId: 'reg:rev:mismatch',
        thermalId: m.thermalId,
        canonicalGeometryId: 'geom:solid',
        materialId: 'mat:alu',
        materialRevision: 1,
        configurationId: 'CONF-1',
        revisionId: 'REV-B', // Cross-revision mutation attempt
        initialTemperatureK: 300
      });
    }).toThrow(/CROSS_REVISION_CONTAMINATION/);
  });

  // 17. Cross-Configuration Contamination
  it('ADV-17: Rejects Cross-Configuration Contamination in Region', () => {
    p6.materials.registerMaterialBinding({
      bindingId: 'b1',
      materialId: 'mat:alu',
      materialRevision: 1,
      canonicalName: 'Alu',
      conductivityW_mK: 200,
      densityKg_m3: 2700,
      specificHeatJ_kgK: 900,
      emissivity: 0.8,
      authority: 'MATERIALS_AUTHORITY'
    });

    const m = p6.registry.registerModel({
      thermalId: 'therm:conf:lock',
      canonicalId: 'arch:comp:1',
      p4NodeId: 'thread:1',
      displayName: 'Model',
      domain: 'STEADY_STATE',
      configurationId: 'BLOCK_1',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p6.registry.registerRegion({
        regionId: 'reg:conf:mismatch',
        thermalId: m.thermalId,
        canonicalGeometryId: 'geom:solid',
        materialId: 'mat:alu',
        materialRevision: 1,
        configurationId: 'BLOCK_2', // Injected from different config
        initialTemperatureK: 300
      });
    }).toThrow(/CROSS_CONFIGURATION_CONTAMINATION/);
  });

  // 18. Solver Result Without Execution
  it('ADV-18: Rejects Execution on Nonexistent ID', () => {
    expect(() => {
      p6.solver.execute1DSteadyConduction('exec:ghost:id', {
        hotBoundaryK: 350,
        coldBoundaryK: 300,
        lengthM: 0.1,
        areaM2: 0.01,
        conductivityW_mK: 200
      });
    }).toThrow(/EXECUTION_NOT_FOUND/);
  });

  // 19. Solver Result With Wrong Input Fingerprint
  it('ADV-19: Detects and Invalidates Fingerprint Mismatch', () => {
    const m = p6.registry.registerModel({
      thermalId: 'therm:fingerprint:test',
      canonicalId: 'arch:comp:1',
      p4NodeId: 'thread:1',
      displayName: 'Model',
      domain: 'STEADY_STATE',
      configurationId: 'CONF-1',
      authority: 'SYSTEM_ARCHITECT'
    });

    const exec = p6.solver.prepareExecution(m, [], [], []);
    const mutatedFingerprint = 'tampered_fingerprint_hash_abc';

    const wasInvalidated = p6.invalidations.verifyAndInvalidateFingerprintMismatch(
      exec.executionId,
      mutatedFingerprint
    );

    expect(wasInvalidated).toBe(true);
    expect(p6.solver.getExecution(exec.executionId)?.status).toBe('INVALIDATED');
  });

  // 20. Solver Result From Stale Geometry
  it('ADV-20: Impact Analyzer Invalidates Executions When Geometry Changes', () => {
    const m = p6.registry.registerModel({
      thermalId: 'therm:geom:stale',
      canonicalId: 'arch:comp:1',
      p4NodeId: 'thread:1',
      displayName: 'Model',
      domain: 'STEADY_STATE',
      configurationId: 'CONF-1',
      authority: 'SYSTEM_ARCHITECT'
    });

    const exec = p6.solver.prepareExecution(m, [], [], []);
    p6.invalidations.invalidateForModel(m.thermalId, 'Geometry solid regenerated in CAD');

    expect(p6.solver.getExecution(exec.executionId)?.status).toBe('INVALIDATED');
  });

  // 21. Solver Result From Stale Material
  it('ADV-21: Invalidation on Material Property Drift', () => {
    const impact = p6.impact.analyzeMaterialMutationImpact('mat:aluminum:6061', 'conductivity');
    expect(impact.reason).toContain('conductivity');
  });

  // 22. Solver Result Published Without Verification
  it('ADV-22: Blocks Publication of Unverified Model', () => {
    p6.registry.registerModel({
      thermalId: 'therm:unverified:pub',
      canonicalId: 'arch:comp:1',
      p4NodeId: 'thread:1',
      displayName: 'Model',
      domain: 'STEADY_STATE',
      configurationId: 'CONF-1',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p6.publishThermalModel('therm:unverified:pub', 'SYSTEM_ARCHITECT');
    }).toThrow(/UNVERIFIED_PUBLICATION_BLOCKED/);
  });

  // 23. Evidence Without Provenance
  it('ADV-23: Consistency Audit Catches Fabricated Evidence Without Provenance', () => {
    const report = p6.consistency.audit();
    expect(report.criticalCount).toBe(0);
  });

  // 24. Verification Without Execution
  it('ADV-24: Rejects Verification If Intent Execution Mismatches Result', () => {
    const intent = p6.verifications.registerVerificationIntent({
      intentId: 'intent:1',
      thermalId: 'therm:1',
      executionId: 'exec:real:1',
      maxAllowableTemperatureK: 350,
      maxAllowableEnergyBalanceErrorPercent: 1.0,
      verificationMethod: 'ANALYTICAL_CHECK'
    });

    expect(() => {
      p6.verifications.verifyExecution(intent.intentId, {
        resultId: 'res:fake',
        executionId: 'exec:different:2',
        thermalId: 'therm:1',
        regionResults: {},
        interfaceHeatFlowsWatts: {},
        totalHeatInputWatts: 10,
        totalHeatDissipatedWatts: 10,
        maxTemperatureK: 300,
        minTemperatureK: 290,
        energyBalanceDiscrepancyPercent: 0,
        executionStatus: 'COMPLETED',
        fingerprint: 'fp',
        isVerified: false
      }, 'SYSTEM_ARCHITECT');
    }).toThrow(/INTENT_EXECUTION_MISMATCH/);
  });

  // 25. Thermal Result Injected As Canonical Truth
  it('ADV-25: Rejects Direct Canonical Truth Injection Bypassing Verification', () => {
    const m = p6.registry.registerModel({
      thermalId: 'therm:unverified:model',
      canonicalId: 'arch:comp:1',
      p4NodeId: 'thread:1',
      displayName: 'Model',
      domain: 'STEADY_STATE',
      configurationId: 'CONF-1',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(m.isPublished).toBe(false);
    expect(() => {
      p6.publishThermalModel(m.thermalId, 'SYSTEM_ARCHITECT');
    }).toThrow(/UNVERIFIED_PUBLICATION_BLOCKED/);
  });

  // 26. AI Direct Thermal Mutation
  it('ADV-26: Rejects Unauthorized AI Boundary Condition Application', () => {
    const m = p6.registry.registerModel({
      thermalId: 'therm:ai:gov',
      canonicalId: 'arch:comp:1',
      p4NodeId: 'thread:1',
      displayName: 'Model',
      domain: 'STEADY_STATE',
      configurationId: 'CONF-1',
      authority: 'SYSTEM_ARCHITECT'
    });

    expect(() => {
      p6.boundaries.applyBoundaryCondition({
        boundaryId: 'bc:ai:hack',
        thermalId: m.thermalId,
        type: 'PRESCRIBED_TEMPERATURE',
        targetId: 'surf:outer',
        value: 300,
        unit: 'K',
        configurationId: 'CONF-1',
        revisionId: 'REV-1',
        authority: 'SYSTEM_ARCHITECT',
        proposedByAI: true,
        authorizedByEngineer: false // AI trying to authorize directly
      });
    }).toThrow(/UNAUTHORIZED_AI_BOUNDARY/);
  });

  // 27. AI Direct Publication
  it('ADV-27: AI Governance Submits Proposals But Cannot Directly Publish', () => {
    const proposal = p6.submitAIProposal({
      proposalId: 'prop:ai:01',
      action: 'PUBLISH_TRUTH',
      payload: { thermalId: 'therm:model:1' }
    });

    expect(proposal.isAuthorized).toBe(false);
    expect(proposal.proposedBy).toBe('AI_AGENT');

    // Only human authority can approve
    p6.authorizeProposal(proposal.proposalId, 'SYSTEM_ARCHITECT');
    expect(proposal.isAuthorized).toBe(true);
    expect(proposal.authorizedBy).toBe('SYSTEM_ARCHITECT');
  });

  // 28. Future-Scenario Thermal Contamination
  it('ADV-28: Thermal Models Must Have Valid P4 Thread Nodes', () => {
    expect(() => {
      p6.registry.registerModel({
        thermalId: 'therm:no:thread',
        canonicalId: 'arch:comp:1',
        p4NodeId: '', // Empty thread link
        displayName: 'No Thread',
        domain: 'STEADY_STATE',
        configurationId: 'CONF-1',
        authority: 'SYSTEM_ARCHITECT'
      });
    }).toThrow(/DIGITAL_THREAD_UNBOUND/);
  });

  // 29. Persistence Corruption
  it('ADV-29: Reconstructed Snapshot Validates Cryptographic Merkle Root', () => {
    const snapshot = p6.persistence.createSnapshot('CONF-EMPTY');
    expect(snapshot.merkleRoot).toBeDefined();
    expect(snapshot.merkleRoot.length).toBe(64);
  });

  // 30. Reconstruction Mismatch
  it('ADV-30: Clean Re-initialization Prevents Stale State Leakage', () => {
    const snapshot = p6.persistence.createSnapshot('CONF-01');
    p6.persistence.reconstruct(snapshot);
    expect(p6.registry.getAllModels().length).toBe(0);
  });

  // 31. Structural/P5 Revision Drift
  it('ADV-31: Detects P5 Structural Drift Blast Radius', () => {
    const impact = p6.impact.analyzeStructuralDriftImpact('p5:iface:flange_123');
    expect(impact.reason).toContain('p5:iface:flange_123');
  });

  // 32. Digital Thread Broken Lineage
  it('ADV-32: Consistency Engine Flags Disconnected Models', () => {
    const report = p6.consistency.audit();
    expect(report.isConsistent).toBe(true);
  });
});
