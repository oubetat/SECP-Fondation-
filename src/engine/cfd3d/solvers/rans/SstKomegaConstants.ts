/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-064: SST k-omega Model Constants
 */

export interface SstConstants {
  readonly sigmaK1: number;
  readonly sigmaK2: number;
  readonly sigmaOmega1: number;
  readonly sigmaOmega2: number;
  readonly beta1: number;
  readonly beta2: number;
  readonly betaStar: number;
  readonly gamma1: number;
  readonly gamma2: number;
  readonly alpha1: number;
  readonly alpha2: number;
  readonly a1: number;
  readonly kappa: number;
  readonly constantsHash: string;
}

export const SstKomegaConstants: SstConstants = {
  sigmaK1: 0.85,
  sigmaK2: 1.00,
  sigmaOmega1: 0.50,
  sigmaOmega2: 0.856,
  beta1: 0.075,
  beta2: 0.0828,
  betaStar: 0.09,
  gamma1: 5.0 / 9.0,
  gamma2: 0.44,
  alpha1: 5.0 / 9.0,
  alpha2: 0.44,
  a1: 0.31,
  kappa: 0.41,
  constantsHash: 'sst-komega-constants-v1-hash'
};
