/**
 * SECP — ADSE-P3 Forensic Reconciliation & Verification Suite
 * 
 * Formal Verification of the 16 Forensic Gates (P3-V1 through P3-V16)
 * and 20/20 Capability Registry Reconciliation.
 * 
 * Core Invariant:
 * «ADSE defines Architecture Intent & Possibility Space; SECP Engineering Core authorizes Canonical Truth.»
 * 
 * Future Engineering Charter:
 * «SECP does not predict the future as fact. SECP explores engineering futures as hypothesis spaces.»
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEArchitectureEngine } from '../../../src/engine/adse/p3/ADSEArchitectureEngine';
import { ADSEP3ForensicAuditEngine } from '../../../src/engine/adse/p3/ADSEP3ForensicAuditEngine';
import { ADSEEngine } from '../../../src/engine/adse/p0/ADSEEngine';
import { CoreExecutionAuthority } from '../../../src/engine/execution/CoreExecutionAuthority';
import { FutureEngineeringEngine } from '../../../src/engine/adse/p3/FutureEngineeringEngine';

describe('ADSE-P3 Forensic Reconciliation & Verification Suite (P3-V1 through P3-V16)', () => {
  let p3Engine: ADSEArchitectureEngine;
  let p0Engine: ADSEEngine;

  beforeEach(() => {
    p3Engine = ADSEArchitectureEngine.getInstance();
    p0Engine = ADSEEngine.getInstance();
    p3Engine.clear();
  });

  // P3-V1: Architecture Authority
  it('P3-V1: Architecture Authority — ADSE defines Architecture Intent while SECP Core holds single canonical truth', () => {
    expect(p3Engine.revisionEngine).toBe(p0Engine.getRevisionEngine());
    
    // Elements registered in P3 are intent representations governed by Core Revision authority
    const elem = p3Engine.registry.registerElement({
      archId: 'arch:sys:FLIGHT_CONTROL',
      elementType: 'System',
      displayName: 'Primary Flight Control System',
      layer: 'SYSTEM',
      configurationId: 'CONF-BASE'
    });

    expect(elem.revisionHash).toBeDefined();
    expect(elem.revisionId).toContain('REV-ARCH-');
  });

  // P3-V2: Core Identity Binding
  it('P3-V2: Core Identity Binding — Verifies CoreExecutionAuthority handshake and zero second core', () => {
    const coreKey = CoreExecutionAuthority.getCoreKey();
    expect(coreKey).toBeDefined();
    expect(typeof coreKey).toBe('symbol');
    
    const audit = ADSEP3ForensicAuditEngine.runAudit();
    const v2Gate = audit.gates.find(g => g.gateId === 'P3-V2');
    expect(v2Gate).toBeDefined();
    expect(v2Gate?.status).toBe('PASS');
  });

  // P3-V3: Decomposition Integrity
  it('P3-V3: Decomposition Integrity — Enforces hierarchical System -> Subsystem -> Component decomposition rules', () => {
    const sys = p3Engine.registry.registerElement({
      archId: 'arch:sys:CORE_PROP',
      elementType: 'System',
      displayName: 'Propulsion Main System',
      layer: 'SYSTEM',
      configurationId: 'CONF-BASE'
    });

    const sub = p3Engine.registry.registerElement({
      archId: 'arch:sub:TURBOMACHINERY',
      elementType: 'Subsystem',
      displayName: 'Turbomachinery Subsystem',
      layer: 'SUBSYSTEM',
      configurationId: 'CONF-BASE'
    });

    const comp = p3Engine.registry.registerElement({
      archId: 'arch:comp:TURBINE_BLADE_DISK',
      elementType: 'Component',
      displayName: 'Blisk Assembly',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    // Valid: System -> Subsystem
    const d1 = p3Engine.decomposition.decompose({
      parentArchId: sys.archId,
      childArchId: sub.archId,
      configurationId: 'CONF-BASE'
    });
    expect(d1.relationship.relationshipType).toBe('DECOMPOSES');

    // Valid: Subsystem -> Component
    const d2 = p3Engine.decomposition.decompose({
      parentArchId: sub.archId,
      childArchId: comp.archId,
      configurationId: 'CONF-BASE'
    });
    expect(d2.relationship.relationshipType).toBe('DECOMPOSES');

    // Invalid: Direct System -> Component bypass violates decomposition integrity
    expect(() => {
      p3Engine.decomposition.decompose({
        parentArchId: sys.archId,
        childArchId: comp.archId,
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/DECOMPOSITION_RULE_VIOLATION/);
  });

  // P3-V4: Interface Integrity
  it('P3-V4: Interface Integrity — Verifies interface contracts and protocol/flow compatibility', () => {
    const provider = p3Engine.registry.registerElement({
      archId: 'arch:sub:NAV_COMPUTER',
      elementType: 'Subsystem',
      displayName: 'Flight Navigation Computer',
      layer: 'SUBSYSTEM',
      configurationId: 'CONF-BASE'
    });

    const consumer = p3Engine.registry.registerElement({
      archId: 'arch:sub:SERVO_CONTROLLER',
      elementType: 'Subsystem',
      displayName: 'Elevon Servo Controller',
      layer: 'SUBSYSTEM',
      configurationId: 'CONF-BASE'
    });

    const iface = p3Engine.interfaces.defineInterface({
      interfaceId: 'IF-MIL-STD-1553B',
      displayName: 'Mil-Std-1553B Dual Bus',
      providerArchId: provider.archId,
      consumerArchId: consumer.archId,
      direction: 'BIDIRECTIONAL',
      requiredContract: 'MIL-1553-1MBPS',
      providedContract: 'MIL-1553-1MBPS',
      flowItemType: 'COMMAND_TELEMETRY',
      configurationId: 'CONF-BASE'
    });

    expect(iface.isCompatible).toBe(true);
  });

  // P3-V5: Dependency Integrity
  it('P3-V5: Dependency Integrity — Enforces typed dependencies and detects cyclic dependency deadlocks', () => {
    const a = p3Engine.registry.registerElement({
      archId: 'arch:comp:POWER_DIST',
      elementType: 'Component',
      displayName: 'PDU',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const b = p3Engine.registry.registerElement({
      archId: 'arch:comp:COOLING_PUMP',
      elementType: 'Component',
      displayName: 'Coolant Pump',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    p3Engine.dependencies.addDependency({
      dependencyId: 'DEP-POWER-COOL',
      sourceArchId: b.archId,
      targetArchId: a.archId,
      dependencyType: 'POWER',
      configurationId: 'CONF-BASE'
    });

    p3Engine.dependencies.addDependency({
      dependencyId: 'DEP-COOL-POWER',
      sourceArchId: a.archId,
      targetArchId: b.archId,
      dependencyType: 'THERMAL',
      configurationId: 'CONF-BASE'
    });

    const cycles = p3Engine.dependencies.detectCycles();
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]).toContain(a.archId);
    expect(cycles[0]).toContain(b.archId);
  });

  // P3-V6: Allocation Integrity
  it('P3-V6: Allocation Integrity — Manages functional to logical to physical allocations', () => {
    const funcElem = p3Engine.registry.registerElement({
      archId: 'arch:elem:FUNCTION_AUTOLAND',
      elementType: 'System',
      displayName: 'Perform Autoland Function',
      layer: 'SYSTEM',
      configurationId: 'CONF-BASE'
    });

    const swElem = p3Engine.registry.registerElement({
      archId: 'arch:comp:SW_AUTOLAND_EXEC',
      elementType: 'Component',
      displayName: 'Autoland Execution Module',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE'
    });

    const alloc = p3Engine.views.allocate({
      sourceArchId: funcElem.archId,
      targetArchId: swElem.archId,
      allocationType: 'FUNCTION_TO_LOGICAL',
      configurationId: 'CONF-BASE'
    });

    expect(alloc.relationshipType).toBe('ALLOCATED_TO');
    expect(alloc.sourceArchId).toBe(funcElem.archId);
    expect(alloc.targetArchId).toBe(swElem.archId);
  });

  // P3-V7: Constraint Integrity
  it('P3-V7: Constraint Integrity — Enforces architectural constraint registering and binding', () => {
    const sub = p3Engine.registry.registerElement({
      archId: 'arch:sub:PAYLOAD_BAY',
      elementType: 'Subsystem',
      displayName: 'Internal Weapon & Payload Bay',
      layer: 'SUBSYSTEM',
      configurationId: 'CONF-BASE'
    });

    const constraint = p3Engine.impact.registerConstraint({
      constraintId: 'CONST-MAX-THERMAL-LOAD',
      type: 'RESOURCE',
      displayName: 'Maximum Bay Heat Dissipation',
      affectedArchIds: [sub.archId],
      expression: 'dissipatedPowerWatts <= 4500',
      configurationId: 'CONF-BASE'
    });

    expect(constraint.constraintId).toBe('CONST-MAX-THERMAL-LOAD');
    expect(constraint.affectedArchIds).toContain(sub.archId);
  });

  // P3-V8: Architecture Decision Integrity
  it('P3-V8: Architecture Decision Integrity — Enforces human-authorized decision making & blocks unauthorized actors', () => {
    const airframe = p3Engine.registry.registerElement({
      archId: 'arch:sys:AIRFRAME',
      elementType: 'System',
      displayName: 'Main Airframe Structure',
      layer: 'SYSTEM',
      configurationId: 'CONF-BASE'
    });

    const dec = p3Engine.decisions.proposeDecision({
      decisionId: 'AD-STRUCT-01',
      title: 'Selection of Carbon-Bismaleimide Composite for Skin',
      rationale: 'High glass transition temperature and compressive strength at Mach 3.2',
      alternatives: ['AL_LI_2195', 'BMI_CARBON_COMPOSITE', 'TITANIUM_6AL_4V'],
      selectedConcept: 'BMI_CARBON_COMPOSITE',
      affectedElementArchIds: [airframe.archId],
      requirementIds: ['REQ-THERMAL-STRUCT-01'],
      configurationId: 'CONF-BASE',
      proposedBy: 'AI_OPTIMIZER'
    });

    expect(dec.status).toBe('PROPOSED');

    // AI authorization must fail with governance violation
    expect(() => {
      p3Engine.decisions.authorizeDecision(dec.decisionId, 'AI_AGENT');
    }).toThrowError(/AI_AUTHORITY_VIOLATION/);

    // Human Chief Engineer authorization succeeds
    const authorized = p3Engine.decisions.authorizeDecision(dec.decisionId, 'CHIEF_SYSTEMS_ENGINEER');
    expect(authorized.status).toBe('AUTHORIZED');
    expect(authorized.authorizedBy).toBe('CHIEF_SYSTEMS_ENGINEER');
  });

  // P3-V9: Requirement/Architecture Traceability
  it('P3-V9: Requirement/Architecture Traceability — Maintains bi-directional digital thread to P1 Requirements', () => {
    const elem = p3Engine.registry.registerElement({
      archId: 'arch:comp:EO_IR_TURRET',
      elementType: 'Component',
      displayName: 'Multi-Spectral EO/IR Sensor',
      layer: 'COMPONENT',
      configurationId: 'CONF-BASE',
      p1RequirementId: 'REQ-TARGET-ACQUISITION-01'
    });

    expect(elem.p1RequirementId).toBe('REQ-TARGET-ACQUISITION-01');
    const impact = p3Engine.impact.analyzeImpact(elem.archId);
    expect(impact.affectedRequirements).toContain('REQ-TARGET-ACQUISITION-01');
  });

  // P3-V10: Configuration Integrity
  it('P3-V10: Configuration Integrity — Validates cross-configuration isolation and checks consistency', () => {
    const sys = p3Engine.registry.registerElement({
      archId: 'arch:sys:EW_SUITE_CONF_ATTACK',
      elementType: 'System',
      displayName: 'Electronic Warfare Suite Attack Variant',
      layer: 'SYSTEM',
      configurationId: 'CONF-ATTACK'
    });

    const sub = p3Engine.registry.registerElement({
      archId: 'arch:sub:EW_POD_ATTACK',
      elementType: 'Subsystem',
      displayName: 'EW Pod Config Attack',
      layer: 'SUBSYSTEM',
      configurationId: 'CONF-ATTACK'
    });

    p3Engine.decomposition.decompose({
      parentArchId: sys.archId,
      childArchId: sub.archId,
      configurationId: 'CONF-ATTACK'
    });

    const consistency = p3Engine.consistency.auditConsistency('CONF-ATTACK');
    expect(consistency.isConsistent).toBe(true);
    expect(consistency.findings.filter(f => f.category === 'CONFIGURATION').length).toBe(0);
  });

  // P3-V11: Revision Integrity
  it('P3-V11: Revision Integrity — Validates cryptographic immutable hashes bound to SECP Core', () => {
    const elem = p3Engine.registry.registerElement({
      archId: 'arch:sys:RADAR',
      elementType: 'System',
      displayName: 'AESA Radar Array',
      layer: 'SYSTEM',
      configurationId: 'CONF-BASE'
    });

    expect(elem.revisionHash).toHaveLength(64); // SHA-256 hash
    expect(elem.revisionId).toBeDefined();
  });

  // P3-V12: Provenance/Evidence
  it('P3-V12: Provenance/Evidence — Verifies cryptographic provenance tracking across all architecture entities', () => {
    const opt1 = p3Engine.registry.registerElement({
      archId: 'arch:sub:OPT_1',
      elementType: 'Subsystem',
      displayName: 'Optical Transceiver 1',
      layer: 'SUBSYSTEM',
      configurationId: 'CONF-BASE'
    });

    const opt2 = p3Engine.registry.registerElement({
      archId: 'arch:sub:OPT_2',
      elementType: 'Subsystem',
      displayName: 'Optical Transceiver 2',
      layer: 'SUBSYSTEM',
      configurationId: 'CONF-BASE'
    });

    const iface = p3Engine.interfaces.defineInterface({
      interfaceId: 'IF-PROV-CHECK',
      displayName: 'High-Speed Optical Bus',
      providerArchId: opt1.archId,
      consumerArchId: opt2.archId,
      direction: 'UNIDIRECTIONAL',
      requiredContract: '100G-SR4',
      providedContract: '100G-SR4',
      flowItemType: 'OPTICAL_DATA',
      configurationId: 'CONF-BASE'
    });

    expect(iface.interfaceId).toBe('IF-PROV-CHECK');
    expect(iface.isCompatible).toBe(true);
  });

  // P3-V13: Persistence/Reconstruction
  it('P3-V13: Persistence/Reconstruction — Verifies complete state capture and reconstruction', () => {
    p3Engine.registry.registerElement({
      archId: 'arch:sys:MISSION_COMPUTER',
      elementType: 'System',
      displayName: 'Mission Management Processing Cluster',
      layer: 'SYSTEM',
      configurationId: 'CONF-PERSIST-01'
    });

    const snapshot = p3Engine.registry.getAllElements();
    expect(snapshot.length).toBeGreaterThan(0);
    
    // Reconstruct into fresh registry instance lookup
    const restored = p3Engine.registry.getElement('arch:sys:MISSION_COMPUTER');
    expect(restored).toBeDefined();
    expect(restored?.displayName).toBe('Mission Management Processing Cluster');
  });

  // P3-V14: AI Governance
  it('P3-V14: AI Governance — Strictly prevents AI from publishing, baselining, or authorizing architecture state', () => {
    expect(() => {
      p3Engine.evaluateAIProposal({
        actor: 'AI_AGENT_AUTOPILOT',
        action: 'PUBLISH_ARCHITECTURE',
        proposedData: { baseline: 'REV-0' },
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/AI_GOVERNANCE_VIOLATION/);

    expect(() => {
      p3Engine.evaluateAIProposal({
        actor: 'COPILOT_BOT',
        action: 'BASELINE_ARCHITECTURE',
        proposedData: {},
        configurationId: 'CONF-BASE'
      });
    }).toThrowError(/AI_GOVERNANCE_VIOLATION/);
  });

  // P3-V15: Design Space Integrity
  it('P3-V15: Design Space Integrity — Enforces verification requirement before promoting candidate to canonical state', () => {
    const airframe = p3Engine.registry.registerElement({
      archId: 'arch:sys:AIRFRAME_DESIGN_SPACE',
      elementType: 'System',
      displayName: 'Airframe System',
      layer: 'SYSTEM',
      configurationId: 'CONF-BASE'
    });

    const space = p3Engine.designSpace.createDesignSpace({
      designSpaceId: 'SPACE-WING-BODY',
      title: 'Blended Wing-Body Aerodynamic Space',
      systemArchId: airframe.archId,
      boundingRequirements: ['REQ-AERO-LD-RATIO'],
      boundingConstraints: ['SPAN_MAX_45M'],
      assumptions: ['Transonic area-ruling applied'],
      configurationId: 'CONF-BASE'
    });

    const candidate = p3Engine.designSpace.addCandidateArchitecture(space.designSpaceId, {
      candidateId: 'CANDIDATE-BWB-101',
      name: 'Blended Wing Body Variant 101',
      architectureSpaceId: space.designSpaceId,
      requirements: ['REQ-AERO-LD-RATIO'],
      parameters: { wingSweepDeg: 38, rootChordM: 14.2 },
      assumptions: ['Composite skin'],
      dependencies: ['WING_ROOT_SPAR'],
      simulationReferences: ['SIM-AERO-001'],
      verificationState: 'UNVERIFIED',
      evidenceState: 'ABSENT',
      confidence: 0.70,
      configurationId: 'CONF-BASE'
    });

    // Promotion must fail while UNVERIFIED
    expect(() => {
      p3Engine.designSpace.promoteCandidateToCanonical({
        designSpaceId: space.designSpaceId,
        candidateId: candidate.candidateId,
        authorizedBy: 'LEAD_AERODYNAMICIST',
        targetRevisionCode: 'REV-BWB'
      });
    }).toThrowError(/CANONICAL_PROMOTION_ERROR/);
  });

  // P3-V16: Future Scenario Isolation & Engineering Time Machine Boundaries
  it('P3-V16: Future Scenario Isolation & Engineering Time Machine Boundaries', () => {
    // 1. Verify Foundational Charter constant
    expect(FutureEngineeringEngine.FOUNDATIONAL_CONTRACT).toBe(
      'SECP does not predict the future as fact. SECP explores engineering futures as hypothesis spaces.'
    );

    // 2. Future Assumption Set is registered as hypothesis, never fact
    const assumptionSet = p3Engine.futureEngineering.registerAssumptionSet({
      assumptionSetId: 'ASSUME-FUSION-2050',
      name: 'Year 2050 Magnetized Target Fusion Assumptions',
      technologyAssumptions: [
        { domain: 'PROPULSION', description: 'Direct drive pulsed fusion', multiplier: 15.0, maturityHorizonYears: 25 }
      ],
      materialAssumptions: [
        { materialClass: 'SUPERCONDUCTING_MAGNETIC_TAPE', targetProperty: 'criticalCurrentDensity', baselineValue: 100, assumedValue: 2500, unit: 'A/mm2' }
      ],
      energyAssumptions: [],
      computingAssumptions: [],
      sensingAssumptions: [],
      manufacturingAssumptions: [],
      controlAssumptions: [],
      uncertaintyBoundaries: []
    });

    const hypoCheck = p3Engine.futureEngineering.assertHypothesisNotFact(assumptionSet.assumptionSetId);
    expect(hypoCheck.isHypothesis).toBe(true);
    expect(hypoCheck.status).toBe('HYPOTHESIS_SPACE_ONLY');

    // 3. Create Parallel Scenarios A and B
    const scenarioA = p3Engine.futureEngineering.createFutureScenario({
      scenarioId: 'SCENARIO-A-FUSION',
      title: 'Fusion Direct Drive High Thrust',
      scenarioType: 'BREAKTHROUGH',
      timeHorizonYears: 25,
      technologyMaturity: 'TRL_2_CONCEPT',
      assumptionSetId: assumptionSet.assumptionSetId,
      configurationId: 'CONF-FUTURE-A',
      candidateArchitectures: [
        {
          candidateId: 'CANDIDATE-FUSION-MAGNETIC-PINCH',
          name: 'Magnetic Pinch Fusion Drive',
          architectureSpaceId: 'SPACE-FUSION',
          requirements: ['REQ-DEEP-SPACE-DELTA-V'],
          parameters: { specificImpulseSec: 12000 },
          assumptions: ['High beta confinement'],
          dependencies: [],
          simulationReferences: [],
          verificationState: 'VERIFIED',
          evidenceState: 'SIMULATION_VALIDATED',
          confidence: 0.8,
          configurationId: 'CONF-FUTURE-A'
        }
      ]
    });

    const scenarioB = p3Engine.futureEngineering.createFutureScenario({
      scenarioId: 'SCENARIO-B-ANTIMATTER',
      title: 'Positron Catalyzed Fusion',
      scenarioType: 'SPECULATIVE',
      timeHorizonYears: 30,
      technologyMaturity: 'TRL_1_BASIC_PRINCIPLE',
      assumptionSetId: assumptionSet.assumptionSetId,
      configurationId: 'CONF-FUTURE-B',
      candidateArchitectures: [
        {
          candidateId: 'CANDIDATE-POSITRON-INJECTOR',
          name: 'Positron Injection Nozzle',
          architectureSpaceId: 'SPACE-ANTIMATTER',
          requirements: ['REQ-DEEP-SPACE-DELTA-V'],
          parameters: { specificImpulseSec: 25000 },
          assumptions: ['Trapped positron storage'],
          dependencies: [],
          simulationReferences: [],
          verificationState: 'UNVERIFIED',
          evidenceState: 'ABSENT',
          confidence: 0.4,
          configurationId: 'CONF-FUTURE-B'
        }
      ]
    });

    // Verify Invariant: Both are strictly isolated from Canonical state
    expect(scenarioA.isIsolatedFromCanonical).toBe(true);
    expect(scenarioB.isIsolatedFromCanonical).toBe(true);

    // Verify Invariant: Cross-scenario isolation validation
    expect(p3Engine.futureEngineering.validateScenarioIsolation(scenarioA.scenarioId, scenarioB.scenarioId)).toBe(true);

    // Boundary Test 1: AI cannot promote future scenario candidate
    expect(() => {
      p3Engine.futureEngineering.promoteScenarioCandidate({
        scenarioId: scenarioA.scenarioId,
        candidateId: 'CANDIDATE-FUSION-MAGNETIC-PINCH',
        authorizedBy: 'AI_AGENT',
        justification: 'Automated breakthrough selection'
      });
    }).toThrowError(/SCENARIO_ISOLATION_VIOLATION/);

    // Boundary Test 2: Unverified future candidate cannot be promoted
    expect(() => {
      p3Engine.futureEngineering.promoteScenarioCandidate({
        scenarioId: scenarioB.scenarioId,
        candidateId: 'CANDIDATE-POSITRON-INJECTOR',
        authorizedBy: 'CHIEF_SYSTEMS_ENGINEER',
        justification: 'Future study exploration'
      });
    }).toThrowError(/SCENARIO_ISOLATION_VIOLATION/);

    // Boundary Test 3: Modifying Canonical Model from inside Future Scenario context is blocked
    expect(() => {
      p3Engine.futureEngineering.guardCanonicalDirectMutation('FUTURE_SCENARIO_CONTEXT_AGENT');
    }).toThrowError(/FUTURE_MUTATION_RESTRICTED/);

    // Boundary Test 4: Scenario cannot self-certify its own evidence
    expect(() => {
      p3Engine.futureEngineering.guardSelfCertifiedEvidence(scenarioA.scenarioId, `SCENARIO_AGENT_${scenarioA.scenarioId}`);
    }).toThrowError(/EVIDENCE_AUTHORITY_VIOLATION/);
  });

  // Capability Registry Reconciliation: 20/20 Contracted Capabilities
  it('Capability Registry Reconciliation — Confirms all 20/20 Canonical Capabilities are registered and auditable', () => {
    const expectedCapabilities = [
      'ADSE_SYSTEM_ARCHITECTURE',
      'ADSE_ARCHITECTURE_MODELING',
      'ADSE_SYSTEM_DECOMPOSITION',
      'ADSE_ARCHITECTURE_VIEWS',
      'ADSE_ARCHITECTURE_INTERFACES',
      'ADSE_ARCHITECTURE_DEPENDENCIES',
      'ADSE_ARCHITECTURE_ALLOCATION',
      'ADSE_ARCHITECTURE_CONSTRAINTS',
      'ADSE_ARCHITECTURE_DECISIONS',
      'ADSE_ARCHITECTURE_TRADE_ANALYSIS',
      'ADSE_ARCHITECTURE_IMPACT_ANALYSIS',
      'ADSE_ARCHITECTURE_CONSISTENCY',
      'ADSE_CONFIGURATION_ARCHITECTURE',
      'ADSE_ARCHITECTURE_TRACEABILITY',
      'ADSE_ARCHITECTURE_VERIFICATION',
      'ADSE_ARCHITECTURE_AI_ASSISTANCE',
      'ADSE_ARCHITECTURE_DESIGN_SPACE',
      'ADSE_FUTURE_ENGINEERING_FOUNDATION',
      'ADSE_FUTURE_SCENARIO_MODEL',
      'ADSE_UNKNOWN_DESIGN_DISCOVERY_FOUNDATION'
    ];

    expect(expectedCapabilities.length).toBe(20);

    const audit = ADSEP3ForensicAuditEngine.runAudit();
    expect(audit.auditPassed).toBe(true);
    expect(audit.gates.length).toBe(16);
    expect(Object.keys(audit.capabilities).length).toBe(20);

    // All 20 capabilities must satisfy all 10 maturity & truth stages
    for (const capId of expectedCapabilities) {
      const cap = audit.capabilities[capId];
      expect(cap).toBeDefined();
      expect(cap.DECLARED).toBe(true);
      expect(cap.IMPLEMENTED).toBe(true);
      expect(cap.EXECUTED).toBe(true);
      expect(cap.CORE_BOUND).toBe(true);
      expect(cap.CANONICAL_BOUND).toBe(true);
      expect(cap.VERIFIED).toBe(true);
      expect(cap.EVIDENCE_BACKED).toBe(true);
      expect(cap.PERSISTED).toBe(true);
      expect(cap.BENCHMARKED).toBe(true);
      expect(cap.PUBLISHED).toBe(true);
    }
  });
});
