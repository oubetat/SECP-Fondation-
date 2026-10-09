/**
 * SECP — ADSE-P9 Communication Forensic Audit Engine
 * 
 * Verifies forensic integrity across Communications Integration.
 */

import { CommunicationRegistry } from './CommunicationRegistry';
import { createHash } from 'crypto';

export interface P9ForensicGateResult {
  gateId: string;
  status: 'PASS' | 'FAIL';
  finding: string;
  evidenceHash: string;
}

export class ADSEP9ForensicAuditEngine {
  private registry: CommunicationRegistry;

  constructor(registry: CommunicationRegistry) {
    this.registry = registry;
  }

  public performAudit(): {
    overallStatus: 'PASS' | 'FAIL';
    gates: P9ForensicGateResult[];
    merkleRoot: string;
  } {
    const gates: P9ForensicGateResult[] = [];

    // Gate 1: No Parallel Truth
    gates.push(this.auditParallelTruth());

    // Gate 2: Digital Thread Binding
    gates.push(this.auditDigitalThreadBinding());

    // Gate 3: Flow & Protocol Determinism
    gates.push(this.auditFlowDeterminism());

    // Gate 4: Provenance Integrity
    gates.push(this.auditProvenanceIntegrity());

    const overallStatus = gates.every(g => g.status === 'PASS') ? 'PASS' : 'FAIL';
    const merkleRoot = createHash('sha256').update(JSON.stringify(gates)).digest('hex');

    return {
      overallStatus,
      gates,
      merkleRoot
    };
  }

  private auditParallelTruth(): P9ForensicGateResult {
    const systems = this.registry.getAllSystems();
    let status: 'PASS' | 'FAIL' = 'PASS';
    let finding = 'All P9 communication systems are authoritatively bound to P3 Architecture.';

    for (const sys of systems) {
      if (!sys.p3ArchitectureId || sys.authorityState === 'PROPOSED') {
        status = 'FAIL';
        finding = `Parallel Truth Detected: Communication System '${sys.id}' bypasses core authority.`;
        break;
      }
    }

    return {
      gateId: 'P9-G01-NO-PARALLEL-TRUTH',
      status,
      finding,
      evidenceHash: createHash('sha256').update(finding).digest('hex')
    };
  }

  private auditDigitalThreadBinding(): P9ForensicGateResult {
    const systems = this.registry.getAllSystems();
    let status: 'PASS' | 'FAIL' = 'PASS';
    let finding = 'All P9 systems have authoritative P4 Digital Thread nodes.';

    for (const sys of systems) {
      if (!sys.p4NodeId || !sys.p4NodeId.startsWith('thread:node:')) {
        status = 'FAIL';
        finding = `Digital Thread Gap: Communication System '${sys.id}' lacks authoritative lineage node.`;
        break;
      }
    }

    return {
      gateId: 'P9-G02-DIGITAL-THREAD-BINDING',
      status,
      finding,
      evidenceHash: createHash('sha256').update(finding).digest('hex')
    };
  }

  private auditFlowDeterminism(): P9ForensicGateResult {
    const flows = this.registry.getAllDataFlows();
    let status: 'PASS' | 'FAIL' = 'PASS';
    let finding = 'All communication data flows have deterministic traffic parameters.';

    for (const flow of flows) {
      if (flow.messageRateHz <= 0 || flow.messageSizeBytes <= 0) {
        status = 'FAIL';
        finding = `Flow Determinism Error: Flow '${flow.id}' has invalid rate/size parameters.`;
        break;
      }
    }

    return {
      gateId: 'P9-G03-FLOW-DETERMINISM',
      status,
      finding,
      evidenceHash: createHash('sha256').update(finding).digest('hex')
    };
  }

  private auditProvenanceIntegrity(): P9ForensicGateResult {
    const systems = this.registry.getAllSystems();
    let status: 'PASS' | 'FAIL' = 'PASS';
    let finding = 'All P9 entities have deterministic provenance.';

    for (const sys of systems) {
      if (!sys.provenance || !sys.provenance.originHash) {
        status = 'FAIL';
        finding = `Provenance Violation: Communication System '${sys.id}' has no origin hash.`;
        break;
      }
    }

    return {
      gateId: 'P9-G04-PROVENANCE-INTEGRITY',
      status,
      finding,
      evidenceHash: createHash('sha256').update(finding).digest('hex')
    };
  }
}
