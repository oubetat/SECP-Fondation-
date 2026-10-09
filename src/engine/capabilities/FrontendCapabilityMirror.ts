/**
 * SECP Industrial OS v3 — PROMPT-053: Frontend Capability Mirror Store
 * Read-only mirror projection layer for all UI controls (toolbars, menus, action panels).
 * Ensures the Frontend strictly mirrors Backend capability truth with ZERO capability drift.
 */

import { CanonicalCapabilityResolver } from './CanonicalCapabilityResolver';
import { CapabilityDriftDetector, FrontendCapabilityClaim } from './CapabilityDriftDetector';
import {
  CapabilityMirrorProjection,
  WorkplaceContext,
  CapabilityDriftReport
} from './CapabilityMirrorTypes';

export class FrontendCapabilityMirror {
  private static instance: FrontendCapabilityMirror;
  private resolver: CanonicalCapabilityResolver;
  private driftDetector: CapabilityDriftDetector;
  private registeredClaims: Map<string, FrontendCapabilityClaim> = new Map();
  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.resolver = CanonicalCapabilityResolver.getInstance();
    this.driftDetector = CapabilityDriftDetector.getInstance();
  }

  public static getInstance(): FrontendCapabilityMirror {
    if (!FrontendCapabilityMirror.instance) {
      FrontendCapabilityMirror.instance = new FrontendCapabilityMirror();
    }
    return FrontendCapabilityMirror.instance;
  }

  /**
   * Registers a frontend claim for a capability (e.g. from a UI toolbar or feature panel).
   * Automatically triggers drift evaluation.
   */
  public registerClaim(claim: FrontendCapabilityClaim): CapabilityMirrorProjection {
    this.registeredClaims.set(claim.capabilityId, claim);
    this.notifyListeners();
    return this.resolver.projectMirror(claim.capabilityId);
  }

  /**
   * Projects the mirror state for a specific tool/capability ID given the active workspace context.
   */
  public projectTool(capabilityId: string, context?: WorkplaceContext): CapabilityMirrorProjection {
    return this.resolver.projectMirror(capabilityId, context);
  }

  /**
   * Projects mirror states for all registered tools or capability IDs in a domain.
   */
  public projectDomain(domain: string, context?: WorkplaceContext): CapabilityMirrorProjection[] {
    const knownTools = [
      'SKETCH_LINE',
      'SKETCH_CIRCLE',
      'FEATURE_EXTRUDE',
      'ASSEMBLY_MATE_COINCIDENT',
      'FEATURE_FILLET',
      'MOLD_TOOLING_SPLIT'
    ];

    return knownTools
      .map(id => this.resolver.projectMirror(id, context))
      .filter(proj => proj.domain.toUpperCase() === domain.toUpperCase() || domain === 'ALL');
  }

  /**
   * Runs a complete audit of all registered frontend claims against backend truth.
   */
  public auditDrift(): CapabilityDriftReport {
    const claims = Array.from(this.registeredClaims.values());
    return this.driftDetector.auditClaims(claims);
  }

  /**
   * Pre-flight action verifier for UI action handlers.
   */
  public verifyAction(capabilityId: string, componentName: string): boolean {
    const check = this.driftDetector.verifyActionIntent(capabilityId, componentName);
    return check.allowed;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(fn => fn());
  }

  public clearClaims(): void {
    this.registeredClaims.clear();
    this.notifyListeners();
  }

  public reset(): void {
    this.clearClaims();
    this.resolver.reset();
    this.driftDetector.reset();
  }
}
