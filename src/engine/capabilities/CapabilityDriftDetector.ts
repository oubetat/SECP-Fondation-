/**
 * SECP Industrial OS v3 — PROMPT-053: Capability Drift Detector
 * Detects and flags drift between Frontend capability claims and Backend capability truth.
 *
 * ARCHITECTURAL RULE:
 * - "THE FRONTEND MUST NEVER CLAIM A CAPABILITY THAT THE BACKEND DOES NOT ACTUALLY SUPPORT."
 * - Any attempt by the UI to expose as SUPPORTED or trigger an unverified/missing backend action
 *   is flagged as a Capability Drift Violation and rejected at the gate.
 */

import { CanonicalCapabilityResolver } from './CanonicalCapabilityResolver';
import {
  CapabilityDriftReport,
  CapabilityDriftViolation,
  CapabilityResolution
} from './CapabilityMirrorTypes';
import { createHash } from 'crypto';

export interface FrontendCapabilityClaim {
  capabilityId: string;
  claimedBy: string;             // e.g. "SketchEditorPanel", "ToolbarExtrudeButton"
  claimedExposed: boolean;
  claimedEnabled: boolean;
  claimedStatus?: string;        // e.g. "SUPPORTED", "PROVEN"
}

export class CapabilityDriftDetector {
  private static instance: CapabilityDriftDetector;
  private resolver: CanonicalCapabilityResolver;
  private registeredViolations: CapabilityDriftViolation[] = [];

  private constructor() {
    this.resolver = CanonicalCapabilityResolver.getInstance();
  }

  public static getInstance(): CapabilityDriftDetector {
    if (!CapabilityDriftDetector.instance) {
      CapabilityDriftDetector.instance = new CapabilityDriftDetector();
    }
    return CapabilityDriftDetector.instance;
  }

  /**
   * Audits a set of Frontend capability claims against authoritative Backend truth.
   * Identifies all instances of Capability Drift.
   */
  public auditClaims(claims: FrontendCapabilityClaim[]): CapabilityDriftReport {
    const timestamp = new Date().toISOString();
    const violations: CapabilityDriftViolation[] = [];
    const auditedCapabilities: CapabilityDriftReport['auditedCapabilities'] = [];

    claims.forEach(claim => {
      const resolution = this.resolver.resolveCapability(claim.capabilityId);
      let inDrift = false;

      // Drift Condition 1: Frontend claims tool is enabled or supported, but Backend says NOT claimable
      if (claim.claimedEnabled && !resolution.isClaimable) {
        inDrift = true;
        const violation: CapabilityDriftViolation = {
          violationId: `DRIFT-VIOLATION-${createHash('sha256').update(`${claim.capabilityId}:${timestamp}`).digest('hex').substring(0, 8)}`,
          capabilityId: claim.capabilityId,
          claimedBy: claim.claimedBy,
          claimedStatus: claim.claimedStatus || 'ENABLED',
          actualBackendTruth: resolution.truthState,
          severity: resolution.truthState === 'NOT_SUPPORTED' ? 'CRITICAL' : 'HIGH',
          message: `Frontend component '${claim.claimedBy}' claims capability '${claim.capabilityId}' as enabled/supported, but Backend truth state is '${resolution.truthState}' (${resolution.explanation}).`,
          timestamp
        };
        violations.push(violation);
        this.registeredViolations.push(violation);
      }

      // Drift Condition 2: Frontend claims a status like "PROVEN" or "SUPPORTED" when Backend says BYPASS or MISSING
      if (
        claim.claimedStatus &&
        ['SUPPORTED', 'PROVEN', 'PRODUCTION_PROVEN', 'VERIFIED'].includes(claim.claimedStatus) &&
        !resolution.isVerified
      ) {
        inDrift = true;
        const violation: CapabilityDriftViolation = {
          violationId: `DRIFT-VIOLATION-${createHash('sha256').update(`${claim.capabilityId}:${claim.claimedStatus}:${timestamp}`).digest('hex').substring(0, 8)}`,
          capabilityId: claim.capabilityId,
          claimedBy: claim.claimedBy,
          claimedStatus: claim.claimedStatus,
          actualBackendTruth: resolution.truthState,
          severity: 'HIGH',
          message: `Frontend component '${claim.claimedBy}' claims verification status '${claim.claimedStatus}' for '${claim.capabilityId}', but Backend resolution has no verification proof.`,
          timestamp
        };
        violations.push(violation);
        this.registeredViolations.push(violation);
      }

      auditedCapabilities.push({
        capabilityId: claim.capabilityId,
        claimed: claim.claimedEnabled || claim.claimedExposed,
        supported: resolution.isClaimable,
        truthState: resolution.truthState,
        inDrift
      });
    });

    return {
      timestamp,
      totalAudited: claims.length,
      driftCount: violations.length,
      hasDrift: violations.length > 0,
      violations,
      auditedCapabilities
    };
  }

  /**
   * Pre-flight action intent verifier.
   * Prevents UI components from dispatching canonical actions for unsupported or unverified capabilities.
   */
  public verifyActionIntent(
    capabilityId: string,
    claimedBy: string
  ): { allowed: boolean; violation?: CapabilityDriftViolation; resolution: CapabilityResolution } {
    const resolution = this.resolver.resolveCapability(capabilityId);

    if (!resolution.isClaimable) {
      const violation: CapabilityDriftViolation = {
        violationId: `DRIFT-PREVENT-${Date.now()}`,
        capabilityId,
        claimedBy,
        claimedStatus: 'TRIGGERED_ACTION',
        actualBackendTruth: resolution.truthState,
        severity: 'CRITICAL',
        message: `Execution blocked: Frontend '${claimedBy}' attempted to invoke capability '${capabilityId}' which is not claimable in Backend (${resolution.truthState}: ${resolution.explanation}).`,
        timestamp: new Date().toISOString()
      };
      this.registeredViolations.push(violation);
      return {
        allowed: false,
        violation,
        resolution
      };
    }

    return {
      allowed: true,
      resolution
    };
  }

  public getRegisteredViolations(): CapabilityDriftViolation[] {
    return [...this.registeredViolations];
  }

  public clearViolations(): void {
    this.registeredViolations = [];
  }

  public reset(): void {
    this.clearViolations();
  }
}
