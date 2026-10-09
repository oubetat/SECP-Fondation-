/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-070: CFD Verification Framework Types & Interfaces
 */

export interface EquationSetIdentity {
  readonly equationHash: string;
  readonly canonicalRepresentation: string;
  readonly variables: readonly string[];
}

export interface DiscretizationIdentity {
  readonly discretizationHash: string;
  readonly spatialOrder: number;
  readonly temporalOrder: number;
}

export interface VerificationClaim {
  readonly claimId: string;
  readonly statement: string;
  readonly scope: string;
  readonly status: string;
}

export interface VerificationStudy {
  readonly studyId: string;
  readonly caseId: string;
  readonly referenceSolution: string;
  readonly verdict: string;
}
