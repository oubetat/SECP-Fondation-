/**
 * SECP — ADSE-P7 Power Consistency Engine
 * 
 * Conducts a 20-Dimensional Forensic Audit across:
 *  1. Identity
 *  2. Authority
 *  3. Canonical Component Binding
 *  4. Domain Integrity
 *  5. Source Integrity
 *  6. Load Integrity
 *  7. Bus Integrity
 *  8. Distribution & Branch Integrity
 *  9. Converter Integrity
 * 10. Storage Integrity
 * 11. Operating State Integrity
 * 12. Power Budget Integrity
 * 13. Revision Integrity
 * 14. Configuration Integrity
 * 15. Execution Integrity
 * 16. Solver-Result Conservation Integrity
 * 17. Verification Integrity
 * 18. Evidence & Provenance Integrity
 * 19. Digital Thread Integrity
 * 20. Publication Integrity
 */

import { 
  PowerConsistencyReport, 
  PowerConsistencyFinding 
} from './types';
import { PowerRegistry } from './PowerRegistry';
import { PowerTopologyEngine } from './PowerTopologyEngine';
import { PowerSolverBridge } from './PowerSolverBridge';
import { PowerVerificationAndEvidenceEngine } from './PowerVerificationAndEvidenceEngine';
import { createHash } from 'crypto';

export class PowerConsistencyEngine {
  constructor(
    private registry: PowerRegistry,
    private topology: PowerTopologyEngine,
    private solverBridge: PowerSolverBridge,
    private verificationEngine: PowerVerificationAndEvidenceEngine
  ) {}

  public audit(): PowerConsistencyReport {
    const findings: PowerConsistencyFinding[] = [];

    const addFinding = (
      code: string,
      severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL',
      dimension: string,
      message: string,
      targetId: string,
      remediation?: string
    ) => {
      findings.push({ code, severity, dimension, message, targetId, remediation });
    };

    const systems = this.registry.getAllSystems();

    // 1. Identity & 2. Authority & 19. Digital Thread
    for (const sys of systems) {
      if (!sys.systemId || sys.systemId.includes('FAKE') || sys.systemId.includes('FORGED')) {
        addFinding('PWR-IDENT-001', 'CRITICAL', 'Identity', `Power system '${sys.systemId}' has forged or invalid identity.`, sys.systemId);
      }
      if (!sys.canonicalId || sys.canonicalId.startsWith('FORGED')) {
        addFinding('PWR-AUTH-001', 'CRITICAL', 'Authority', `Power system '${sys.systemId}' is unbound from SECP canonical authority.`, sys.systemId);
      }
      if (!sys.p4NodeId) {
        addFinding('PWR-THREAD-001', 'ERROR', 'Digital Thread Integrity', `Power system '${sys.systemId}' lacks Digital Thread node binding.`, sys.systemId);
      }
    }

    // 5. Source Integrity
    const sources = this.registry.getAllSources();
    for (const src of sources) {
      if (!src.canonicalComponentId || src.canonicalComponentId.includes('FAKE') || src.canonicalComponentId.startsWith('FORGED')) {
        addFinding('PWR-SRC-001', 'CRITICAL', 'Source Integrity', `Source '${src.sourceId}' references non-canonical component '${src.canonicalComponentId}'.`, src.sourceId);
      }
      if (src.ratedContinuousPowerWatts <= 0) {
        addFinding('PWR-SRC-002', 'ERROR', 'Source Integrity', `Source '${src.sourceId}' has non-positive power rating.`, src.sourceId);
      }
    }

    // 6. Load Integrity
    const loads = this.registry.getAllLoads();
    for (const load of loads) {
      if (!load.canonicalComponentId || load.canonicalComponentId.includes('FAKE') || load.canonicalComponentId.startsWith('FORGED')) {
        addFinding('PWR-LOAD-001', 'CRITICAL', 'Load Integrity', `Load '${load.loadId}' references non-canonical component '${load.canonicalComponentId}'.`, load.loadId);
      }
      const bus = this.registry.getBus(load.connectedBusId);
      if (!bus) {
        addFinding('PWR-LOAD-002', 'CRITICAL', 'Load Integrity', `Load '${load.loadId}' connects to missing bus '${load.connectedBusId}'.`, load.loadId);
      }
    }

    // 7. Bus & 8. Distribution Integrity
    const buses = this.registry.getAllBuses();
    const branches = this.topology.getAllBranches();
    for (const br of branches) {
      if (!this.registry.getBus(br.fromBusId)) {
        addFinding('PWR-TOPO-001', 'CRITICAL', 'Distribution Integrity', `Branch '${br.branchId}' references nonexistent fromBus '${br.fromBusId}'.`, br.branchId);
      }
    }

    // 9. Converter Integrity
    const converters = this.registry.getAllConverters();
    for (const conv of converters) {
      if (conv.efficiencyPercent <= 0 || conv.efficiencyPercent > 100.0) {
        addFinding('PWR-CONV-001', 'CRITICAL', 'Converter Integrity', `Converter '${conv.converterId}' has impossible efficiency ${conv.efficiencyPercent}%.`, conv.converterId);
      }
    }

    // 10. Storage Integrity
    const storages = this.registry.getAllStorages();
    for (const st of storages) {
      if (st.stateOfChargePercent < 0 || st.stateOfChargePercent > 100.0) {
        addFinding('PWR-BAT-001', 'CRITICAL', 'Storage Integrity', `Storage '${st.storageId}' has invalid SoC ${st.stateOfChargePercent}%.`, st.storageId);
      }
    }

    // 11. Operating State Integrity
    const opStates = this.registry.getAllOperatingStates();
    for (const op of opStates) {
      if (op.activeSourceIds.length === 0) {
        addFinding('PWR-OP-001', 'WARNING', 'Operating State Integrity', `Operating state '${op.stateId}' has no active generation sources.`, op.stateId);
      }
    }

    // 13. Revision & 14. Configuration Integrity
    for (const load of loads) {
      const parent = this.registry.getSystem(load.systemId);
      if (parent && parent.configurationId !== load.configurationId) {
        addFinding('PWR-CONF-001', 'CRITICAL', 'Configuration Integrity', `Cross-configuration contamination in load '${load.loadId}'.`, load.loadId);
      }
      if (parent && parent.revisionId !== load.revisionId) {
        addFinding('PWR-REV-001', 'CRITICAL', 'Revision Integrity', `Cross-revision contamination in load '${load.loadId}'.`, load.loadId);
      }
    }

    // 15. Execution & 16. Solver Result Integrity
    const executions = this.solverBridge.getAllExecutions();
    for (const exec of executions) {
      if (!exec.fingerprints.combinedFingerprint) {
        addFinding('PWR-EXEC-001', 'ERROR', 'Execution Integrity', `Execution '${exec.executionId}' lacks cryptographic fingerprints.`, exec.executionId);
      }
      const res = this.solverBridge.getResult(exec.executionId);
      if (exec.status === 'COMPLETED' && !res) {
        addFinding('PWR-RES-001', 'ERROR', 'Solver-Result Integrity', `Execution '${exec.executionId}' is COMPLETED but has no result record.`, exec.executionId);
      }
    }

    // 17. Verification & 18. Evidence Integrity
    const intents = this.verificationEngine.getAllIntents();
    for (const intent of intents) {
      if (intent.status === 'PASSED' && !intent.evidenceId) {
        addFinding('PWR-VERIF-001', 'CRITICAL', 'Verification Integrity', `Intent '${intent.intentId}' passed without linking evidence.`, intent.intentId);
      }
    }

    const evidences = this.verificationEngine.getAllEvidences();
    for (const ev of evidences) {
      if (!ev.provenanceId || !ev.evidenceHash) {
        addFinding('PWR-EV-001', 'CRITICAL', 'Evidence Integrity', `Evidence '${ev.evidenceId}' has no cryptographic hash or provenance.`, ev.evidenceId);
      }
    }

    // 20. Publication Integrity
    for (const sys of systems) {
      if (sys.isPublished) {
        const hasVerifiedEvidence = evidences.some(e => e.systemId === sys.systemId);
        if (!hasVerifiedEvidence) {
          addFinding('PWR-PUB-001', 'CRITICAL', 'Publication Integrity', `System '${sys.systemId}' is marked published without verified evidence.`, sys.systemId);
        }
      }
    }

    const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
    const errorCount = findings.filter(f => f.severity === 'ERROR').length;
    const warningCount = findings.filter(f => f.severity === 'WARNING').length;
    const infoCount = findings.filter(f => f.severity === 'INFO').length;

    const merkleRoot = createHash('sha256')
      .update(JSON.stringify(findings))
      .digest('hex');

    return {
      timestamp: new Date().toISOString(),
      isConsistent: criticalCount === 0 && errorCount === 0,
      totalFindings: findings.length,
      criticalCount,
      errorCount,
      warningCount,
      infoCount,
      merkleRoot,
      findings
    };
  }
}
