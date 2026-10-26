/**
 * SECP Industrial OS — Engineering Truth OS
 * StructuralStressQualificationBridge.ts
 * 
 * Bridges structural FEA solver outputs with formal qualification requirements
 * and registers cryptographic evidence in the verification ledger.
 */

import { pureSha256 } from '../../polyfills/crypto';
import {
  QualificationRequirement,
  evaluateAcceptanceCriteria,
  RequirementVerificationEvidence
} from './QualificationRequirement';
import {
  PcbStructuralDeflectionEngine,
  PcbSubstrateProperties,
  StructuralDeflectionResult
} from '../pcb/PcbStructuralDeflectionEngine';

export interface StructuralSimulationResult {
  isMechanicallyStable: boolean;
  maxDeflectionMm: number;
  maxBendingStressMpa: number;
  yieldStrengthMpa: number;
  safetyFactor: number;
  fundamentalFrequencyHz: number;
}

export class StructuralStressQualificationBridge {
  /**
   * Evaluates a structural FEM/FEA simulation against a formal qualification requirement.
   */
  public static evaluateStructuralRequirement(
    requirement: QualificationRequirement,
    boardParams: PcbSubstrateProperties,
    uniformLoadPa: number = 500.0,
    yieldStrengthMpa: number = 310.0 // Standard FR-4 flexural strength (~310-340 MPa)
  ): { evidence: RequirementVerificationEvidence; feaResult: StructuralSimulationResult; isSatisfied: boolean } {
    
    // 1. Run the authoritative structural FEA solver
    const deflectionOutput: StructuralDeflectionResult = PcbStructuralDeflectionEngine.evaluateStructuralIntegrity(
      boardParams,
      uniformLoadPa
    );

    const safetyFactor = deflectionOutput.maxBendingStressMpa > 1e-4
      ? yieldStrengthMpa / deflectionOutput.maxBendingStressMpa
      : 99.0;

    const feaResult: StructuralSimulationResult = {
      isMechanicallyStable: deflectionOutput.isMechanicallyStable,
      maxDeflectionMm: deflectionOutput.maxDeflectionMm,
      maxBendingStressMpa: deflectionOutput.maxBendingStressMpa,
      yieldStrengthMpa,
      safetyFactor,
      fundamentalFrequencyHz: deflectionOutput.fundamentalFrequencyHz
    };

    // 2. Map solver output to the requirement's expected metric type
    // If the requirement expects boolean stability or maximum stress threshold:
    const measuredValue = requirement.acceptanceCriteria.unit === 'MPa'
      ? feaResult.maxBendingStressMpa
      : requirement.acceptanceCriteria.unit === 'mm'
        ? feaResult.maxDeflectionMm
        : feaResult.isMechanicallyStable;

    // 3. Evaluate against acceptance criteria using the authoritative evaluation engine
    const evaluation = evaluateAcceptanceCriteria(requirement.acceptanceCriteria, measuredValue);

    // 4. Generate deterministic cryptographic evidence payload (SHA-256)
    const timestamp = new Date().toISOString();
    const evidencePayload = {
      requirementId: requirement.requirementId,
      measuredValue,
      maxDeflectionMm: feaResult.maxDeflectionMm,
      maxBendingStressMpa: feaResult.maxBendingStressMpa,
      safetyFactor: feaResult.safetyFactor,
      isCompliant: evaluation.complies,
      boardParams: {
        lengthMm: boardParams.lengthMm,
        widthMm: boardParams.widthMm,
        thicknessMm: boardParams.thicknessMm,
        mountingType: boardParams.mountingType
      },
      timestamp
    };

    const evidenceDigest = pureSha256(JSON.stringify(evidencePayload));

    // 5. Build the formal verification evidence record
    const evidence: RequirementVerificationEvidence = {
      requirementId: requirement.requirementId,
      measuredValue,
      isCompliant: evaluation.complies,
      executionTimestamp: timestamp,
      evidenceDigest,
      solverUsed: 'PcbStructuralDeflectionEngine.evaluateStructuralIntegrity (Kirchhoff Plate-Beam FEA)',
      solverLimitationsNoted: requirement.solverValidityLimits,
      notes: `FEA Result: Deflection = ${feaResult.maxDeflectionMm.toFixed(4)} mm, Bending Stress = ${feaResult.maxBendingStressMpa.toFixed(2)} MPa, FOS = ${feaResult.safetyFactor.toFixed(2)}. ${evaluation.message}`
    };

    return {
      evidence,
      feaResult,
      isSatisfied: evaluation.complies
    };
  }
}
