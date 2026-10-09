import { describe, it, expect } from 'vitest';
import {
  UniversalDigitalThreadEngine,
  ThreadNode,
  UniversalDigitalThread,
  ThreadStatus
} from '../UniversalDigitalThreadEngine';

describe('EPC-031 — UNIVERSAL DIGITAL THREAD ENGINE', () => {
  
  // A helper to construct a fully valid reference thread for a specific domain
  const buildValidThread = (domain: string, rev: string = 'A'): ThreadNode[] => {
    return [
      {
        id: 'REQ-001',
        type: 'REQUIREMENT',
        name: `${domain} Structural Integrity Requirement`,
        revision: '1.0',
        metadata: { verifiedEvidenceId: 'EV-REQ-001' },
        upstreamDependencies: []
      },
      {
        id: 'CAD-001',
        type: 'CAD_REVISION',
        name: `${domain} Main Structure CAD`,
        revision: rev,
        metadata: { verifiedEvidenceId: 'EV-CAD-001' },
        upstreamDependencies: [{ nodeId: 'REQ-001', expectedRevision: '1.0' }]
      },
      {
        id: 'CAE-001',
        type: 'CAE_MODEL',
        name: `${domain} Finite Element Mesh & Load Case`,
        revision: rev,
        metadata: { verifiedEvidenceId: 'EV-CAE-001' },
        upstreamDependencies: [{ nodeId: 'CAD-001', expectedRevision: rev }]
      },
      {
        id: 'BOM-001',
        type: 'BOM',
        name: `${domain} Manufacturing Bill of Materials`,
        revision: rev,
        metadata: { verifiedEvidenceId: 'EV-BOM-001' },
        upstreamDependencies: [{ nodeId: 'CAD-001', expectedRevision: rev }]
      },
      {
        id: 'CAM-001',
        type: 'CAM',
        name: `${domain} Machining Strategy Plan`,
        revision: rev,
        metadata: { verifiedEvidenceId: 'EV-CAM-001' },
        upstreamDependencies: [{ nodeId: 'CAD-001', expectedRevision: rev }]
      },
      {
        id: 'SIM-001',
        type: 'SIMULATION',
        name: `${domain} Multiphysics Load Run`,
        revision: rev,
        metadata: { verifiedEvidenceId: 'EV-SIM-001' },
        upstreamDependencies: [
          { nodeId: 'CAD-001', expectedRevision: rev },
          { nodeId: 'CAE-001', expectedRevision: rev }
        ]
      },
      {
        id: 'EV-001',
        type: 'EVIDENCE',
        name: `${domain} Verified Cryptographic Truth Certificate`,
        revision: rev,
        metadata: {},
        upstreamDependencies: [{ nodeId: 'SIM-001', expectedRevision: rev }]
      }
    ];
  };

  it('should establish a fully VALID digital thread across all links (Requirement -> CAD -> CAE -> CAM -> BOM -> Simulation -> Evidence)', () => {
    const nodes = buildValidThread('DRONE');
    const thread = UniversalDigitalThreadEngine.createThread('THREAD-DRONE-001', 'DRONE', nodes);

    const evaluation = UniversalDigitalThreadEngine.evaluateThread(thread);
    expect(evaluation.overallStatus).toBe('VALID');
    expect(evaluation.messages.length).toBe(0);

    // Verify traceability graph can be reconstructed
    const graph = UniversalDigitalThreadEngine.generateTraceabilityGraph(thread);
    expect(graph.nodes.length).toBe(7);
    expect(graph.edges.length).toBe(7);

    // Check CAD -> CAE link is correct
    const caeEdge = graph.edges.find(e => e.from === 'CAD-001' && e.to === 'CAE-001');
    expect(caeEdge).toBeDefined();

    // Check CAD -> CAM link is correct
    const camEdge = graph.edges.find(e => e.from === 'CAD-001' && e.to === 'CAM-001');
    expect(camEdge).toBeDefined();

    // Check CAD -> BOM link is correct
    const bomEdge = graph.edges.find(e => e.from === 'CAD-001' && e.to === 'BOM-001');
    expect(bomEdge).toBeDefined();

    // Check CAE -> Simulation link is correct
    const simEdge = graph.edges.find(e => e.from === 'CAE-001' && e.to === 'SIM-001');
    expect(simEdge).toBeDefined();
  });

  it('should correctly mark thread as STALE if upstream changes occur without propagating the change to downstream expectations', () => {
    const nodes = buildValidThread('VEHICLE', 'A');
    let thread = UniversalDigitalThreadEngine.createThread('THREAD-VEHICLE-001', 'VEHICLE', nodes);

    // Initial state is VALID
    expect(UniversalDigitalThreadEngine.evaluateThread(thread).overallStatus).toBe('VALID');

    // 10. Change Propagation Test: Update upstream CAD to Revision 'B'
    thread = UniversalDigitalThreadEngine.propagateChange(thread, 'CAD-001', 'B');

    // Downstream expects 'A' for 'CAD-001' but CAD-001 is now 'B' -> STALE
    const evaluation = UniversalDigitalThreadEngine.evaluateThread(thread);
    expect(evaluation.overallStatus).toBe('STALE');
    expect(evaluation.nodeStatuses['CAE-001']).toBe('STALE');
    expect(evaluation.nodeStatuses['SIM-001']).toBe('STALE');
    expect(evaluation.nodeStatuses['CAM-001']).toBe('STALE');
    expect(evaluation.nodeStatuses['BOM-001']).toBe('STALE');

    // Messages must contain details of the mismatch
    expect(evaluation.messages.some(msg => msg.includes('revision mismatch'))).toBe(true);
  });

  it('should mark thread as BROKEN if a required upstream dependency node is missing', () => {
    const nodes = buildValidThread('ROBOT');
    // Filter out CAD-001 to break the dependencies
    const brokenNodes = nodes.filter(n => n.id !== 'CAD-001');
    const thread = UniversalDigitalThreadEngine.createThread('THREAD-ROBOT-001', 'ROBOT', brokenNodes);

    const evaluation = UniversalDigitalThreadEngine.evaluateThread(thread);
    expect(evaluation.overallStatus).toBe('BROKEN');
    expect(evaluation.nodeStatuses['CAE-001']).toBe('BROKEN');
    expect(evaluation.messages.some(msg => msg.includes('missing upstream dependency'))).toBe(true);
  });

  it('should mark thread as INCOMPLETE if mandatory thread components are missing', () => {
    const nodes = buildValidThread('PUMP');
    // Remove SIMULATION and EVIDENCE nodes to make it incomplete
    const incompleteNodes = nodes.filter(n => n.type !== 'SIMULATION' && n.type !== 'EVIDENCE');
    const thread = UniversalDigitalThreadEngine.createThread('THREAD-PUMP-001', 'PUMP', incompleteNodes);

    const evaluation = UniversalDigitalThreadEngine.evaluateThread(thread);
    // Mandatory types are missing, status is INCOMPLETE
    expect(evaluation.overallStatus).toBe('INCOMPLETE');
    expect(evaluation.messages.some(msg => msg.includes('Thread is incomplete'))).toBe(true);
  });

  it('should mark node as UNVERIFIED if it has no associated cryptographic evidence in metadata', () => {
    const nodes = buildValidThread('GEARBOX');
    // Remove verified evidence on CAE-001
    const unverifiedNodes = nodes.map(n => {
      if (n.id === 'CAE-001') {
        return { ...n, metadata: {} }; // no verifiedEvidenceId
      }
      return n;
    });

    const thread = UniversalDigitalThreadEngine.createThread('THREAD-GEARBOX-001', 'GEARBOX', unverifiedNodes);
    const evaluation = UniversalDigitalThreadEngine.evaluateThread(thread);
    
    expect(evaluation.overallStatus).toBe('UNVERIFIED');
    expect(evaluation.nodeStatuses['CAE-001']).toBe('UNVERIFIED');
  });

  it('should prove domain configurations operate identically across multiple system archetypes', () => {
    const domains = ['DRONE', 'ROBOT', 'VEHICLE', 'PUMP', 'HEAT_EXCHANGER', 'GEARBOX', 'TURBOMACHINERY', 'INDUSTRIAL_MACHINE'];

    for (const domain of domains) {
      const nodes = buildValidThread(domain);
      const thread = UniversalDigitalThreadEngine.createThread(`THREAD-${domain}-1`, domain, nodes);
      const evalResult = UniversalDigitalThreadEngine.evaluateThread(thread);
      
      expect(evalResult.overallStatus).toBe('VALID');
      expect(thread.domain).toBe(domain);
    }
  });
});
