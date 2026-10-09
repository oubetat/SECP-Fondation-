export type TurbulenceModelIdentity = 'KEPSILON_STANDARD' | 'KOMEGA_STANDARD' | 'KOMEGA_SST' | 'TRANSITION_GAMMA_RETHETA' | 'LES_SMAGORINSKY_LILLY';
export type TurbulenceModelFamily = 'RANS' | 'LES' | 'TRANSITION';
export interface TurbulenceModelCapabilities {
  supportsLES: boolean;
  supportsTransient: boolean;
  supportsCompressible: boolean;
}
