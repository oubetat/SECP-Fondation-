/**
 * SECP Industrial OS — M9 Cross-Domain Workflow & Continuity Engine
 * 
 * Orchestrates authoritative multi-domain dataflow:
 * Canonical Revision R1
 *   -> Domain A Execution (Robotics)
 *   -> Verified Result A
 *   -> CrossDomainHandoff (CROSS_DOMAIN_INPUT_FROM)
 *   -> Domain B Execution (Aerospace / Manufacturing)
 *   -> Verified Result B
 *   -> Revision R2
 * 
 * NON-NEGOTIABLE LAWS:
 * - NO parallel canonical models or hidden state.
 * - MUST consume from identical canonical revision and geometry.
 * - Stale handoffs against newer revisions FAIL CLOSED.
 */
import { createHash } from 'crypto';
import { 
  CrossDomainHandoffRecord, 
  CrossDomainResultStatus, 
  EngineeringDomain 
} from './CrossDomainTypes';
import { GenericExecutionRegistry } from '../execution/GenericExecutionRegistry';
import { GenericExecutionEnvelope } from '../execution/CoreExecutionTypes';
import { CoreExecutionAuthority } from '../execution/CoreExecutionAuthority';

export class CrossDomainWorkflowEngine {
  private static handoffs: Map<string, CrossDomainHandoffRecord> = new Map();

  /**
   * Authoritatively packages a verified output from Domain A into a cross-domain input for Domain B.
   */
  public static createHandoff(params: {
    sourceEnvelope: GenericExecutionEnvelope;
    targetDomain: EngineeringDomain | string;
    targetParameterKey: string;
    extractedValue: any;
  }): CrossDomainHandoffRecord {
    const { sourceEnvelope, targetDomain, targetParameterKey, extractedValue } = params;

    // 1. Verify source envelope exists in GenericExecutionRegistry
    if (!GenericExecutionRegistry.verifyExecution(sourceEnvelope.executionId)) {
      throw new Error(`CROSS_DOMAIN_HANDOFF_FAILED: Source execution '${sourceEnvelope.executionId}' is not registered in GenericExecutionRegistry.`);
    }

    // 2. Validate envelope state
    if (sourceEnvelope.state !== 'SEALED' && sourceEnvelope.state !== 'REGISTERED') {
      throw new Error(`CROSS_DOMAIN_HANDOFF_FAILED: Source execution is in unsealed state '${sourceEnvelope.state}'.`);
    }

    if (sourceEnvelope.verificationResult.overallVerdict !== 'PASS') {
      throw new Error(`CROSS_DOMAIN_HANDOFF_FAILED: Source execution failed verification.`);
    }

    const relationHash = createHash('sha256')
      .update(`${sourceEnvelope.executionId}:${targetDomain}:${targetParameterKey}:${JSON.stringify(extractedValue)}`)
      .digest('hex');

    const handoffId = `HANDOFF-XD-${relationHash.substring(0, 16).toUpperCase()}`;

    const handoff: CrossDomainHandoffRecord = {
      handoffId,
      engineeringObjectId: sourceEnvelope.engineeringObjectId,
      sourceRevisionId: sourceEnvelope.evidenceLeaf.revisionId,
      sourceRevisionHash: sourceEnvelope.revisionHash,
      sourceGeometryHash: sourceEnvelope.geometryHash,
      sourceDomain: sourceEnvelope.pluginId,
      sourceExecutionId: sourceEnvelope.executionId,
      sourceResultDigest: sourceEnvelope.resultDigest,
      targetDomain,
      targetParameterKey,
      targetParameterValue: extractedValue,
      status: 'VALID',
      createdAt: new Date().toISOString(),
      relationHash
    };

    this.handoffs.set(handoffId, Object.freeze({ ...handoff }));

    return handoff;
  }

  /**
   * Validates if a cross-domain handoff can be consumed in the context of a target revision.
   * If target revision hash != source revision hash, returns STALE / REQUIRES_RECOMPUTATION (FAIL CLOSED).
   */
  public static validateHandoffForConsumption(
    handoffId: string,
    targetRevisionId: string,
    targetRevisionHash: string,
    targetGeometryHash: string
  ): { isValid: boolean; status: CrossDomainResultStatus; reason?: string } {
    const handoff = this.handoffs.get(handoffId);
    if (!handoff) {
      return {
        isValid: false,
        status: 'INVALIDATED',
        reason: `Handoff '${handoffId}' not found.`
      };
    }

    // Fail closed if revision or geometry has mutated
    if (handoff.sourceRevisionHash !== targetRevisionHash) {
      return {
        isValid: false,
        status: 'STALE',
        reason: `STALE_CROSS_DOMAIN_HANDOFF: Source revision hash '${handoff.sourceRevisionHash}' does not match active revision hash '${targetRevisionHash}'. Recomputation required.`
      };
    }

    if (handoff.sourceGeometryHash !== targetGeometryHash) {
      return {
        isValid: false,
        status: 'INVALIDATED',
        reason: `INVALIDATED_GEOMETRY_MISMATCH: Source geometry hash '${handoff.sourceGeometryHash}' does not match active geometry hash '${targetGeometryHash}'.`
      };
    }

    return {
      isValid: true,
      status: 'VALID'
    };
  }

  /**
   * Retrieves all handoffs for an engineering object.
   */
  public static getHandoffs(engineeringObjectId: string): CrossDomainHandoffRecord[] {
    const results: CrossDomainHandoffRecord[] = [];
    for (const h of this.handoffs.values()) {
      if (h.engineeringObjectId === engineeringObjectId) {
        results.push(h);
      }
    }
    return results;
  }

  /**
   * Rehydrates handoffs from persistent storage.
   */
  public static rehydrate(records: CrossDomainHandoffRecord[]): void {
    for (const rec of records) {
      this.handoffs.set(rec.handoffId, rec);
    }
  }

  /**
   * Clears state for tests.
   */
  public static clear(): void {
    this.handoffs.clear();
  }
}
