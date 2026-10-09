/**
 * SECP — ADSE-P4 Digital Thread Core Test Suite
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP4DigitalThreadEngine } from '../../../src/engine/adse/p4/ADSEP4DigitalThreadEngine';

describe('ADSE-P4 Digital Thread Core Suite', () => {
  let p4: ADSEP4DigitalThreadEngine;

  beforeEach(() => {
    p4 = ADSEP4DigitalThreadEngine.getInstance();
    p4.clear();
  });

  it('P4.1: should construct a complete authoritative digital truth chain', () => {
    // 1. Requirement Node (P1)
    const reqNode = p4.registry.registerNode({
      nodeId: 'node:REQ-AERO-001',
      nodeType: 'Requirement',
      canonicalId: 'REQ-AERO-001',
      authoritySource: 'P1_REQUIREMENT_AUTHORITY',
      displayName: 'High-Altitude Hypersonic Cruise Stability',
      configurationId: 'CONF-BASE'
    });

    // 2. MBSE Element Node (P2)
    const mbseNode = p4.registry.registerNode({
      nodeId: 'node:mbse:AERO_STABILITY_BLOCK',
      nodeType: 'MBSEElement',
      canonicalId: 'mbse:block:AERO_STABILITY',
      authoritySource: 'P2_MBSE_SEMANTIC_AUTHORITY',
      displayName: 'Aero Stability Semantic Block',
      configurationId: 'CONF-BASE'
    });

    // 3. Architecture Element Node (P3)
    const archNode = p4.registry.registerNode({
      nodeId: 'node:arch:HYPERSONIC_RUDDERVATOR',
      nodeType: 'ArchitectureElement',
      canonicalId: 'arch:comp:RUDDERVATOR',
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'Ruddervator Control Surface',
      configurationId: 'CONF-BASE'
    });

    // 4. Execution Node (Core)
    const execNode = p4.registry.registerNode({
      nodeId: 'node:exec:CFD_SIM_001',
      nodeType: 'Execution',
      canonicalId: 'EXEC-CFD-MACH5-001',
      authoritySource: 'SECP_CORE_EXECUTION_AUTHORITY',
      displayName: 'Mach 5 Compressible CFD Execution',
      configurationId: 'CONF-BASE'
    });

    // 5. Verification Result Node
    const verifNode = p4.registry.registerNode({
      nodeId: 'node:verif:AERO_VERIF_001',
      nodeType: 'VerificationResult',
      canonicalId: 'VERIF-MACH5-PASSED',
      authoritySource: 'SECP_VERIFICATION_AUTHORITY',
      displayName: 'Mach 5 Cruise Stability Verification Result',
      configurationId: 'CONF-BASE'
    });

    // 6. Evidence Node
    const evidenceNode = p4.registry.registerNode({
      nodeId: 'node:evidence:EVID_CFD_MERKLE_001',
      nodeType: 'Evidence',
      canonicalId: 'EVID-CFD-SEALED-001',
      authoritySource: 'SECP_EVIDENCE_AUTHORITY',
      displayName: 'Signed CFD Residual & Pressure Coefficient Merkle Proof',
      configurationId: 'CONF-BASE'
    });

    // Linkages
    // Req -> MBSE
    p4.registry.registerEdge({
      edgeType: 'SATISFIES',
      sourceNodeId: mbseNode.nodeId,
      targetNodeId: reqNode.nodeId,
      authoritySource: 'P2_MBSE_SEMANTIC_AUTHORITY',
      configurationId: 'CONF-BASE'
    });

    // MBSE -> Architecture
    p4.registry.registerEdge({
      edgeType: 'ALLOCATED_TO',
      sourceNodeId: mbseNode.nodeId,
      targetNodeId: archNode.nodeId,
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      configurationId: 'CONF-BASE'
    });

    // Architecture -> Execution
    p4.registry.registerEdge({
      edgeType: 'EXECUTED_BY',
      sourceNodeId: archNode.nodeId,
      targetNodeId: execNode.nodeId,
      authoritySource: 'SECP_CORE_EXECUTION_AUTHORITY',
      configurationId: 'CONF-BASE'
    });

    // Execution -> Verification
    p4.registry.registerEdge({
      edgeType: 'VERIFIED_BY',
      sourceNodeId: execNode.nodeId,
      targetNodeId: verifNode.nodeId,
      authoritySource: 'SECP_VERIFICATION_AUTHORITY',
      configurationId: 'CONF-BASE'
    });

    // Verification -> Evidence
    p4.registry.registerEdge({
      edgeType: 'SUPPORTED_BY',
      sourceNodeId: verifNode.nodeId,
      targetNodeId: evidenceNode.nodeId,
      authoritySource: 'SECP_EVIDENCE_AUTHORITY',
      configurationId: 'CONF-BASE'
    });

    expect(p4.registry.getAllNodes().length).toBe(6);
    expect(p4.registry.getAllEdges().length).toBe(5);

    // Test Complete Truth Chain Query
    const truthChain = p4.queryEngineeringTruth(reqNode.canonicalId, 'CONF-BASE');
    expect(truthChain.chainIntegrity).toBe('COMPLETE');
    expect(truthChain.requirement).toBeDefined();
    expect(truthChain.mbseElement).toBeDefined();
    expect(truthChain.architectureElement).toBeDefined();
    expect(truthChain.verificationResult).toBeDefined();
    expect(truthChain.evidence).toBeDefined();
    expect(truthChain.provenanceRoot).toBeDefined();
  });

  it('P4.2: should perform bidirectional traceability across digital truth graph', () => {
    const req = p4.registry.registerNode({
      nodeId: 'node:REQ-P4-02',
      nodeType: 'Requirement',
      canonicalId: 'REQ-P4-02',
      authoritySource: 'P1_REQUIREMENT_AUTHORITY',
      displayName: 'Thrust-to-Weight Requirement',
      configurationId: 'CONF-BASE'
    });

    const arch = p4.registry.registerNode({
      nodeId: 'node:arch:PROPULSION_CORE',
      nodeType: 'ArchitectureElement',
      canonicalId: 'arch:comp:AFTERBURNER',
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'Augmented Turbofan Engine',
      configurationId: 'CONF-BASE'
    });

    const verif = p4.registry.registerNode({
      nodeId: 'node:verif:THRUST_STAND_TEST',
      nodeType: 'VerificationResult',
      canonicalId: 'VERIF-STATIC-THRUST',
      authoritySource: 'SECP_VERIFICATION_AUTHORITY',
      displayName: 'Static Test Stand Thrust Verification',
      configurationId: 'CONF-BASE'
    });

    p4.registry.registerEdge({
      edgeType: 'SATISFIES',
      sourceNodeId: arch.nodeId,
      targetNodeId: req.nodeId,
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      configurationId: 'CONF-BASE'
    });

    p4.registry.registerEdge({
      edgeType: 'VERIFIED_BY',
      sourceNodeId: arch.nodeId,
      targetNodeId: verif.nodeId,
      authoritySource: 'SECP_VERIFICATION_AUTHORITY',
      configurationId: 'CONF-BASE'
    });

    // Forward trace from Requirement
    const fwd = p4.traceability.forwardTrace(req.nodeId);
    expect(fwd.nodes.length).toBeGreaterThan(0);

    // Backward trace from Verification
    const bwd = p4.traceability.backwardTrace(verif.nodeId);
    expect(bwd.nodes.length).toBeGreaterThan(0);
    expect(bwd.visitedIds).toContain(arch.nodeId);
  });

  it('P4.3: should propagate change impact across the entire digital thread', () => {
    const req = p4.registry.registerNode({
      nodeId: 'node:REQ-PAYLOAD-01',
      nodeType: 'Requirement',
      canonicalId: 'REQ-PAYLOAD-01',
      authoritySource: 'P1_REQUIREMENT_AUTHORITY',
      displayName: 'Max Payload Weight 5000kg',
      configurationId: 'CONF-BASE'
    });

    const arch = p4.registry.registerNode({
      nodeId: 'node:arch:BAY_STRUCTURE',
      nodeType: 'ArchitectureElement',
      canonicalId: 'arch:comp:INTERNAL_BAY',
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      displayName: 'Reinforced Bay Frame',
      configurationId: 'CONF-BASE'
    });

    const exec = p4.registry.registerNode({
      nodeId: 'node:exec:FEM_STRESS_RUN',
      nodeType: 'Execution',
      canonicalId: 'EXEC-FEM-STRESS-001',
      authoritySource: 'SECP_CORE_EXECUTION_AUTHORITY',
      displayName: 'FEM Nastran Stress Analysis',
      configurationId: 'CONF-BASE'
    });

    const verif = p4.registry.registerNode({
      nodeId: 'node:verif:YIELD_MARGIN_CHECK',
      nodeType: 'VerificationResult',
      canonicalId: 'VERIF-YIELD-MARGIN',
      authoritySource: 'SECP_VERIFICATION_AUTHORITY',
      displayName: 'Yield Margin of Safety Verification',
      configurationId: 'CONF-BASE'
    });

    const evidence = p4.registry.registerNode({
      nodeId: 'node:evidence:EVID_STRESS_CERT',
      nodeType: 'Evidence',
      canonicalId: 'EVID-STRESS-CERT-01',
      authoritySource: 'SECP_EVIDENCE_AUTHORITY',
      displayName: 'Stress Certificate Merkle Leaf',
      configurationId: 'CONF-BASE'
    });

    // Wire: req -> arch -> exec -> verif -> evidence
    p4.registry.registerEdge({
      edgeType: 'SATISFIES',
      sourceNodeId: req.nodeId,
      targetNodeId: arch.nodeId,
      authoritySource: 'P3_ARCHITECTURE_AUTHORITY',
      configurationId: 'CONF-BASE'
    });

    p4.registry.registerEdge({
      edgeType: 'EXECUTED_BY',
      sourceNodeId: arch.nodeId,
      targetNodeId: exec.nodeId,
      authoritySource: 'SECP_CORE_EXECUTION_AUTHORITY',
      configurationId: 'CONF-BASE'
    });

    p4.registry.registerEdge({
      edgeType: 'VERIFIED_BY',
      sourceNodeId: exec.nodeId,
      targetNodeId: verif.nodeId,
      authoritySource: 'SECP_VERIFICATION_AUTHORITY',
      configurationId: 'CONF-BASE'
    });

    p4.registry.registerEdge({
      edgeType: 'SUPPORTED_BY',
      sourceNodeId: verif.nodeId,
      targetNodeId: evidence.nodeId,
      authoritySource: 'SECP_EVIDENCE_AUTHORITY',
      configurationId: 'CONF-BASE'
    });

    // Impact analysis of modifying Requirement
    const impact = p4.impact.analyzeImpact(req.nodeId);
    expect(impact.affectedArchitecture).toContain(arch.canonicalId);
    expect(impact.affectedExecutions).toContain(exec.canonicalId);
    expect(impact.affectedVerifications).toContain(verif.canonicalId);
    expect(impact.affectedEvidences).toContain(evidence.canonicalId);
    expect(impact.severity).toBe('CRITICAL');
  });
});
