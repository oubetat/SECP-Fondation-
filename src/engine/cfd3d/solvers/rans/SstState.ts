/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-064: SST k-omega State Representation
 */

import { TurbulenceModelState, TurbulenceModelIdentity } from './TurbulenceModelContract';

export interface SstState extends TurbulenceModelState {
  readonly fields: {
    readonly k: readonly number[];
    readonly omega: readonly number[];
    readonly [key: string]: readonly number[];
  };
  readonly F1: readonly number[];
  readonly F2: readonly number[];
  readonly strainRate: readonly number[];
  readonly production: readonly number[];
  readonly destruction: readonly number[];
  readonly crossDiffusion: readonly number[];
  readonly wallDistance: readonly number[];
  readonly yPlus: readonly number[];
}
