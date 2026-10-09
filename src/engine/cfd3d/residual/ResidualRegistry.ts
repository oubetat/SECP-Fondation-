/**
 * SECP Industrial OS v2 — Residual Framework
 * PATCH-056: Residual Registry
 */

import { ResidualEquation } from './ResidualTypes';
import { EquationResidualPolicy, ResidualGlobalPolicy, DEFAULT_RESIDUAL_POLICY } from './ResidualPolicy';
import { ResidualHistory } from './ResidualHistory';

export class ResidualRegistry {
  private static instance: ResidualRegistry | null = null;
  private readonly policies: Map<ResidualEquation, EquationResidualPolicy> = new Map();
  private readonly history: ResidualHistory = new ResidualHistory();
  private globalPolicy: ResidualGlobalPolicy = DEFAULT_RESIDUAL_POLICY;

  private constructor() {
    // Initialize with default policies
    DEFAULT_RESIDUAL_POLICY.equations.forEach((p, eq) => {
      this.policies.set(eq, p);
    });
  }

  public static getInstance(): ResidualRegistry {
    if (!ResidualRegistry.instance) {
      ResidualRegistry.instance = new ResidualRegistry();
    }
    return ResidualRegistry.instance;
  }

  public getPolicy(equation: ResidualEquation): EquationResidualPolicy {
    const policy = this.policies.get(equation);
    if (!policy) {
      throw new Error(`No residual policy registered for equation: ${equation}`);
    }
    return policy;
  }

  public registerPolicy(policy: EquationResidualPolicy): void {
    this.policies.set(policy.equation, policy);
  }

  public getHistory(): ResidualHistory {
    return this.history;
  }

  public getGlobalPolicy(): ResidualGlobalPolicy {
    return this.globalPolicy;
  }

  public setGlobalPolicy(policy: ResidualGlobalPolicy): void {
    this.globalPolicy = policy;
  }

  public clear(): void {
    this.policies.clear();
    this.history.clear();
    DEFAULT_RESIDUAL_POLICY.equations.forEach((p, eq) => {
      this.policies.set(eq, p);
    });
  }
}
