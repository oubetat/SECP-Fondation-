/**
 * SECP Industrial OS — Engineering Truth OS
 * SECP-PHASE-5-001: Aircraft & Industrial Qualification Engine
 * QualificationChangeImpact.ts
 * 
 * Formal Change Impact Analysis and Evidence Invalidation Cascade for
 * System-Level Qualification. Prevents stale or obsolete evidence from
 * being accepted when design parameters or revisions mutate.
 */

import { createHash } from 'crypto';
import { EngineeringSystem } from './EngineeringSystemCanonicalModel';
import {
  QualificationRequirement,
  RequirementVerificationEvidence,
  RequirementLifecycleState
} from './QualificationRequirement';
import { computeMultidomainCanonicalHash } from '../crossdomain/MultidomainPcbIntegrationEngine';

export interface SubsystemFingerprint {
  domain: string;
  hash: string;
  itemCount: number;
}

export interface SystemDesignFingerprint {
  systemId: string;
  revisionId: string;
  assemblyHash: string;
  timestamp: string;
  subsystems: {
    ecad: SubsystemFingerprint;
    electrical: SubsystemFingerprint;
    harness: SubsystemFingerprint;
    mcad: SubsystemFingerprint;
    thermal: SubsystemFingerprint;
    bom: SubsystemFingerprint;
  };
}

export interface EvidenceInvalidationRecord {
  requirementId: string;
  targetDomain: string;
  targetElementId: string;
  reason: string;
  staleEvidenceDigest: string;
  invalidationTimestamp: string;
  reVerificationRequired: boolean;
}

export interface QualificationChangeImpactReport {
  timestamp: string;
  baselineRevisionId: string;
  currentRevisionId: string;
  isConfigurationMutated: boolean;
  mutatedDomains: string[];
  invalidatedEvidenceCount: number;
  invalidatedEvidence: EvidenceInvalidationRecord[];
  isQualificationBlocked: boolean;
  blockerMessage?: string;
}

export class QualificationChangeImpact {
  /**
   * Generates a deterministic cryptographic fingerprint of all system sub-domains.
   */
  public static computeSystemFingerprint(system: EngineeringSystem): SystemDesignFingerprint {
    const assembly = system.multidomainAssembly;
    const assemblyHash = computeMultidomainCanonicalHash(assembly);

    const ecadHash = createHash('sha256')
      .update(JSON.stringify({
        width: assembly.pcb.boardWidthMm,
        height: assembly.pcb.boardHeightMm,
        layers: assembly.pcb.layerCount,
        components: assembly.pcb.components.map(c => ({ id: c.id, ref: c.refDes, fp: c.footprintId })).sort((a, b) => a.id.localeCompare(b.id)),
        traces: assembly.pcb.traces?.map(t => ({ id: t.id, net: t.netName, w: t.widthMm, l: t.lengthMm })) || []
      }))
      .digest('hex');

    const electricalHash = createHash('sha256')
      .update(JSON.stringify({
        id: assembly.electricalCircuit.id,
        refNode: assembly.electricalCircuit.referenceNode || 'GND',
        components: assembly.electricalCircuit.components.map(c => ({ id: c.id, type: c.type, val: c.value, nodes: c.nodes })).sort((a, b) => a.id.localeCompare(b.id))
      }))
      .digest('hex');

    const harnessHash = createHash('sha256')
      .update(JSON.stringify({
        connectors: assembly.harness.connectors.map(c => ({ id: c.id, pins: c.pinCount })).sort((a, b) => a.id.localeCompare(b.id)),
        wires: assembly.harness.wires.map(w => ({ id: w.id, gauge: w.gaugeAwg, maxA: w.maxCurrentAmps })).sort((a, b) => a.id.localeCompare(b.id))
      }))
      .digest('hex');

    const mcadHash = createHash('sha256')
      .update(JSON.stringify({
        w: assembly.mechanicalEnclosure.outerWidthMm,
        l: assembly.mechanicalEnclosure.outerLengthMm,
        h: assembly.mechanicalEnclosure.outerHeightMm,
        standoffs: assembly.mechanicalEnclosure.standoffs.map(s => ({ id: s.id, x: s.xMm, y: s.yMm, h: s.heightMm })).sort((a, b) => a.id.localeCompare(b.id)),
        cutouts: assembly.mechanicalEnclosure.connectorCutouts.map(c => ({ id: c.id, x: c.xMm, y: c.yMm })).sort((a, b) => a.id.localeCompare(b.id))
      }))
      .digest('hex');

    const thermalHash = createHash('sha256')
      .update(JSON.stringify({
        ambient: assembly.thermalEnvironment.ambientTempC,
        specs: Object.keys(assembly.thermalEnvironment.componentThermalSpecs).sort().map(k => ({
          ref: k,
          theta: assembly.thermalEnvironment.componentThermalSpecs[k].thetaJaCW,
          maxTj: assembly.thermalEnvironment.componentThermalSpecs[k].maxJunctionTempC
        }))
      }))
      .digest('hex');

    const bomHash = createHash('sha256')
      .update(JSON.stringify(
        assembly.bomItems.map(b => ({ id: b.id, mpn: b.mpn, qty: b.quantity })).sort((a, b) => a.id.localeCompare(b.id))
      ))
      .digest('hex');

    return {
      systemId: system.systemId,
      revisionId: system.revisionId,
      assemblyHash,
      timestamp: new Date().toISOString(),
      subsystems: {
        ecad: { domain: 'ECAD', hash: ecadHash, itemCount: assembly.pcb.components.length },
        electrical: { domain: 'ELECTRICAL', hash: electricalHash, itemCount: assembly.electricalCircuit.components.length },
        harness: { domain: 'WIRING_HARNESS', hash: harnessHash, itemCount: assembly.harness.wires.length },
        mcad: { domain: 'MCAD', hash: mcadHash, itemCount: assembly.mechanicalEnclosure.standoffs.length },
        thermal: { domain: 'THERMAL', hash: thermalHash, itemCount: Object.keys(assembly.thermalEnvironment.componentThermalSpecs).length },
        bom: { domain: 'BOM', hash: bomHash, itemCount: assembly.bomItems.length }
      }
    };
  }

  /**
   * Evaluates impact of changes between a baseline fingerprint and active system state.
   * If any domain fingerprint changes, all evidence associated with that domain is invalidated.
   */
  public static evaluateChangeImpact(
    baselineFingerprint: SystemDesignFingerprint,
    activeSystem: EngineeringSystem,
    activeEvidenceRecords: Map<string, RequirementVerificationEvidence>
  ): QualificationChangeImpactReport {
    const activeFingerprint = this.computeSystemFingerprint(activeSystem);
    const mutatedDomains: string[] = [];
    const invalidatedEvidence: EvidenceInvalidationRecord[] = [];

    // Compare each subsystem domain
    const domains: (keyof SystemDesignFingerprint['subsystems'])[] = [
      'ecad',
      'electrical',
      'harness',
      'mcad',
      'thermal',
      'bom'
    ];

    for (const d of domains) {
      if (baselineFingerprint.subsystems[d].hash !== activeFingerprint.subsystems[d].hash) {
        mutatedDomains.push(baselineFingerprint.subsystems[d].domain);
      }
    }

    // Check revision change
    const revisionChanged = baselineFingerprint.revisionId !== activeFingerprint.revisionId;
    const isMutated = mutatedDomains.length > 0 || revisionChanged;

    if (isMutated) {
      // Invalidate requirements linked to mutated domains
      for (const req of activeSystem.qualificationRequirements) {
        const domainMatches = mutatedDomains.includes(req.targetReference.domain) ||
                              (req.targetReference.domain === 'CROSSDOMAIN' && mutatedDomains.length > 0) ||
                              revisionChanged;

        if (domainMatches) {
          const evidence = activeEvidenceRecords.get(req.requirementId);
          invalidatedEvidence.push({
            requirementId: req.requirementId,
            targetDomain: req.targetReference.domain,
            targetElementId: req.targetReference.elementId,
            reason: revisionChanged
              ? `System revision changed from ${baselineFingerprint.revisionId} to ${activeFingerprint.revisionId}`
              : `Subsystem ${req.targetReference.domain} canonical parameters mutated`,
            staleEvidenceDigest: evidence ? evidence.evidenceDigest : 'NONE_RECORDED',
            invalidationTimestamp: new Date().toISOString(),
            reVerificationRequired: true
          });
        }
      }
    }

    const isQualificationBlocked = invalidatedEvidence.length > 0;

    return {
      timestamp: new Date().toISOString(),
      baselineRevisionId: baselineFingerprint.revisionId,
      currentRevisionId: activeFingerprint.revisionId,
      isConfigurationMutated: isMutated,
      mutatedDomains,
      invalidatedEvidenceCount: invalidatedEvidence.length,
      invalidatedEvidence,
      isQualificationBlocked,
      blockerMessage: isQualificationBlocked
        ? `Qualification is BLOCKED: ${invalidatedEvidence.length} requirement evidence records are invalidated by modifications to domains: ${mutatedDomains.join(', ')}`
        : undefined
    };
  }
}
