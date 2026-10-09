/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-010: Engineering Hash Chain Errors
 */

export class EngineeringHashChainError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'ENGINEERING_HASH_CHAIN_ERROR') {
    super(`[EngineeringHashChain] ${message}`);
    this.name = 'EngineeringHashChainError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MissingArtifactIdentityError extends EngineeringHashChainError {
  constructor(message: string = 'Unable to resolve canonical identity for artifact') {
    super(message, 'MISSING_ARTIFACT_IDENTITY');
    this.name = 'MissingArtifactIdentityError';
  }
}

export class InvalidChainStageError extends EngineeringHashChainError {
  constructor(stage: string) {
    super(`Invalid engineering chain stage: ${stage}`, 'INVALID_CHAIN_STAGE');
    this.name = 'InvalidChainStageError';
  }
}

export class BrokenChainLinkageError extends EngineeringHashChainError {
  constructor(message: string) {
    super(message, 'BROKEN_CHAIN_LINKAGE');
    this.name = 'BrokenChainLinkageError';
  }
}

export class ChainTamperingError extends EngineeringHashChainError {
  constructor(message: string) {
    super(message, 'CHAIN_TAMPERING_DETECTED');
    this.name = 'ChainTamperingError';
  }
}

export class UnsupportedHashAlgorithmError extends EngineeringHashChainError {
  constructor(algorithm: string) {
    super(`Unsupported hash algorithm: ${algorithm}. Only SHA-256 is supported.`, 'UNSUPPORTED_HASH_ALGORITHM');
    this.name = 'UnsupportedHashAlgorithmError';
  }
}

export class UnsupportedCanonicalizationVersionError extends EngineeringHashChainError {
  constructor(version: string) {
    super(`Unsupported canonicalization version: ${version}.`, 'UNSUPPORTED_CANONICALIZATION_VERSION');
    this.name = 'UnsupportedCanonicalizationVersionError';
  }
}
