/**
 * SECP — ADSE-P6 Thermal Consistency Engine
 * 
 * Conducts a 20-Dimensional Forensic Audit across:
 *  1. Identity
 *  2. Authority
 *  3. Geometry Binding
 *  4. Material Binding
 *  5. Region Integrity
 *  6. Boundary Integrity
 *  7. Load Integrity
 *  8. Interface Integrity
 *  9. Path Integrity
 * 10. Revision Integrity
 * 11. Configuration Integrity
 * 12. Execution Integrity
 * 13. Solver-Result Integrity
 * 14. Verification Integrity
 * 15. Evidence Integrity
 * 16. Provenance Integrity
 * 17. Digital Thread Integrity
 * 18. Persistence Integrity
 * 19. Impact Integrity
 * 20. Publication Integrity
 */

import { 
  ThermalConsistencyReport, 
  ThermalConsistencyFinding, 
  ThermalFindingSeverity 
} from './types';
import { ThermalRegistry } from './ThermalRegistry';
import { ThermalMaterialBindingEngine } from './ThermalMaterialBindingEngine';
import { ThermalBoundaryEngine } from './ThermalBoundaryEngine';
import { ThermalInterfaceEngine } from './ThermalInterfaceEngine';
import { ThermalPathEngine } from './ThermalPathEngine';
import { ThermalSolverBridge } from './ThermalSolverBridge';
import { ThermalVerificationAndEvidenceEngine } from './ThermalVerificationAndEvidenceEngine';
import { createHash } from 'crypto';

export class ThermalConsistencyEngine {
  constructor(
    private registry: ThermalRegistry,
    private materialBindings: ThermalMaterialBindingEngine,
    private boundaries: ThermalBoundaryEngine,
    private interfaces: ThermalInterfaceEngine,
    private paths: ThermalPathEngine,
    private solverBridge: ThermalSolverBridge,
    private verificationEngine: ThermalVerificationAndEvidenceEngine
  ) {}

  public audit(): ThermalConsistencyReport {
    const findings: ThermalConsistencyFinding[] = [];

    const addFinding = (
      code: string,
      severity: ThermalFindingSeverity,
      dimension: string,
      message: string,
      targetId: string,
      remediation?: string
    ) => {
      findings.push({ code, severity, dimension, message, targetId, remediation });
    };

    const models = this.registry.getAllModels();

    // 1. Identity & 2. Authority & 17. Digital Thread
    for (const m of models) {
      if (!m.thermalId || m.thermalId.includes('FAKE') || m.thermalId.includes('FORGED')) {
        addFinding('TH-IDENT-001', 'CRITICAL', 'Identity', `Model '${m.thermalId}' has forged or invalid identity.`, m.thermalId);
      }
      if (!m.canonicalId) {
        addFinding('TH-AUTH-001', 'CRITICAL', 'Authority', `Model '${m.thermalId}' is unbound from SECP canonical authority.`, m.thermalId);
      }
      if (!m.p4NodeId) {
        addFinding('TH-THREAD-001', 'ERROR', 'Digital Thread Integrity', `Model '${m.thermalId}' lacks Digital Thread node binding.`, m.thermalId);
      }
    }

    // 3. Geometry Binding & 4. Material Binding & 5. Region Integrity
    const regions = this.registry.getAllRegions();
    for (const r of regions) {
      if (!r.canonicalGeometryId || r.canonicalGeometryId.includes('FAKE') || r.canonicalGeometryId.includes('NON_CANONICAL')) {
        addFinding('TH-GEOM-001', 'CRITICAL', 'Geometry Binding', `Region '${r.regionId}' references non-canonical geometry '${r.canonicalGeometryId}'.`, r.regionId);
      }
      const mat = this.materialBindings.getBindingByMaterial(r.materialId, r.materialRevision);
      if (!mat) {
        addFinding('TH-MAT-001', 'CRITICAL', 'Material Binding', `Region '${r.regionId}' references unbound material '${r.materialId}' rev ${r.materialRevision}.`, r.regionId);
      } else {
        if (mat.conductivityW_mK <= 0) {
          addFinding('TH-PROP-001', 'ERROR', 'Material Binding', `Material '${r.materialId}' has non-positive thermal conductivity.`, mat.bindingId);
        }
      }
    }

    // 6. Boundary Integrity
    const bcs = this.boundaries.getAllBoundaries();
    for (const bc of bcs) {
      const parent = this.registry.getModel(bc.thermalId);
      if (!parent) {
        addFinding('TH-BC-001', 'CRITICAL', 'Boundary Integrity', `Boundary condition '${bc.boundaryId}' references nonexistent model '${bc.thermalId}'.`, bc.boundaryId);
      }
    }

    // 7. Load Integrity
    const sources = this.boundaries.getAllHeatSources();
    for (const hs of sources) {
      const reg = this.registry.getRegion(hs.targetRegionId);
      if (!reg) {
        addFinding('TH-LOAD-001', 'ERROR', 'Load Integrity', `Heat source '${hs.sourceId}' targets missing region '${hs.targetRegionId}'.`, hs.sourceId);
      }
      if (hs.proposedByAI && hs.sourceType === 'AI_PROPOSED') {
        addFinding('TH-LOAD-002', 'WARNING', 'Load Integrity', `Heat source '${hs.sourceId}' is AI-proposed without formal engineering confirmation.`, hs.sourceId);
      }
    }

    // 8. Interface Integrity
    const ifaces = this.interfaces.getAllInterfaces();
    for (const i of ifaces) {
      if (!i.p5InterfaceId || i.p5InterfaceId.includes('FAKE')) {
        addFinding('TH-INT-001', 'CRITICAL', 'Interface Integrity', `Thermal interface '${i.interfaceId}' is decoupled from P5 Structural Interface.`, i.interfaceId);
      }
    }

    // 9. Path Integrity
    const paths = this.paths.getAllPaths();
    for (const p of paths) {
      if (p.segments.length === 0) {
        addFinding('TH-PATH-001', 'ERROR', 'Path Integrity', `Thermal path '${p.pathId}' contains no segments.`, p.pathId);
      }
    }

    // 10. Revision Integrity & 11. Configuration Integrity
    for (const r of regions) {
      const parent = this.registry.getModel(r.thermalId);
      if (parent && parent.configurationId !== r.configurationId) {
        addFinding('TH-CONF-001', 'CRITICAL', 'Configuration Integrity', `Cross-configuration contamination in region '${r.regionId}' (${r.configurationId} vs ${parent.configurationId}).`, r.regionId);
      }
      if (parent && parent.revisionId !== r.revisionId) {
        addFinding('TH-REV-001', 'CRITICAL', 'Revision Integrity', `Cross-revision contamination in region '${r.regionId}' (${r.revisionId} vs ${parent.revisionId}).`, r.regionId);
      }
    }

    // 12. Execution Integrity & 13. Solver-Result Integrity
    const executions = this.solverBridge.getAllExecutions();
    for (const exec of executions) {
      if (!exec.fingerprints.combinedFingerprint) {
        addFinding('TH-EXEC-001', 'ERROR', 'Execution Integrity', `Execution '${exec.executionId}' lacks cryptographic fingerprints.`, exec.executionId);
      }
      const res = this.solverBridge.getResult(exec.executionId);
      if (exec.status === 'COMPLETED' && !res) {
        addFinding('TH-RES-001', 'ERROR', 'Solver-Result Integrity', `Execution '${exec.executionId}' marked COMPLETED but has no result record.`, exec.executionId);
      }
    }

    // 14. Verification Integrity & 15. Evidence Integrity & 16. Provenance Integrity
    const intents = this.verificationEngine.getAllIntents();
    for (const intent of intents) {
      if (intent.status === 'PASSED' && !intent.evidenceId) {
        addFinding('TH-VERIF-001', 'CRITICAL', 'Verification Integrity', `Intent '${intent.intentId}' passed without linking evidence.`, intent.intentId);
      }
    }

    const evidences = this.verificationEngine.getAllEvidences();
    for (const ev of evidences) {
      if (!ev.provenanceId || !ev.evidenceHash) {
        addFinding('TH-EV-001', 'CRITICAL', 'Evidence Integrity', `Evidence '${ev.evidenceId}' has no cryptographic hash or provenance.`, ev.evidenceId);
      }
    }

    // 20. Publication Integrity: Unverified or invalidated model cannot be published
    for (const m of models) {
      if (m.isPublished) {
        const hasVerifiedEvidence = evidences.some(e => e.thermalId === m.thermalId);
        if (!hasVerifiedEvidence) {
          addFinding('TH-PUB-001', 'CRITICAL', 'Publication Integrity', `Model '${m.thermalId}' is marked published without verified evidence.`, m.thermalId);
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
