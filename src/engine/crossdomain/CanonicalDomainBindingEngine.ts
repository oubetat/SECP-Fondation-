/**
 * SECP Engineering OS — Canonical Domain Binding Engine
 * 
 * Responsible for factory creation, key-isolated sealing, and validation of domain bindings.
 * Enforces the "Zero Unauthorized Execution" policy and cryptographic seal authenticity.
 */

import { createHash } from 'crypto';
import { 
  CanonicalDomainBinding, 
  EngineeringDomain, 
  SimulationAuthorityInternal,
  BindingValidationResult
} from './CanonicalDomainBinding';
import { 
  computeHMACSealToken, 
  verifyHMACSealToken,
  getAuthorityInitializationState
} from '../simulation/SimulationAuthorityInternal';
import { SealingCapability } from '../simulation/SimulationSealingAuthorization';

export class CanonicalDomainBindingEngine {
  /**
   * Computes deterministic 64-character SHA-256 binding ID.
   */
  public static computeBindingId(
    domain: string,
    canonicalEntityId: string,
    revisionId: string | number,
    geometryHash: string,
    topologyHash: string,
    materialHash: string,
    environmentHash: string,
    physicsHash: string
  ): string {
    const payload = `${domain}:${canonicalEntityId}:${revisionId}:${geometryHash}:${topologyHash}:${materialHash}:${environmentHash}:${physicsHash}`;
    return createHash('sha256').update(payload, 'utf8').digest('hex');
  }

  /**
   * Generates a cryptographic HMAC seal token for authoritative simulation execution.
   * REQUIRES: Valid SealingCapability.
   */
  public static generateSealToken(
    capability: SealingCapability,
    domain: string,
    canonicalEntityId: string,
    revisionId: string | number,
    geometryHash: string,
    keyVersion?: string
  ): { sealToken: string; keyVersion: string } {
    return computeHMACSealToken(capability, domain, canonicalEntityId, revisionId, geometryHash, keyVersion);
  }

  /**
   * Creates a new domain binding.
   * By default, isAuthoritative is false until explicitly sealed by sealBinding within the authority boundary.
   */
  public static createBinding(
    domain: EngineeringDomain,
    canonicalEntityId: string,
    revisionId: string | number,
    payload: any,
    geometryHash: string,
    topologyHash: string,
    materialHash: string,
    environmentHash: string,
    physicsHash: string
  ): CanonicalDomainBinding {
    const bindingId = this.computeBindingId(
      domain,
      canonicalEntityId,
      revisionId,
      geometryHash,
      topologyHash,
      materialHash,
      environmentHash,
      physicsHash
    );

    const authority: SimulationAuthorityInternal = {
      isAuthoritative: false,
      executionSealToken: '',
      timestamp: new Date().toISOString(),
      originatingCoreRevision: revisionId
    };

    return {
      bindingId,
      domain,
      domainId: domain,
      canonicalEntityId,
      designId: canonicalEntityId,
      revisionId,
      payload,
      geometryHash,
      topologyHash,
      materialHash,
      environmentHash,
      physicsHash,
      manifestHash: materialHash,
      evidenceRoot: environmentHash,
      provenanceChain: physicsHash,
      executionAuthority: authority,
      status: 'CURRENT'
    };
  }

  /**
   * Authoritatively seals a domain binding within the trusted authority boundary.
   * REQUIRES: Valid SealingCapability presented by authorized module.
   */
  public static sealBinding<T extends CanonicalDomainBinding>(
    binding: T,
    capability: SealingCapability,
    originatingCoreRevision: string | number = 'REV-01'
  ): T {
    const initState = getAuthorityInitializationState();
    if (initState === 'INITIALIZATION_FAILED') {
      throw new Error('SIMULATION_AUTHORITY_INITIALIZATION_FAILED: Authority boot previously failed.');
    }
    if (initState !== 'INITIALIZED') {
      throw new Error('SIMULATION_AUTHORITY_NOT_INITIALIZED: Cannot seal domain binding before secure authority handshake completion.');
    }

    const domain = binding.domain || binding.domainId;
    const entityId = binding.canonicalEntityId || binding.designId;

    if (!domain || !entityId || !binding.geometryHash) {
      throw new Error('SIMULATION_AUTHORITY_VIOLATION: Missing required domain binding metadata for sealing.');
    }

    const { sealToken, keyVersion } = computeHMACSealToken(
      capability,
      domain as string,
      entityId,
      binding.revisionId,
      binding.geometryHash
    );

    binding.executionAuthority = {
      isAuthoritative: true,
      executionSealToken: sealToken,
      keyVersion,
      executionContext: capability.authorizedContext,
      timestamp: new Date().toISOString(),
      originatingCoreRevision: binding.revisionId || originatingCoreRevision
    };

    return binding;
  }

  /**
   * Validates if a binding is authoritative and matches current authority state.
   */
  public static validateBinding(binding: CanonicalDomainBinding): BindingValidationResult {
    const errors: string[] = [];

    if (!binding) {
      return { valid: false, errors: ['Binding is null or undefined'] };
    }

    const entityId = binding.canonicalEntityId || binding.designId;
    const domain = binding.domain || binding.domainId;

    const expectedBindingId = this.computeBindingId(
      domain,
      entityId,
      binding.revisionId,
      binding.geometryHash,
      binding.topologyHash,
      binding.materialHash,
      binding.environmentHash,
      binding.physicsHash
    );

    if (binding.bindingId !== expectedBindingId) {
      errors.push(`Binding ID mismatch: expected ${expectedBindingId}, got ${binding.bindingId}`);
    }

    if (!binding.executionAuthority || !binding.executionAuthority.isAuthoritative) {
      errors.push('Binding is not marked as authoritative');
    } else {
      const auth = binding.executionAuthority;
      const isValid = verifyHMACSealToken(
        auth.executionSealToken,
        domain,
        entityId,
        binding.revisionId,
        binding.geometryHash,
        auth.executionContext || 'CORE_EXECUTION',
        auth.keyVersion
      );

      if (!isValid) {
        errors.push('INVALID_SEAL_TOKEN: Seal signature mismatch, invalid key version, or unauthenticated token issuance.');
      }
    }

    if (binding.status === 'STALE') {
      errors.push('Binding status is STALE');
    } else if (binding.status === 'INVALID') {
      errors.push('Binding status is INVALID');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Verifies that a mesh's provenance metadata matches the canonical geometry and revision hashes of a domain binding.
   */
  public static verifyMeshProvenanceBinding(mesh: any, binding: CanonicalDomainBinding): BindingValidationResult {
    const errors: string[] = [];
    if (!mesh) {
      return { valid: false, errors: ['Mesh payload is null or undefined'] };
    }
    const prov = mesh.provenance || mesh.meshProvenance;
    if (!prov) {
      return { valid: false, errors: ['MISSING_MESH_PROVENANCE: Mesh payload does not carry explicit provenance metadata'] };
    }
    if (binding.geometryHash && prov.sourceGeometryHash && prov.sourceGeometryHash !== binding.geometryHash) {
      errors.push(`PROVENANCE_GEOMETRY_MISMATCH: Mesh source geometry hash (${prov.sourceGeometryHash}) does not match binding geometry hash (${binding.geometryHash})`);
    }
    if (binding.geometryHash && prov.bRepHash && prov.bRepHash !== binding.geometryHash) {
      errors.push(`PROVENANCE_BREP_MISMATCH: Mesh BRep hash (${prov.bRepHash}) does not match binding geometry hash (${binding.geometryHash})`);
    }
    if (binding.revisionId !== undefined && prov.sourceRevisionHash !== undefined && String(prov.sourceRevisionHash) !== String(binding.revisionId)) {
      errors.push(`PROVENANCE_REVISION_MISMATCH: Mesh source revision (${prov.sourceRevisionHash}) does not match binding revision (${binding.revisionId})`);
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

