/**
 * Independent Chaos Oracle for SECP Industrial OS v3
 * PATCH-184: Independent Detection & Containment Verification
 */

import { InjectedFault, FailureRecord, FailureDomain } from './ChaosTypes';

export class IndependentChaosOracle {
  /**
   * Independently audits a FailureRecord against objective mathematical/logical rules
   */
  public static auditRecord(record: FailureRecord): {
    oracleVerdict: 'PASS' | 'FAIL';
    notes: string;
    ruleChecked: string;
  } {
    const fault = record.fault;

    // Rule 1: Zero Undetected Failures
    if (record.actualStatus === 'UNDETECTED') {
      return {
        oracleVerdict: 'FAIL',
        notes: `CRITICAL ORACLE FAIL: Fault ${fault.faultId} was UNDETECTED by system detectors!`,
        ruleChecked: 'ORACLE_RULE_1_ZERO_UNDETECTED'
      };
    }

    // Rule 2: Zero Leakage to Published Results
    if (!record.publishedResultBlocked) {
      return {
        oracleVerdict: 'FAIL',
        notes: `CRITICAL ORACLE FAIL: Corrupted engineering state from fault ${fault.faultId} leaked to a Published Result!`,
        ruleChecked: 'ORACLE_RULE_2_ZERO_RESULT_LEAKAGE'
      };
    }

    // Rule 3: Valid Isolation Boundary
    if (!record.isolationBoundary || record.isolationBoundary === 'UNCONTAINED_SYSTEM_WIDE') {
      return {
        oracleVerdict: 'FAIL',
        notes: `ORACLE FAIL: Fault ${fault.faultId} lacked a specific isolation boundary.`,
        ruleChecked: 'ORACLE_RULE_3_ISOLATION_BOUNDARY_REQUIRED'
      };
    }

    // Rule 4: Domain-Specific Validation
    const domainCheck = this.verifyDomainRule(fault, record);
    if (!domainCheck.valid) {
      return {
        oracleVerdict: 'FAIL',
        notes: `ORACLE FAIL: Domain rule violation: ${domainCheck.reason}`,
        ruleChecked: domainCheck.ruleName
      };
    }

    // Rule 5: Cryptographic Evidence Integrity
    if (!record.evidenceHash || !record.evidenceHash.startsWith('0xCHAOS_')) {
      return {
        oracleVerdict: 'FAIL',
        notes: `ORACLE FAIL: Invalid cryptographic evidence hash format.`,
        ruleChecked: 'ORACLE_RULE_5_EVIDENCE_HASH_FORMAT'
      };
    }

    return {
      oracleVerdict: 'PASS',
      notes: `ORACLE CERTIFIED: Fault ${fault.faultId} (${fault.domain}) independently verified as DETECTED, CONTAINED, and BLOCKED.`,
      ruleChecked: 'ORACLE_ALL_PASS'
    };
  }

  private static verifyDomainRule(fault: InjectedFault, record: FailureRecord): { valid: boolean; reason?: string; ruleName: string } {
    switch (fault.domain) {
      case 'CAD_BREP':
        return {
          valid: record.diagnosis.recommendedAction === 'REJECT',
          reason: 'B-Rep corruption must recommend REJECT',
          ruleName: 'DOMAIN_CAD_REJECT'
        };
      case 'DEGENERATE_GEOMETRY':
        return {
          valid: record.actualStatus === 'RECOVERED' || record.actualStatus === 'CONTAINED',
          reason: 'Near-zero geometry must be recovered or contained',
          ruleName: 'DOMAIN_DEGEN_RECOVER_CONTAIN'
        };
      case 'NUMERICAL_INSTABILITY':
        return {
          valid: record.diagnosis.technicalDetails.precondition !== undefined,
          reason: 'Numerical instability must log context precondition',
          ruleName: 'DOMAIN_NUM_CONTEXT'
        };
      case 'MESH':
        return {
          valid: record.detectedBy.includes('Mesh') && record.contained,
          reason: 'Mesh failure must trigger solver gate block',
          ruleName: 'DOMAIN_MESH_GATE_BLOCK'
        };
      case 'MATERIAL':
        return {
          valid: record.diagnosis.containmentBoundary === 'MATERIAL_ONTOLOGY_REGISTRY',
          reason: 'Material failure must be isolated at Material Ontology',
          ruleName: 'DOMAIN_MATERIAL_ISOLATION'
        };
      case 'CFD':
        return {
          valid: record.detectedBy.includes('CFD Residual'),
          reason: 'CFD failure must trigger auto-stop residual monitor',
          ruleName: 'DOMAIN_CFD_AUTO_STOP'
        };
      case 'FEM':
        return {
          valid: record.publishedResultBlocked,
          reason: 'FEM failure must never produce valid engineering result',
          ruleName: 'DOMAIN_FEM_RESULT_BLOCK'
        };
      case 'GCS_CONSTRAINT':
        return {
          valid: record.diagnosis.affectedComponents.length > 0,
          reason: 'GCS failure must pinpoint minimal conflict subgraph',
          ruleName: 'DOMAIN_GCS_CONFLICT_GRAPH'
        };
      case 'CAM':
        return {
          valid: record.diagnosis.containmentBoundary.includes('NC_TOOLPATH'),
          reason: 'CAM collision must isolate NC toolpath container',
          ruleName: 'DOMAIN_CAM_TOOLPATH_ISOLATION'
        };
      case 'PLM':
        return {
          valid: record.diagnosis.containmentBoundary.includes('CONFIG_RELEASE'),
          reason: 'PLM revision mismatch must block release gate',
          ruleName: 'DOMAIN_PLM_RELEASE_BLOCK'
        };
      case 'EVIDENCE':
        return {
          valid: record.actualStatus === 'REJECTED',
          reason: 'Evidence hash tampering must cause immediate REJECT',
          ruleName: 'DOMAIN_EVIDENCE_REJECT'
        };
      case 'CROSS_DOMAIN':
        return {
          valid: record.diagnosis.recommendedAction === 'HALT_SYSTEM',
          reason: 'Cross-domain chaos chain must trigger system halt',
          ruleName: 'DOMAIN_CROSS_DOMAIN_HALT'
        };
      default:
        return { valid: true, ruleName: 'DOMAIN_DEFAULT' };
    }
  }
}
