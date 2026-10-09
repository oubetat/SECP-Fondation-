/**
 * SECP Industrial OS v2 — Conservation Evaluator
 * PATCH-050: Conservation Framework
 */

import { 
  ConservationContract, 
  ConservationResult, 
  ConservationVerdict 
} from "./ConservationTypes";
import { MassConservationEvaluator } from "./MassConservation";
import { MomentumConservationEvaluator } from "./MomentumConservation";
import { EnergyConservationEvaluator } from "./EnergyConservation";
import * as crypto from "crypto";

export class ConservationEvaluator {

  public static evaluateContract(contract: ConservationContract): ConservationResult {
    const diagnostics: string[] = [];

    if (!contract) {
      return this.createInvalidResult("Contract is null or undefined", contract);
    }

    if (!contract.caseId || !contract.solverId || !contract.meshId) {
      return this.createInvalidResult("Missing required caseId, solverId, or meshId in contract", contract);
    }

    // Calculate canonical input hash
    const inputHash = this.calculateInputHash(contract);

    // 1. Evaluate Mass Conservation
    const massResult = MassConservationEvaluator.evaluate(
      contract.massData,
      contract.systemType,
      contract.analysisType,
      contract.toleranceConfig
    );
    diagnostics.push(...massResult.diagnostics.map(d => `[MASS] ${d}`));

    // 2. Evaluate Momentum Conservation
    const momentumResult = MomentumConservationEvaluator.evaluate(
      contract.momentumData,
      contract.systemType,
      contract.analysisType,
      contract.toleranceConfig
    );
    diagnostics.push(...momentumResult.diagnostics.map(d => `[MOMENTUM] ${d}`));

    // 3. Evaluate Energy Conservation
    const energyResult = EnergyConservationEvaluator.evaluate(
      contract.energyData,
      contract.systemType,
      contract.analysisType,
      contract.toleranceConfig
    );
    diagnostics.push(...energyResult.diagnostics.map(d => `[ENERGY] ${d}`));

    // 4. Derive Overall Verdict
    let overallVerdict: ConservationVerdict = "PASS";

    const allVerdicts = [massResult.verdict, momentumResult.verdict, energyResult.verdict];

    if (allVerdicts.some(v => v.includes("INVALID"))) {
      overallVerdict = "INVALID";
    } else if (allVerdicts.some(v => v.includes("FAILURE") || v.includes("NOT_CONVERGED"))) {
      overallVerdict = "FAIL";
    } else if (allVerdicts.some(v => v.includes("UNPROVEN"))) {
      overallVerdict = "UNPROVEN";
    } else if (allVerdicts.every(v => v.includes("CONVERGED"))) {
      overallVerdict = "PASS";
    } else {
      overallVerdict = "INCONCLUSIVE";
    }

    const payload = {
      caseId: contract.caseId,
      solverId: contract.solverId,
      solverVersion: contract.solverVersion,
      meshId: contract.meshId,
      overallVerdict,
      massVerdict: massResult.verdict,
      momentumVerdict: momentumResult.verdict,
      energyVerdict: energyResult.verdict,
      inputHash
    };

    const resultHash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    return {
      caseId: contract.caseId,
      solverId: contract.solverId,
      solverVersion: contract.solverVersion,
      meshId: contract.meshId,
      systemType: contract.systemType,
      analysisType: contract.analysisType,
      massResult,
      momentumResult,
      energyResult,
      overallVerdict,
      diagnostics,
      inputHash,
      resultHash,
      timestamp: new Date().toISOString()
    };
  }

  public static calculateInputHash(contract: ConservationContract): string {
    const payload = {
      caseId: contract.caseId,
      solverId: contract.solverId,
      solverVersion: contract.solverVersion,
      meshId: contract.meshId,
      systemType: contract.systemType,
      analysisType: contract.analysisType,
      toleranceConfig: contract.toleranceConfig,
      massData: contract.massData,
      momentumData: contract.momentumData,
      energyData: contract.energyData
    };
    return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  }

  private static createInvalidResult(reason: string, contract?: Partial<ConservationContract>): ConservationResult {
    return {
      caseId: contract?.caseId ?? "INVALID_CASE",
      solverId: contract?.solverId ?? "UNKNOWN_SOLVER",
      solverVersion: contract?.solverVersion ?? "0.0.0",
      meshId: contract?.meshId ?? "UNKNOWN_MESH",
      systemType: contract?.systemType ?? "CONTROL_VOLUME",
      analysisType: contract?.analysisType ?? "STEADY",
      massResult: { verdict: "MASS_INVALID", diagnostics: [reason] },
      momentumResult: { verdict: "MOMENTUM_INVALID", diagnostics: [reason] },
      energyResult: { verdict: "ENERGY_INVALID", availableTerms: [], missingTerms: [], diagnostics: [reason] },
      overallVerdict: "INVALID",
      diagnostics: [reason],
      inputHash: "INVALID",
      resultHash: "INVALID",
      timestamp: new Date().toISOString()
    };
  }
}
