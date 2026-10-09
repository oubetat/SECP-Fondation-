/**
 * Chaos Campaign Manager for SECP Industrial OS v3
 * PATCH-184: Deterministic Industrial Chaos Testing Campaigns
 */

import { ChaosCampaign, ChaosScenario, FailureDomain, FailureRecord } from './ChaosTypes';
import { FailureInjectionEngine } from './FailureInjectionEngine';
import { DomainInjectors } from './DomainInjectors';
import { IndependentChaosOracle } from './IndependentChaosOracle';

export class ChaosCampaignManager {
  private engine: FailureInjectionEngine;

  constructor() {
    this.engine = new FailureInjectionEngine();
  }

  public getAvailableCampaigns(): Array<{ id: string; name: string; domain: FailureDomain | 'ALL' }> {
    return [
      { id: 'CAMPAIGN-CAD-001', name: 'CAD / B-Rep Topology Chaos Campaign', domain: 'CAD_BREP' },
      { id: 'CAMPAIGN-DEGEN-001', name: 'Near-Zero & Degenerate Geometry Campaign', domain: 'DEGENERATE_GEOMETRY' },
      { id: 'CAMPAIGN-NUM-001', name: 'Numerical Instability & Drift Campaign', domain: 'NUMERICAL_INSTABILITY' },
      { id: 'CAMPAIGN-MESH-001', name: 'Mesh Quality & Discretization Campaign', domain: 'MESH' },
      { id: 'CAMPAIGN-MAT-001', name: 'Material Property & Certificate Campaign', domain: 'MATERIAL' },
      { id: 'CAMPAIGN-CFD-001', name: 'CFD Residual Divergence & CFL Campaign', domain: 'CFD' },
      { id: 'CAMPAIGN-FEM-001', name: 'FEM Stiffness Matrix Singularity Campaign', domain: 'FEM' },
      { id: 'CAMPAIGN-GCS-001', name: 'GCS Constraint Conflict Graph Campaign', domain: 'GCS_CONSTRAINT' },
      { id: 'CAMPAIGN-CAM-001', name: 'CAM 5-Axis Kinematics Collision Campaign', domain: 'CAM' },
      { id: 'CAMPAIGN-PLM-001', name: 'PLM ECO & BOM Governance Campaign', domain: 'PLM' },
      { id: 'CAMPAIGN-EVIDENCE-001', name: 'Evidence Hash & Signature Tamper Campaign', domain: 'EVIDENCE' },
      { id: 'CAMPAIGN-CROSS-DOMAIN-001', name: 'Cross-Domain Chained Chaos Campaign', domain: 'CROSS_DOMAIN' },
      { id: 'CAMPAIGN-FULL-CHAOS-84', name: 'Master Enterprise Chaos Battery (All 12 Domains)', domain: 'ALL' }
    ];
  }

  /**
   * Executes a campaign deterministically using a provided seed
   */
  public executeCampaign(campaignId: string, seed: number = 2026184): ChaosCampaign {
    const startTime = performance.now();
    const allFaults = DomainInjectors.getAllDomainFaults();

    let targetDomain: FailureDomain | 'ALL' = 'ALL';
    let filteredFaults = allFaults;

    if (campaignId.includes('CAD')) {
      targetDomain = 'CAD_BREP';
      filteredFaults = allFaults.filter(f => f.domain === 'CAD_BREP');
    } else if (campaignId.includes('DEGEN')) {
      targetDomain = 'DEGENERATE_GEOMETRY';
      filteredFaults = allFaults.filter(f => f.domain === 'DEGENERATE_GEOMETRY');
    } else if (campaignId.includes('NUM')) {
      targetDomain = 'NUMERICAL_INSTABILITY';
      filteredFaults = allFaults.filter(f => f.domain === 'NUMERICAL_INSTABILITY');
    } else if (campaignId.includes('MESH')) {
      targetDomain = 'MESH';
      filteredFaults = allFaults.filter(f => f.domain === 'MESH');
    } else if (campaignId.includes('MAT')) {
      targetDomain = 'MATERIAL';
      filteredFaults = allFaults.filter(f => f.domain === 'MATERIAL');
    } else if (campaignId.includes('CFD')) {
      targetDomain = 'CFD';
      filteredFaults = allFaults.filter(f => f.domain === 'CFD');
    } else if (campaignId.includes('FEM')) {
      targetDomain = 'FEM';
      filteredFaults = allFaults.filter(f => f.domain === 'FEM');
    } else if (campaignId.includes('GCS')) {
      targetDomain = 'GCS_CONSTRAINT';
      filteredFaults = allFaults.filter(f => f.domain === 'GCS_CONSTRAINT');
    } else if (campaignId.includes('CAM')) {
      targetDomain = 'CAM';
      filteredFaults = allFaults.filter(f => f.domain === 'CAM');
    } else if (campaignId.includes('PLM')) {
      targetDomain = 'PLM';
      filteredFaults = allFaults.filter(f => f.domain === 'PLM');
    } else if (campaignId.includes('EVIDENCE')) {
      targetDomain = 'EVIDENCE';
      filteredFaults = allFaults.filter(f => f.domain === 'EVIDENCE');
    } else if (campaignId.includes('CROSS-DOMAIN')) {
      targetDomain = 'CROSS_DOMAIN';
      filteredFaults = allFaults.filter(f => f.domain === 'CROSS_DOMAIN');
    }

    const scenario: ChaosScenario = {
      scenarioId: `SCENARIO-${campaignId}`,
      name: `Scenario for ${campaignId}`,
      domain: targetDomain === 'ALL' ? 'CROSS_DOMAIN' : targetDomain,
      faults: filteredFaults,
      expectedDetection: 'All injected faults must be detected and isolated',
      expectedRootCause: 'Injected chaos fault payload',
      recoveryPossible: true
    };

    let detectedCount = 0;
    let isolatedCount = 0;
    let containedCount = 0;
    let recoveredCount = 0;
    let rejectedCount = 0;
    let undetectedCount = 0;

    const records: FailureRecord[] = [];

    filteredFaults.forEach((fault, idx) => {
      const faultSeed = seed + idx * 101;
      const record = this.engine.injectAndProcessFault(fault, faultSeed);
      const oracleAudit = IndependentChaosOracle.auditRecord(record);

      if (oracleAudit.oracleVerdict === 'PASS') {
        if (record.actualStatus === 'DETECTED') detectedCount++;
        if (record.isolationBoundary) isolatedCount++;
        if (record.contained) containedCount++;
        if (record.actualStatus === 'RECOVERED') recoveredCount++;
        if (record.actualStatus === 'REJECTED') rejectedCount++;
      } else {
        undetectedCount++;
      }

      records.push(record);
    });

    const executionTimeMs = Number((performance.now() - startTime).toFixed(2));
    const totalInjected = filteredFaults.length;
    const criticalFailuresCount = undetectedCount;
    const verdict = criticalFailuresCount === 0 ? 'QUALIFIED' : 'FAILED';

    const evidenceHash = this.computeCampaignHash(campaignId, seed, totalInjected, detectedCount, verdict);

    return {
      campaignId,
      name: `Industrial Chaos Campaign [${campaignId}]`,
      seed,
      domain: targetDomain,
      scenarios: [scenario],
      executionTimeMs,
      totalInjected,
      detectedCount,
      isolatedCount,
      containedCount,
      recoveredCount,
      rejectedCount,
      undetectedCount,
      criticalFailuresCount,
      evidenceHash,
      verdict,
      timestamp: new Date().toISOString()
    };
  }

  private computeCampaignHash(campaignId: string, seed: number, total: number, detected: number, verdict: string): string {
    const raw = `CAMPAIGN:${campaignId}:${seed}:${total}:${detected}:${verdict}`;
    let hash = 0x811c9dc5;
    for (let i = 0; i < raw.length; i++) {
      hash ^= raw.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return `0xCAMPAIGN_PROOF_${hash.toString(16).toUpperCase().padStart(8, '0')}`;
  }

  public getEngine(): FailureInjectionEngine {
    return this.engine;
  }
}
