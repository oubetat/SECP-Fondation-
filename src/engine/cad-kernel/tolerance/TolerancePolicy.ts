/**
 * SECP CAD Kernel — Tolerance Policy
 * Phase 2 (PATCH-021)
 */

import { ToleranceOperation } from './ToleranceContext';

export interface TolerancePolicy {
  id: string;
  minTolerance: number;
  maxTolerance: number;
  defaultTolerance: number;
  scaleBehavior: 'LINEAR' | 'LOGARITHMIC' | 'CONSTANT';
  allowedOperations: ToleranceOperation[];
  escalationPermitted: boolean;
  escalationLimit: number; // multiplier for maxTolerance
}

export class PolicyRegistry {
  private static readonly POLICIES: Record<string, TolerancePolicy> = {
    'STRICT_INDUSTRIAL': {
      id: 'STRICT_INDUSTRIAL',
      minTolerance: 1e-12,
      maxTolerance: 1e-6,
      defaultTolerance: 1e-7,
      scaleBehavior: 'LINEAR',
      allowedOperations: Object.values(ToleranceOperation),
      escalationPermitted: true,
      escalationLimit: 100
    },
    'STANDARD_ENGINEERING': {
      id: 'STANDARD_ENGINEERING',
      minTolerance: 1e-9,
      maxTolerance: 1e-3,
      defaultTolerance: 1e-6,
      scaleBehavior: 'LINEAR',
      allowedOperations: Object.values(ToleranceOperation),
      escalationPermitted: true,
      escalationLimit: 10
    },
    'RELAXED_TESSELLATION': {
      id: 'RELAXED_TESSELLATION',
      minTolerance: 1e-6,
      maxTolerance: 1.0,
      defaultTolerance: 1e-4,
      scaleBehavior: 'LINEAR',
      allowedOperations: Object.values(ToleranceOperation),
      escalationPermitted: false,
      escalationLimit: 1
    }
  };

  public static getPolicy(id: string): TolerancePolicy {
    const policy = this.POLICIES[id];
    if (!policy) {
      throw new Error(`Unknown tolerance policy: ${id}`);
    }
    return policy;
  }

  public static getDefaultPolicy(): TolerancePolicy {
    return this.POLICIES['STRICT_INDUSTRIAL'];
  }
}
