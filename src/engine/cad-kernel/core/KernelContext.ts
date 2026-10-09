/**
 * SECP CAD Kernel — Kernel Context
 */

export interface KernelVersion {
  major: number;
  minor: number;
  patch: number;
  build?: string;
}

export interface KernelContext {
  version: KernelVersion;
  identity: string;
  deterministic: boolean;
}
