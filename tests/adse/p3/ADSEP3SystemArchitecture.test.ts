import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEArchitectureEngine } from '../../../src/engine/adse/p3/ADSEArchitectureEngine';
import { ADSEP3ForensicAuditEngine } from '../../../src/engine/adse/p3/ADSEP3ForensicAuditEngine';

describe('ADSE-P3 System Architecture Suite', () => {
  let engine: ADSEArchitectureEngine;

  beforeEach(() => {
    engine = ADSEArchitectureEngine.getInstance();
    engine.clear();
  });

  it('P3.1 & P3.2: should register architecture elements and decompose system into subsystems and components', () => {
    // 1. System
    const sys = engine.registry.registerElement({
      archId: 'arch:system:AVIONICS_SUITE',
      elementType: 'System',
      displayName: 'Integrated Avionics Suite',
      layer: 'SYSTEM',
      configurationId: 'CONF-A',
      p1RequirementId: 'REQ-AV-001'
    });

    // 2. Subsystem
    const sub = engine.registry.registerElement({
      archId: 'arch:subsystem:NAVIGATION_MGMT',
      elementType: 'Subsystem',
      displayName: 'Navigation Management Subsystem',
      layer: 'SUBSYSTEM',
      configurationId: 'CONF-A'
    });

    // 3. Component
    const comp = engine.registry.registerElement({
      archId: 'arch:component:INERTIAL_NAV_UNIT',
      elementType: 'Component',
      displayName: 'Inertial Navigation Unit (INU)',
      layer: 'COMPONENT',
      configurationId: 'CONF-A'
    });

    // Decompose: System -> Subsystem
    const decomp1 = engine.decomposition.decompose({
      parentArchId: sys.archId,
      childArchId: sub.archId,
      configurationId: 'CONF-A'
    });
    expect(decomp1.relationship.relationshipType).toBe('DECOMPOSES');

    // Decompose: Subsystem -> Component
    const decomp2 = engine.decomposition.decompose({
      parentArchId: sub.archId,
      childArchId: comp.archId,
      configurationId: 'CONF-A'
    });
    expect(decomp2.relationship.relationshipType).toBe('DECOMPOSES');

    // Check tree structure
    const tree = engine.decomposition.getDecompositionTree(sys.archId);
    expect(tree.children.length).toBe(1);
    expect(tree.children[0].archId).toBe(sub.archId);
    expect(tree.children[0].children[0].archId).toBe(comp.archId);
  });

  it('P3.3: should reject invalid layer decomposition violations (System -> Component directly)', () => {
    const sys = engine.registry.registerElement({
      archId: 'arch:system:RADAR_SYS',
      elementType: 'System',
      displayName: 'Radar System',
      layer: 'SYSTEM',
      configurationId: 'CONF-A'
    });

    const comp = engine.registry.registerElement({
      archId: 'arch:component:ANTENNA',
      elementType: 'Component',
      displayName: 'Transmitter Antenna',
      layer: 'COMPONENT',
      configurationId: 'CONF-A'
    });

    expect(() => {
      engine.decomposition.decompose({
        parentArchId: sys.archId,
        childArchId: comp.archId,
        configurationId: 'CONF-A'
      });
    }).toThrowError(/DECOMPOSITION_RULE_VIOLATION/);
  });

  it('P3.4: should manage architecture interfaces and evaluate contract compatibility', () => {
    const subA = engine.registry.registerElement({
      archId: 'arch:subsystem:S-01',
      elementType: 'Subsystem',
      displayName: 'Guidance Computer',
      layer: 'SUBSYSTEM',
      configurationId: 'CONF-A'
    });

    const subB = engine.registry.registerElement({
      archId: 'arch:subsystem:S-02',
      elementType: 'Subsystem',
      displayName: 'Actuator Controller',
      layer: 'SUBSYSTEM',
      configurationId: 'CONF-A'
    });

    const iface = engine.interfaces.defineInterface({
      interfaceId: 'IF-CAN-BUS-01',
      displayName: 'CAN Avionics Bus',
      providerArchId: subA.archId,
      consumerArchId: subB.archId,
      direction: 'BIDIRECTIONAL',
      requiredContract: 'ARINC-429-100KBPS',
      providedContract: 'ARINC-429-100KBPS',
      flowItemType: 'CONTROL_TELEMETRY',
      configurationId: 'CONF-A'
    });

    expect(iface.isCompatible).toBe(true);
    expect(engine.interfaces.getInterfacesForElement(subA.archId).length).toBe(1);
  });

  it('P3.5: should detect dependency cycles and boundary violations', () => {
    const compA = engine.registry.registerElement({
      archId: 'arch:comp:A',
      elementType: 'Component',
      displayName: 'Component A',
      layer: 'COMPONENT',
      configurationId: 'CONF-A'
    });

    const compB = engine.registry.registerElement({
      archId: 'arch:comp:B',
      elementType: 'Component',
      displayName: 'Component B',
      layer: 'COMPONENT',
      configurationId: 'CONF-A'
    });

    const compC = engine.registry.registerElement({
      archId: 'arch:comp:C',
      elementType: 'Component',
      displayName: 'Component C',
      layer: 'COMPONENT',
      configurationId: 'CONF-A'
    });

    // Create cycle A -> B -> C -> A
    engine.dependencies.addDependency({
      dependencyId: 'DEP-1',
      sourceArchId: compA.archId,
      targetArchId: compB.archId,
      dependencyType: 'DATA',
      configurationId: 'CONF-A'
    });

    engine.dependencies.addDependency({
      dependencyId: 'DEP-2',
      sourceArchId: compB.archId,
      targetArchId: compC.archId,
      dependencyType: 'CONTROL',
      configurationId: 'CONF-A'
    });

    engine.dependencies.addDependency({
      dependencyId: 'DEP-3',
      sourceArchId: compC.archId,
      targetArchId: compA.archId,
      dependencyType: 'POWER',
      configurationId: 'CONF-A'
    });

    const cycles = engine.dependencies.detectCycles();
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('P3.6: should manage architecture decisions and trade studies with human-authorized governance', () => {
    const sub = engine.registry.registerElement({
      archId: 'arch:subsystem:THRUST_VECTOR',
      elementType: 'Subsystem',
      displayName: 'Thrust Vectoring Subsystem',
      layer: 'SUBSYSTEM',
      configurationId: 'CONF-A'
    });

    const decision = engine.decisions.proposeDecision({
      decisionId: 'AD-004',
      title: 'Select Electro-Mechanical Actuation for Gimbal',
      rationale: 'Reduces hydraulic weight and simplifies flight maintenance',
      alternatives: ['HYDRAULIC_SERVO', 'ELECTRO_MECHANICAL_ACTUATOR', 'PNEUMATIC'],
      selectedConcept: 'ELECTRO_MECHANICAL_ACTUATOR',
      affectedElementArchIds: [sub.archId],
      requirementIds: ['REQ-WEIGHT-02'],
      configurationId: 'CONF-A',
      proposedBy: 'AI_COPILOT'
    });

    expect(decision.status).toBe('PROPOSED');

    // AI authorization must fail
    expect(() => {
      engine.decisions.authorizeDecision(decision.decisionId, 'AI_ASSISTANT');
    }).toThrowError(/AI_AUTHORITY_VIOLATION/);

    // Human authorization succeeds
    const authorized = engine.decisions.authorizeDecision(decision.decisionId, 'CHIEF_SYSTEMS_ENGINEER');
    expect(authorized.status).toBe('AUTHORIZED');
    expect(authorized.authorizedBy).toBe('CHIEF_SYSTEMS_ENGINEER');
  });

  it('P3.7: should perform change impact analysis across elements, interfaces, and requirements', () => {
    const compA = engine.registry.registerElement({
      archId: 'arch:comp:RADAR_PROCESSOR',
      elementType: 'Component',
      displayName: 'Radar DSP',
      layer: 'COMPONENT',
      configurationId: 'CONF-A',
      p1RequirementId: 'REQ-THROUGHPUT-01'
    });

    const compB = engine.registry.registerElement({
      archId: 'arch:comp:DISPLAY_UNIT',
      elementType: 'Component',
      displayName: 'Cockpit MFD',
      layer: 'COMPONENT',
      configurationId: 'CONF-A'
    });

    engine.dependencies.addDependency({
      dependencyId: 'DEP-DSP-MFD',
      sourceArchId: compB.archId,
      targetArchId: compA.archId,
      dependencyType: 'DATA',
      configurationId: 'CONF-A'
    });

    const impact = engine.impact.analyzeImpact(compA.archId);
    expect(impact.affectedRequirements).toContain('REQ-THROUGHPUT-01');
    expect(impact.directAffectedIds).toContain(compB.archId);
  });

  it('P3.8: should manage Architecture Design Space and reject unverified candidate promotion', () => {
    const space = engine.designSpace.createDesignSpace({
      designSpaceId: 'SPACE-HYPERSONIC-01',
      title: 'Hypersonic Propulsion Design Space',
      systemArchId: 'arch:sys:PROPULSION',
      boundingRequirements: ['REQ-MACH-5', 'REQ-HEAT-FLUX-MAX'],
      boundingConstraints: ['MAX_WEIGHT_3500KG'],
      assumptions: ['Methane-Oxygen fuel density standard'],
      configurationId: 'CONF-A'
    });

    const candidateUnverified = engine.designSpace.addCandidateArchitecture(space.designSpaceId, {
      candidateId: 'CANDIDATE-DUAL-MODE-RAMJET',
      name: 'Dual-Mode Scramjet Concept A',
      architectureSpaceId: space.designSpaceId,
      requirements: ['REQ-MACH-5'],
      parameters: { bypassRatio: 0.12, chamberPressureMPa: 8.5 },
      assumptions: ['Active regenerative cooling'],
      dependencies: ['FUEL_TURBOPUMP'],
      simulationReferences: ['SIM-CFD-NACA-0012'],
      verificationState: 'UNVERIFIED',
      evidenceState: 'ABSENT',
      confidence: 0.65,
      configurationId: 'CONF-A'
    });

    // Unverified candidate cannot be promoted
    expect(() => {
      engine.designSpace.promoteCandidateToCanonical({
        designSpaceId: space.designSpaceId,
        candidateId: candidateUnverified.candidateId,
        authorizedBy: 'CHIEF_ENGINEER',
        targetRevisionCode: 'REV-B'
      });
    }).toThrowError(/CANONICAL_PROMOTION_ERROR/);

    // AI promotion attempt must be blocked by governance
    candidateUnverified.verificationState = 'VERIFIED';
    expect(() => {
      engine.designSpace.promoteCandidateToCanonical({
        designSpaceId: space.designSpaceId,
        candidateId: candidateUnverified.candidateId,
        authorizedBy: 'AI_ASSISTANT',
        targetRevisionCode: 'REV-B'
      });
    }).toThrowError(/AI_GOVERNANCE_VIOLATION/);

    // Human promotion of verified candidate succeeds
    const promoted = engine.designSpace.promoteCandidateToCanonical({
      designSpaceId: space.designSpaceId,
      candidateId: candidateUnverified.candidateId,
      authorizedBy: 'CHIEF_SYSTEMS_ENGINEER',
      targetRevisionCode: 'REV-B'
    });
    expect(promoted.isPromotedToCanonical).toBe(true);
  });

  it('P3.9: should formalize Future Engineering Foundation & parallel scenarios with strict isolation', () => {
    // 1. Assumption Set
    const assumptionSet = engine.futureEngineering.registerAssumptionSet({
      assumptionSetId: 'ASSUMPTIONS-2045-DEEP-TECH',
      name: 'Year 2045 Deep Tech Multipliers',
      technologyAssumptions: [
        { domain: 'PROPULSION', description: 'Rotating detonation wave combustion', multiplier: 2.8, maturityHorizonYears: 15 }
      ],
      materialAssumptions: [
        { materialClass: 'CERAMIC_MATRIX_COMPOSITE', targetProperty: 'yieldStrengthMPa', baselineValue: 450, assumedValue: 1200, unit: 'MPa' }
      ],
      energyAssumptions: [
        { energyType: 'SOLID_STATE_BATTERY', densityMultiplier: 4.5, storageEfficiencyPct: 98 }
      ],
      computingAssumptions: [
        { architecture: 'OPTICAL_NEUROMORPHIC', topsMultiplier: 80, efficiencyTopsPerWatt: 1200 }
      ],
      sensingAssumptions: [
        { modality: 'QUANTUM_GRAVIMETRY', resolutionMultiplier: 50, bandwidthMultiplier: 20 }
      ],
      manufacturingAssumptions: [
        { method: 'ELECTRON_BEAM_ADDITIVE', toleranceMicrons: 2.5, speedMultiplier: 10 }
      ],
      controlAssumptions: [
        { paradigm: 'NEURAL_NONLINEAR_ADAPTIVE', latencyMs: 0.1, autonomyLevel: 'LEVEL_5' }
      ],
      uncertaintyBoundaries: [
        { parameter: 'thermalConductivity', lowerBound: 25, upperBound: 85, confidenceLevel: 0.85 }
      ]
    });

    // 2. Future Scenario
    const scenario = engine.futureEngineering.createFutureScenario({
      scenarioId: 'SCENARIO-BREAKTHROUGH-2045',
      title: 'Breakthrough Thermal & Energy Envelope',
      scenarioType: 'BREAKTHROUGH',
      timeHorizonYears: 20,
      technologyMaturity: 'TRL_3_EXPERIMENTAL',
      assumptionSetId: assumptionSet.assumptionSetId,
      confidence: 0.72,
      uncertaintyLevel: 'HIGH',
      configurationId: 'CONF-FUTURE-X'
    });

    // Invariant: Must be strictly isolated from Current Canonical State
    expect(scenario.isIsolatedFromCanonical).toBe(true);

    // AI attempting to promote future scenario candidate directly must fail
    expect(() => {
      engine.futureEngineering.promoteScenarioCandidate({
        scenarioId: scenario.scenarioId,
        candidateId: 'CANDIDATE-QUANTUM-PROP',
        authorizedBy: 'AI_AGENT',
        justification: 'Higher theoretical efficiency'
      });
    }).toThrowError(/SCENARIO_ISOLATION_VIOLATION/);
  });

  it('P3.10: should run full 16-Gate Forensic Audit and verify all 20 Capabilities', () => {
    const audit = ADSEP3ForensicAuditEngine.runAudit();
    expect(audit.gates.length).toBe(16);
    expect(audit.auditPassed).toBe(true);
    expect(Object.keys(audit.capabilities).length).toBe(20);
    expect(audit.merkleRoot).toBeDefined();

    // Verify all 20 capabilities are marked IMPLEMENTED and CORE_BOUND
    for (const [id, cap] of Object.entries(audit.capabilities)) {
      expect(cap.IMPLEMENTED).toBe(true);
      expect(cap.CORE_BOUND).toBe(true);
      expect(cap.EXECUTED).toBe(true);
      expect(cap.VERIFIED).toBe(true);
    }
  });
});
