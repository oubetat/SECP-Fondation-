export enum MassFormulation {
  CONSISTENT = 'CONSISTENT',
  LUMPED = 'LUMPED'
}

export enum ModeClassification {
  RIGID_BODY = 'RIGID_BODY',
  POSITIVE = 'POSITIVE',
  NEAR_ZERO = 'NEAR_ZERO',
  NEGATIVE = 'NEGATIVE',
  INVALID = 'INVALID'
}

export enum NormalizationPolicy {
  MAX_COMPONENT = 'MAX_COMPONENT',
  EUCLIDEAN = 'EUCLIDEAN',
  MASS_NORMALIZED = 'MASS_NORMALIZED'
}

export interface EigenPair {
  modeId: number;
  eigenvalue: number;
  angularFrequency: number; // rad/s
  frequencyHz: number;      // Hz
  eigenvector: number[];
  normalization: NormalizationPolicy;
  residual: number;
  rayleighQuotient: number;
  classification: ModeClassification;
}

export enum ModalVerdict {
  CONVERGED = 'CONVERGED',
  NOT_CONVERGED = 'NOT_CONVERGED',
  VERIFIED = 'VERIFIED',
  RIGID_BODY_ONLY = 'RIGID_BODY_ONLY',
  NEGATIVE_EIGENVALUE = 'NEGATIVE_EIGENVALUE',
  INVALID_EIGENPAIR = 'INVALID_EIGENPAIR',
  EIGENSOLVER_FAILURE = 'EIGENSOLVER_FAILURE',
  NUMERICAL_FAILURE = 'NUMERICAL_FAILURE'
}
