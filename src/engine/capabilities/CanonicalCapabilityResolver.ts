/**
 * SECP Industrial OS v3 — PROMPT-053: Canonical Capability Resolver
 * Central, authoritative resolution engine querying actual backend component state,
 * tool contract registries, and kernel truth gates.
 *
 * ARCHITECTURAL CONTRACT:
 * - Backend is the absolute source of truth.
 * - Frontend NEVER claims a capability that backend does not support or verify.
 * - Differentiates capability backend existence from contextual runtime applicability.
 */

import { CapabilityTruthGate, CapabilityTruthState } from '../cad-kernel/registry/CapabilityTruthGate';
import { DesignToolContractRegistry } from '../cad-kernel/registry/DesignToolContractRegistry';
import { CapabilityRegistry } from './CapabilityRegistry';
import { CapabilityStatus, EngineeringCapability } from './CapabilityTypes';
import {
  CapabilityResolution,
  ContextualApplicability,
  WorkplaceContext,
  CapabilityMirrorProjection,
  CapabilityFidelityLevel
} from './CapabilityMirrorTypes';

export class CanonicalCapabilityResolver {
  private static instance: CanonicalCapabilityResolver;
  private domainRegistry: CapabilityRegistry;

  private constructor() {
    this.domainRegistry = CapabilityRegistry.getInstance();
  }

  public static getInstance(): CanonicalCapabilityResolver {
    if (!CanonicalCapabilityResolver.instance) {
      CanonicalCapabilityResolver.instance = new CanonicalCapabilityResolver();
    }
    return CanonicalCapabilityResolver.instance;
  }

  /**
   * Resolves the authoritative backend engineering truth for any given capability or tool ID.
   */
  public resolveCapability(capabilityId: string): CapabilityResolution {
    const timestamp = new Date().toISOString();

    // 1. Check Tool Contract Registry first for CAD/Tool specific capabilities
    const contract = DesignToolContractRegistry.get(capabilityId);
    if (contract) {
      const gate = CapabilityTruthGate.resolve(capabilityId);

      let backendStatus = CapabilityStatus.UNSUPPORTED;
      let fidelity: CapabilityFidelityLevel = 'UNSUPPORTED';
      let isClaimable = false;

      switch (gate.truthState) {
        case 'VERIFIED':
          backendStatus = CapabilityStatus.VERIFIED;
          fidelity = 'VERIFIED';
          isClaimable = true;
          break;
        case 'CONNECTED':
          backendStatus = CapabilityStatus.SUPPORTED;
          fidelity = 'CANONICAL';
          isClaimable = true;
          break;
        case 'IMPLEMENTED':
          backendStatus = CapabilityStatus.PARTIALLY_SUPPORTED;
          fidelity = 'PARTIAL';
          isClaimable = false; // Implemented but not connected to canonical UI path
          break;
        case 'AVAILABLE':
          backendStatus = CapabilityStatus.PARTIALLY_SUPPORTED;
          fidelity = 'PARTIAL';
          isClaimable = false;
          break;
        case 'UNAVAILABLE':
          backendStatus = CapabilityStatus.UNSUPPORTED;
          fidelity = 'BYPASS';
          isClaimable = false;
          break;
        case 'NOT_SUPPORTED':
        default:
          backendStatus = CapabilityStatus.UNSUPPORTED;
          fidelity = 'UNSUPPORTED';
          isClaimable = false;
          break;
      }

      return {
        capabilityId,
        name: contract.featureType || capabilityId,
        domain: contract.workbench || 'CAD',
        backendStatus,
        truthState: gate.truthState,
        fidelity,
        isClaimable,
        isImplemented: gate.hasBackend,
        isConnected: gate.hasCanonicalConnection,
        isVerified: gate.hasVerificationEvidence,
        supportedScope: contract.inputs.map(i => i.name),
        unsupportedScope: contract.canonicalAction.status === 'BYPASS' ? ['Canonical evaluation bypassed'] : [],
        limitations: gate.truthState !== 'VERIFIED' ? [gate.explanation] : [],
        evidenceRef: contract.validation.testFile,
        explanation: gate.explanation,
        lastEvaluatedAt: timestamp
      };
    }

    // 2. Check Domain Capability Registry for system capabilities (e.g. CAD-BREP-CORE, CFD-INC-FLOW)
    const domainCaps = Array.from(
      (this.domainRegistry as any).capabilities.values()
    ) as EngineeringCapability[];
    
    const domainCap = domainCaps.find(c => c.id === capabilityId);
    if (domainCap) {
      const isClaimable = domainCap.isVerified && domainCap.status !== CapabilityStatus.UNSUPPORTED;
      let truthState: CapabilityTruthState = 'UNAVAILABLE';
      let fidelity: CapabilityFidelityLevel = 'UNSUPPORTED';

      if (domainCap.status === CapabilityStatus.VERIFIED || domainCap.status === CapabilityStatus.VALIDATED) {
        truthState = 'VERIFIED';
        fidelity = 'VERIFIED';
      } else if (domainCap.status === CapabilityStatus.SUPPORTED || domainCap.status === CapabilityStatus.PARTIALLY_SUPPORTED) {
        truthState = 'CONNECTED';
        fidelity = 'CANONICAL';
      } else {
        truthState = 'NOT_SUPPORTED';
        fidelity = 'UNSUPPORTED';
      }

      return {
        capabilityId,
        name: domainCap.name,
        domain: domainCap.domain,
        backendStatus: domainCap.status,
        truthState,
        fidelity,
        isClaimable,
        isImplemented: true,
        isConnected: true,
        isVerified: domainCap.isVerified,
        supportedScope: domainCap.supportedScope,
        unsupportedScope: domainCap.unsupportedScope,
        limitations: domainCap.knownLimitations,
        evidenceRef: domainCap.evidenceReferences[0],
        explanation: domainCap.description,
        lastEvaluatedAt: timestamp
      };
    }

    // 3. Unknown or unmapped capability ID -> Safe Default (UNSUPPORTED)
    return {
      capabilityId,
      name: capabilityId,
      domain: 'UNKNOWN',
      backendStatus: CapabilityStatus.UNSUPPORTED,
      truthState: 'NOT_SUPPORTED',
      fidelity: 'UNSUPPORTED',
      isClaimable: false,
      isImplemented: false,
      isConnected: false,
      isVerified: false,
      supportedScope: [],
      unsupportedScope: ['Capability not declared in backend contract registry'],
      limitations: ['Unknown capability requested'],
      explanation: 'Capability is not supported or defined in backend registry.',
      lastEvaluatedAt: timestamp
    };
  }

  /**
   * Evaluates contextual applicability of a capability for the active UI context.
   * Differentiates "Is this capability supported by backend?" from "Is it valid to click right now?".
   */
  public evaluateContextualApplicability(
    capabilityId: string,
    context?: WorkplaceContext
  ): ContextualApplicability {
    if (!context) {
      return {
        capabilityId,
        isApplicable: true,
        requiredContextKeys: []
      };
    }

    // Example contextual rules for specific CAD tools:
    if (capabilityId === 'SKETCH_LINE' || capabilityId === 'SKETCH_CIRCLE') {
      if (context.activeWorkbench && context.activeWorkbench !== 'Sketch') {
        return {
          capabilityId,
          isApplicable: false,
          inapplicabilityReason: 'Requires active 2D Sketch workbench session',
          requiredContextKeys: ['activeWorkbench=Sketch']
        };
      }
    }

    if (capabilityId === 'FEATURE_EXTRUDE') {
      if (!context.hasActiveSketchProfile) {
        return {
          capabilityId,
          isApplicable: false,
          inapplicabilityReason: 'Requires a valid closed 2D sketch profile',
          requiredContextKeys: ['hasActiveSketchProfile']
        };
      }
    }

    if (capabilityId === 'ASSEMBLY_MATE_COINCIDENT') {
      if (context.selectedEntityCount !== undefined && context.selectedEntityCount < 2) {
        return {
          capabilityId,
          isApplicable: false,
          inapplicabilityReason: 'Requires selecting at least 2 part geometric entities',
          requiredContextKeys: ['selectedEntityCount>=2']
        };
      }
    }

    if (capabilityId === 'FEATURE_FILLET') {
      if (!context.selectedEntityTypes?.includes('EDGE') && !context.has3DSolidBody) {
        return {
          capabilityId,
          isApplicable: false,
          inapplicabilityReason: 'Requires selecting a 3D solid edge',
          requiredContextKeys: ['selectedEntityTypes=EDGE']
        };
      }
    }

    return {
      capabilityId,
      isApplicable: true,
      requiredContextKeys: []
    };
  }

  /**
   * Generates a read-only Capability Mirror Projection for UI rendering.
   */
  public projectMirror(
    capabilityId: string,
    context?: WorkplaceContext
  ): CapabilityMirrorProjection {
    const resolution = this.resolveCapability(capabilityId);
    const applicability = this.evaluateContextualApplicability(capabilityId, context);

    // UI exposed if backend has implementation or contract defined
    const uiExposed = resolution.truthState !== 'NOT_SUPPORTED';

    // UI enabled ONLY if backend supports/claims it AND context is currently applicable
    const uiEnabled = resolution.isClaimable && applicability.isApplicable;

    let badgeStatus: 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED' | 'UNAVAILABLE' | 'EXPERIMENTAL' = 'UNSUPPORTED';
    if (resolution.truthState === 'VERIFIED') badgeStatus = 'SUPPORTED';
    else if (resolution.truthState === 'CONNECTED') badgeStatus = 'SUPPORTED';
    else if (resolution.truthState === 'IMPLEMENTED' || resolution.truthState === 'AVAILABLE') badgeStatus = 'PARTIAL';
    else if (resolution.truthState === 'UNAVAILABLE') badgeStatus = 'UNAVAILABLE';

    let disabledReason: string | undefined = undefined;
    if (!resolution.isClaimable) {
      disabledReason = `Backend capability state: ${resolution.truthState} (${resolution.explanation})`;
    } else if (!applicability.isApplicable) {
      disabledReason = applicability.inapplicabilityReason;
    }

    return {
      capabilityId,
      name: resolution.name,
      domain: resolution.domain,
      uiExposed,
      uiEnabled,
      badgeStatus,
      truthState: resolution.truthState,
      contextApplicable: applicability.isApplicable,
      disabledReason,
      backendExplanation: resolution.explanation,
      evidenceRef: resolution.evidenceRef,
      fidelity: resolution.fidelity
    };
  }

  public reset(): void {
    this.domainRegistry.reset();
  }
}
