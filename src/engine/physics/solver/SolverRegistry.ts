/**
 * SECP Industrial OS v2 — Solver Registry
 * PATCH-048: Solver Contract
 */

import { SolverContract } from "./SolverTypes";
import { SolverContractValidator } from "./SolverContractValidator";

export interface RegistryRegisterResult {
  success: boolean;
  error?: string;
  key?: string;
}

export class SolverRegistry {
  private contracts = new Map<string, SolverContract>();

  private makeKey(solverId: string, version: string): string {
    return `${solverId}::${version}`;
  }

  public register(contract: SolverContract): RegistryRegisterResult {
    if (!contract || !contract.solverId || !contract.solverVersion) {
      return {
        success: false,
        error: "Invalid contract: solverId and solverVersion are required"
      };
    }

    const key = this.makeKey(contract.solverId, contract.solverVersion);
    if (this.contracts.has(key)) {
      return {
        success: false,
        error: `Duplicate solver registration rejected: ${key} is already registered`
      };
    }

    // Validate contract structure before registering
    const val = SolverContractValidator.validateContract(contract);
    if (!val.valid) {
      return {
        success: false,
        error: `Contract validation failed for ${key}: ${val.errors.join("; ")}`
      };
    }

    this.contracts.set(key, contract);
    return {
      success: true,
      key
    };
  }

  public get(solverId: string, version: string): SolverContract | undefined {
    return this.contracts.get(this.makeKey(solverId, version));
  }

  public has(solverId: string, version: string): boolean {
    return this.contracts.has(this.makeKey(solverId, version));
  }

  public list(): SolverContract[] {
    return Array.from(this.contracts.values());
  }

  public clear(): void {
    this.contracts.clear();
  }

  public size(): number {
    return this.contracts.size;
  }
}
