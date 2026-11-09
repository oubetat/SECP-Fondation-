/**
 * SECP Engineering OS — Independent Persistent Evidence Verifier
 * SECP-CAD-TRUTH-PATCH-003
 * 
 * Reconstructs, verifies, and qualifies full engineering evidence chains 
 * strictly from persistent/deserialized storage records (JSON), completely
 * isolated from live in-memory singletons or solver instances.
 */

import { createHash } from 'crypto';
import { verifyHMACSealToken } from '../simulation/SimulationAuthorityInternal';
import { AttestationCanonicalizer } from '../attestation/AttestationCanonicalizer';

export type VerificationOutcomeStatus =
  | 'PROVENANCE_VERIFIED'
  | 'PROVENANCE_REJECTED'
  | 'PROVENANCE_INCOMPLETE'
  | 'NUMERICAL_QUALIFICATION_PENDING'
  | 'NUMERICAL_QUALIFIED';

export interface PersistentCanonicalRevision {
  revisionHash: string;
  entityName?: string;
  timestamp?: string;
  author?: string;
}

export interface PersistentBRepGeometry {
  geometryHash: string;
  topologyType?: string;
  surfaceArea?: number;
  volume?: number;
  faceCount?: number;
  edgeCount?: number;
  topologyFaceIds?: string[];
  topologyEdgeIds?: string[];
}

export interface PersistentMeshProvenance {
  meshHash: string;
  sourceGeometryHash: string;
  sourceRevisionHash: string;
  elementCount: number;
  nodeCount: number;
  timestamp?: string;
  provenanceDigest?: string;
}

export interface PersistentExecutionAuthority {
  isAuthoritative: boolean;
  executionSealToken: string;
  timestamp: string;
  originatingCoreRevision: string;
  keyVersion?: string;
  executionContext?: string;
  domain?: string;
  canonicalEntityId?: string;
}

export interface PersistentExecutionRecord {
  executionId: string;
  domain: string;
  bindingId: string;
  cadRevisionHash: string;
  canonicalGeometryHash: string;
  inputHash: string;
  resultHash: string;
  timestamp: string;
  configDigest?: string;
  solverConfiguration?: Record<string, any>;
}

export interface PersistentCFDResult {
  executionId?: string;
  status?: string;
  converged?: boolean;
  terminationReason?: string;
  iterations?: number;
  residuals?: Record<string, number>;
  solutionHash?: string;
  forceStabilityPassed?: boolean;
  provenanceIntegrity?: {
    valid: boolean;
    cadRevisionHash?: string;
    canonicalGeometryHash?: string;
    meshHash?: string;
  };
  numericalQualification?: {
    converged: boolean;
    terminationReason: string;
    iterations: number;
    forceStabilityPassed?: boolean;
  };
}

export interface PersistentDerivedEvidence {
  artifactDigest: string;
  artifactKind: string;
  cadRevisionHash: string;
  canonicalGeometryHash: string;
  sourceExecutionId?: string;
}

export interface PersistentEvidenceChain {
  canonicalRevision?: PersistentCanonicalRevision;
  bRepGeometry?: PersistentBRepGeometry;
  meshProvenance?: PersistentMeshProvenance;
  executionAuthority?: PersistentExecutionAuthority;
  executionRecord?: PersistentExecutionRecord;
  cfdResult?: PersistentCFDResult;
  derivedEvidence?: PersistentDerivedEvidence;
  contentDigest?: string;
}

export interface ReconstructionDetails {
  canonicalRevisionVerified: boolean;
  geometryHashVerified: boolean;
  meshProvenanceVerified: boolean;
  authorityVerified: boolean;
  executionRecordVerified: boolean;
  contentDigestVerified: boolean;
  numericalQualificationStatus: string;
  missingLinks: string[];
  integrityViolations: string[];
}

export interface VerificationResult {
  outcome: VerificationOutcomeStatus;
  isValid: boolean;
  provenanceValid: boolean;
  numericalQualified: boolean;
  reconstructedChainDigest: string;
  reconstructionErrors: string[];
  details: ReconstructionDetails;
}

export class IndependentPersistentEvidenceVerifier {
  /**
   * Helper SHA-256 calculation
   */
  public static sha256(payload: string): string {
    return createHash('sha256').update(payload, 'utf8').digest('hex');
  }

  /**
   * Computes deterministic hash digest for a complete evidence chain
   */
  public static computeChainDigest(chain: PersistentEvidenceChain): string {
    const canonicalObj = {
      canonicalRevisionHash: chain.canonicalRevision?.revisionHash || '',
      geometryHash: chain.bRepGeometry?.geometryHash || '',
      meshHash: chain.meshProvenance?.meshHash || '',
      executionId: chain.executionRecord?.executionId || '',
      bindingId: chain.executionRecord?.bindingId || '',
      executionSealToken: chain.executionAuthority?.executionSealToken || '',
      artifactDigest: chain.derivedEvidence?.artifactDigest || '',
      inputHash: chain.executionRecord?.inputHash || '',
      resultHash: chain.executionRecord?.resultHash || ''
    };
    return AttestationCanonicalizer.hashObject(canonicalObj);
  }

  /**
   * Exports an evidence chain object to formatted JSON
   */
  public static exportChainToJson(chain: PersistentEvidenceChain): string {
    return JSON.stringify(chain, null, 2);
  }

  /**
   * Primary entry point: Reconstructs and verifies an offline evidence chain from JSON string or deserialized object.
   */
  public static verifySerializedChain(input: string | object): VerificationResult {
    const errors: string[] = [];
    const missingLinks: string[] = [];
    const integrityViolations: string[] = [];

    let chain: PersistentEvidenceChain;

    // 1. Deserialization step
    if (typeof input === 'string') {
      try {
        chain = JSON.parse(input);
      } catch (err: any) {
        return {
          outcome: 'PROVENANCE_REJECTED',
          isValid: false,
          provenanceValid: false,
          numericalQualified: false,
          reconstructedChainDigest: '',
          reconstructionErrors: [`DESERIALIZATION_FAILED: ${err.message || 'Invalid JSON format'}`],
          details: {
            canonicalRevisionVerified: false,
            geometryHashVerified: false,
            meshProvenanceVerified: false,
            authorityVerified: false,
            executionRecordVerified: false,
            contentDigestVerified: false,
            numericalQualificationStatus: 'UNPROCESSED',
            missingLinks: ['PAYLOAD_DESERIALIZATION_FAILED'],
            integrityViolations: ['JSON_SYNTAX_ERROR']
          }
        };
      }
    } else if (typeof input === 'object' && input !== null) {
      chain = input as PersistentEvidenceChain;
    } else {
      return {
        outcome: 'PROVENANCE_REJECTED',
        isValid: false,
        provenanceValid: false,
        numericalQualified: false,
        reconstructedChainDigest: '',
        reconstructionErrors: ['INVALID_INPUT_TYPE: Input must be a valid JSON string or object'],
        details: {
          canonicalRevisionVerified: false,
          geometryHashVerified: false,
          meshProvenanceVerified: false,
          authorityVerified: false,
          executionRecordVerified: false,
          contentDigestVerified: false,
          numericalQualificationStatus: 'UNPROCESSED',
          missingLinks: ['NULL_OR_INVALID_INPUT'],
          integrityViolations: ['INVALID_INPUT_TYPE']
        }
      };
    }

    // 2. Check Completeness of mandatory chain links
    let revVerified = false;
    let geoVerified = false;
    let meshVerified = false;
    let authVerified = false;
    let execVerified = false;

    if (!chain.canonicalRevision || !chain.canonicalRevision.revisionHash) {
      missingLinks.push('canonicalRevision');
      errors.push('MISSING_CANONICAL_REVISION_LINK: Evidence chain lacks valid canonical CAD revision hash');
    } else {
      revVerified = true;
    }

    if (!chain.bRepGeometry || !chain.bRepGeometry.geometryHash) {
      missingLinks.push('bRepGeometry');
      errors.push('MISSING_BREP_GEOMETRY_LINK: Evidence chain lacks valid B-Rep geometry hash');
    } else {
      geoVerified = true;
    }

    if (!chain.meshProvenance || !chain.meshProvenance.meshHash) {
      missingLinks.push('meshProvenance');
      errors.push('MISSING_LINEAGE_LINK: Evidence chain lacks valid mesh provenance link');
    } else {
      meshVerified = true;
    }

    if (!chain.executionAuthority || !chain.executionAuthority.executionSealToken) {
      missingLinks.push('executionAuthority');
      errors.push('MISSING_EXECUTION_AUTHORITY_LINK: Evidence chain lacks valid execution authority seal token');
    } else {
      authVerified = true;
    }

    if (!chain.executionRecord || !chain.executionRecord.executionId) {
      missingLinks.push('executionRecord');
      errors.push('MISSING_EXECUTION_RECORD_LINK: Evidence chain lacks valid execution record link');
    } else {
      execVerified = true;
    }

    if (missingLinks.length > 0) {
      return {
        outcome: 'PROVENANCE_INCOMPLETE',
        isValid: false,
        provenanceValid: false,
        numericalQualified: false,
        reconstructedChainDigest: this.computeChainDigest(chain),
        reconstructionErrors: errors,
        details: {
          canonicalRevisionVerified: revVerified,
          geometryHashVerified: geoVerified,
          meshProvenanceVerified: meshVerified,
          authorityVerified: authVerified,
          executionRecordVerified: execVerified,
          contentDigestVerified: false,
          numericalQualificationStatus: 'INCOMPLETE_CHAIN',
          missingLinks,
          integrityViolations
        }
      };
    }

    // 3. Cryptographic and Provenance Tamper / Cross-Link Validation
    const rev = chain.canonicalRevision!;
    const geo = chain.bRepGeometry!;
    const mesh = chain.meshProvenance!;
    const auth = chain.executionAuthority!;
    const exec = chain.executionRecord!;

    // Check Topology Reference Completeness (T10)
    if (geo.faceCount !== undefined && geo.topologyFaceIds && geo.topologyFaceIds.length !== geo.faceCount) {
      integrityViolations.push('TOPOLOGY_REFERENCE_INCOMPLETE: Face count does not match topologyFaceIds array length');
      errors.push('TOPOLOGY_REFERENCE_INCOMPLETE: Incomplete topology face references detected');
    }

    // Check Mesh Provenance -> Geometry & Revision Cross-Links (T1, T2, T6)
    if (mesh.sourceGeometryHash !== geo.geometryHash) {
      integrityViolations.push('GEOMETRY_HASH_MISMATCH');
      errors.push(`GEOMETRY_HASH_MISMATCH: Mesh source geometry hash (${mesh.sourceGeometryHash}) does not match B-Rep geometry hash (${geo.geometryHash})`);
    }

    if (mesh.sourceRevisionHash !== rev.revisionHash) {
      integrityViolations.push('STALE_REVISION_DISCREPANCY');
      errors.push(`STALE_REVISION_DISCREPANCY: Mesh source revision (${mesh.sourceRevisionHash}) does not match canonical revision (${rev.revisionHash})`);
    }

    // Compute expected mesh hash if provenanceDigest or node/element counts are supplied
    const computedProvDigest = this.sha256(`${mesh.meshHash}:${mesh.sourceGeometryHash}:${mesh.sourceRevisionHash}`);
    if (mesh.provenanceDigest && mesh.provenanceDigest !== computedProvDigest) {
      integrityViolations.push('MESH_HASH_TAMPERED');
      errors.push(`MESH_HASH_TAMPERED: Mesh provenance digest (${mesh.provenanceDigest}) does not match computed value (${computedProvDigest})`);
    }

    // Check Execution Record -> Geometry & Revision Cross-Links (T2, T6)
    if (exec.cadRevisionHash !== rev.revisionHash) {
      integrityViolations.push('REVISION_ID_MISMATCH');
      errors.push(`REVISION_ID_MISMATCH: Execution record revision (${exec.cadRevisionHash}) does not match canonical revision (${rev.revisionHash})`);
    }

    if (exec.canonicalGeometryHash !== geo.geometryHash) {
      integrityViolations.push('GEOMETRY_HASH_MISMATCH');
      errors.push(`GEOMETRY_HASH_MISMATCH: Execution record geometry (${exec.canonicalGeometryHash}) does not match B-Rep geometry hash (${geo.geometryHash})`);
    }

    // Check Authority Seal Token Authenticity (T3)
    if (!auth.isAuthoritative) {
      integrityViolations.push('AUTHORITY_SEAL_INVALID');
      errors.push('AUTHORITY_SEAL_INVALID: Execution authority flag is set to false');
    } else {
      const domain = auth.domain || exec.domain || 'CFD';
      const entityId = auth.canonicalEntityId || exec.bindingId || 'CANONICAL_ENTITY';
      const context = auth.executionContext || 'CAD_CFD_TRUTH_BATTERY';
      const keyVersion = auth.keyVersion || 'v1';

      const isValidSeal = verifyHMACSealToken(
        auth.executionSealToken,
        domain,
        entityId,
        rev.revisionHash,
        geo.geometryHash,
        context,
        keyVersion
      );

      if (!isValidSeal) {
        integrityViolations.push('AUTHORITY_SEAL_INVALID');
        errors.push(`AUTHORITY_SEAL_INVALID: Seal token signature verification failed for token '${auth.executionSealToken}'`);
      }
    }

    // Check Input / Configuration Digest (T5)
    if (exec.configDigest && exec.solverConfiguration) {
      const recomputedConfigDigest = AttestationCanonicalizer.hashObject(exec.solverConfiguration);
      if (exec.configDigest !== recomputedConfigDigest) {
        integrityViolations.push('INPUT_DIGEST_MISMATCH');
        errors.push(`INPUT_DIGEST_MISMATCH: Stored config digest (${exec.configDigest}) does not match recomputed digest (${recomputedConfigDigest})`);
      }
    }

    // Check Content Digest / Solution Hash (T8)
    if (chain.contentDigest) {
      const recomputedChainDigest = this.computeChainDigest(chain);
      if (chain.contentDigest !== recomputedChainDigest) {
        integrityViolations.push('CONTENT_DIGEST_MUTATED');
        errors.push(`CONTENT_DIGEST_MUTATED: Chain content digest (${chain.contentDigest}) does not match recomputed digest (${recomputedChainDigest})`);
      }
    }

    // Derived Evidence Check (T3 / T7)
    if (chain.derivedEvidence) {
      if (chain.derivedEvidence.cadRevisionHash !== rev.revisionHash) {
        integrityViolations.push('STALE_REVISION_DISCREPANCY');
        errors.push(`STALE_REVISION_DISCREPANCY: Derived evidence CAD revision (${chain.derivedEvidence.cadRevisionHash}) mismatches canonical revision (${rev.revisionHash})`);
      }
      if (chain.derivedEvidence.canonicalGeometryHash !== geo.geometryHash) {
        integrityViolations.push('GEOMETRY_HASH_MISMATCH');
        errors.push(`GEOMETRY_HASH_MISMATCH: Derived evidence geometry (${chain.derivedEvidence.canonicalGeometryHash}) mismatches B-Rep geometry (${geo.geometryHash})`);
      }
    }

    // If any tamper or integrity violation occurred -> PROVENANCE_REJECTED
    if (integrityViolations.length > 0 || errors.length > 0) {
      return {
        outcome: 'PROVENANCE_REJECTED',
        isValid: false,
        provenanceValid: false,
        numericalQualified: false,
        reconstructedChainDigest: this.computeChainDigest(chain),
        reconstructionErrors: errors,
        details: {
          canonicalRevisionVerified: revVerified && !integrityViolations.includes('STALE_REVISION_DISCREPANCY'),
          geometryHashVerified: geoVerified && !integrityViolations.includes('GEOMETRY_HASH_MISMATCH'),
          meshProvenanceVerified: meshVerified && !integrityViolations.includes('MESH_HASH_TAMPERED'),
          authorityVerified: authVerified && !integrityViolations.includes('AUTHORITY_SEAL_INVALID'),
          executionRecordVerified: execVerified && !integrityViolations.includes('INPUT_DIGEST_MISMATCH'),
          contentDigestVerified: !integrityViolations.includes('CONTENT_DIGEST_MUTATED'),
          numericalQualificationStatus: 'REJECTED_BEFORE_NUMERICAL_CHECK',
          missingLinks,
          integrityViolations
        }
      };
    }

    // Provenance is 100% valid! Now evaluate Numerical Qualification Separation (C & Prompt Rules)
    const cfd = chain.cfdResult;
    let numericalStatus = 'PENDING';
    let isNumericalQualified = false;

    if (!cfd) {
      numericalStatus = 'NUMERICAL_QUALIFICATION_PENDING: No CFD result section present in chain';
    } else {
      // 1. Guard against NaN, non-numeric, or invalid types in numerical fields
      const topIter = cfd.iterations;
      const nestedIter = cfd.numericalQualification?.iterations;
      const invalidIter = (topIter !== undefined && (typeof topIter !== 'number' || Number.isNaN(topIter) || !Number.isFinite(topIter) || topIter <= 0)) ||
                          (nestedIter !== undefined && (typeof nestedIter !== 'number' || Number.isNaN(nestedIter) || !Number.isFinite(nestedIter) || nestedIter <= 0));

      let invalidResiduals = false;
      if (cfd.residuals && typeof cfd.residuals === 'object') {
        for (const val of Object.values(cfd.residuals)) {
          if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
            invalidResiduals = true;
            break;
          }
        }
      }

      // 2. Conflict detection between top-level and nested fields
      const topConv = cfd.converged;
      const nestedConv = cfd.numericalQualification?.converged;
      const topTerm = cfd.terminationReason;
      const nestedTerm = cfd.numericalQualification?.terminationReason;
      const topForce = cfd.forceStabilityPassed;
      const nestedForce = cfd.numericalQualification?.forceStabilityPassed;

      const hasConflict = 
        (topConv !== undefined && nestedConv !== undefined && topConv !== nestedConv) ||
        (topTerm !== undefined && nestedTerm !== undefined && topTerm !== nestedTerm) ||
        (topForce !== undefined && nestedForce !== undefined && topForce !== nestedForce) ||
        (topIter !== undefined && nestedIter !== undefined && topIter !== nestedIter);

      const isMaxIter = topTerm === 'MAX_ITERATIONS_REACHED' || nestedTerm === 'MAX_ITERATIONS_REACHED';
      const forceFailed = topForce === false || nestedForce === false;
      const notConverged = topConv === false || nestedConv === false;

      // Claimed converged but with contradictory signals
      const contradictoryClaim = (topConv === true || nestedConv === true) && (isMaxIter || forceFailed);

      if (invalidIter || invalidResiduals) {
        numericalStatus = 'NUMERICAL_QUALIFICATION_PENDING: Invalid, NaN, or non-numeric numerical fields detected';
        isNumericalQualified = false;
      } else if (hasConflict || contradictoryClaim) {
        numericalStatus = 'NUMERICAL_QUALIFICATION_PENDING: Conflicting or contradictory numerical qualification fields detected';
        isNumericalQualified = false;
      } else if (isMaxIter || forceFailed || notConverged) {
        numericalStatus = 'NUMERICAL_QUALIFICATION_PENDING: Solver reached MAX_ITERATIONS_REACHED or failed stability criteria';
        isNumericalQualified = false;
      } else if (topConv === true && (nestedConv === undefined || nestedConv === true)) {
        numericalStatus = 'NUMERICAL_QUALIFIED';
        isNumericalQualified = true;
      } else {
        numericalStatus = 'NUMERICAL_QUALIFICATION_PENDING: Required convergence fields incomplete or unverified';
        isNumericalQualified = false;
      }
    }

    const reconstructedChainDigest = this.computeChainDigest(chain);
    const finalOutcome: VerificationOutcomeStatus = isNumericalQualified 
      ? 'PROVENANCE_VERIFIED' 
      : 'NUMERICAL_QUALIFICATION_PENDING';

    return {
      outcome: finalOutcome,
      isValid: true,
      provenanceValid: true,
      numericalQualified: isNumericalQualified,
      reconstructedChainDigest,
      reconstructionErrors: [],
      details: {
        canonicalRevisionVerified: true,
        geometryHashVerified: true,
        meshProvenanceVerified: true,
        authorityVerified: true,
        executionRecordVerified: true,
        contentDigestVerified: true,
        numericalQualificationStatus: numericalStatus,
        missingLinks: [],
        integrityViolations: []
      }
    };
  }
}
