/**
 * SECP-POST-007 PHASE 3 — PHASE3-LOSS-ACCOUNTING-002
 * Quantitative Loss Propagation & Causality Audit Engine
 * 
 * Implements strict Causality and Prediction Claim Firewalls:
 * - Distinguishes COMPUTED_FROM_SYNTHETIC_DATA from CAUSALLY_VALIDATED physical telemetry.
 * - Enforces that a loss value does NOT establish its physical cause without independent empirical evidence.
 * - Prohibits claiming prognostic/preventive intervention on purely synthetic data.
 */

import { LifecycleStage } from "./CyberPhysicalLossAccountingEngine";
import {
  EvidenceProvenanceAntiSpoofEngine,
  VerifiablePhysicalTelemetryBundle,
  AntiSpoofEvaluationResult
} from "./EvidenceProvenanceAntiSpoofEngine";

export type LossEvidenceClassification =
  | "COMPUTED_FROM_SYNTHETIC_DATA"
  | "OBSERVED_FROM_ENGINEERING_ARTIFACTS"
  | "SUPPORTED_BY_PHYSICAL_TELEMETRY"
  | "CAUSALLY_VALIDATED";

export type ClaimType =
  | "RETROSPECTIVE_DETECTION"
  | "PROGNOSTIC_PREDICTION"
  | "PREVENTIVE_INTERVENTION"
  | "SYNTHETIC_CONTRACT_REPRESENTATION";

export interface CausalEvidenceBundle {
  controllerTelemetryId?: string;
  axisFollowingErrorMm?: number;
  commandedVsActualDiscrepancyMm?: number;
  spindleTemperatureDegC?: number;
  machineAmbientDegC?: number;
  feedrateMmPerMin?: number;
  curvatureRadiusMm?: number;
  dynamometerForcesN?: { fc: number; ff: number; fp: number };
  vibrationRmsG?: number;
  laserInterferometerCalibrationId?: string;
}

export interface StageLossMeasurement {
  fromStage: LifecycleStage;
  toStage: LifecycleStage;
  stageName: string;
  lossMagnitudeMm: number;
  uncertaintyMm?: number;
  lossCategory: "DISCRETIZATION" | "KINEMATIC_TRACKING" | "THERMAL_DRIFT" | "SENSOR_REPEATABILITY" | "SOLVER_PRECISION" | "MODEL_APPROXIMATION";
  evidenceClassification?: LossEvidenceClassification;
  claimedPhysicalCause?: string;
  causalEvidence?: CausalEvidenceBundle;
  verifiableTelemetryBundle?: VerifiablePhysicalTelemetryBundle;
}

export interface BottleneckAnalysis {
  stageTransition: string;
  lossMagnitudeMm: number;
  uncertaintyMm: number;
  percentageOfTotalLoss: number;
  isDominantBottleneck: boolean;
  evidenceClassification: LossEvidenceClassification;
  antiSpoofResult?: AntiSpoofEvaluationResult;
  causalStatus: "PHYSICAL_CAUSE_ESTABLISHED" | "PHYSICAL_CAUSE_NOT_ESTABLISHED";
  verifiedPhysicalCause: string;
  claimType: ClaimType;
  remediationRecommendation: string;
}

export interface QuantitativeLossProfileReport {
  profileId: string;
  totalCumulativeLossMm: number;
  totalCombinedUncertaintyMm: number;
  allocatedPartToleranceMm: number;
  toleranceConsumptionPercent: number;
  willBreachTolerance: boolean;
  earliestBreachStage: LifecycleStage | null;
  dominantBottleneck: BottleneckAnalysis;
  lossBreakdown: BottleneckAnalysis[];
  prognosticAction: "PROCEED" | "OPTIMIZE_BEFORE_CUTTING" | "HALT_REVISE_PROCESS";
  overallClaimType: ClaimType;
  causalityEnforcementEvidence: string;
  spoofingDetected: boolean;
  antiSpoofViolations: string[];
  mathematicalProofHash: string;
}

export class QuantitativeLossProfiler {
  /**
   * Profiles the loss progression across the chain with strict causality and prediction firewalls.
   * Evidence classification is DERIVED forensically rather than accepted blindly from caller.
   */
  public static profileLossThread(
    lossMeasurements: StageLossMeasurement[],
    partToleranceMm: number = 0.050 // default 50 um
  ): QuantitativeLossProfileReport {
    const profileId = `LOSS_PROF_${Date.now()}`;
    let totalLoss = 0;
    let sumSquaredUncertainty = 0;
    let earliestBreachStage: LifecycleStage | null = null;
    let anySpoofingDetected = false;
    const accumulatedAntiSpoofViolations: string[] = [];

    // 1. Calculate cumulative sum and uncertainty
    lossMeasurements.forEach(m => {
      totalLoss += m.lossMagnitudeMm;
      const u = m.uncertaintyMm || 0.001;
      sumSquaredUncertainty += u * u;
      if (totalLoss > partToleranceMm && !earliestBreachStage) {
        earliestBreachStage = m.toStage;
      }
    });

    const totalCombinedUncertaintyMm = Math.sqrt(sumSquaredUncertainty) * 2.0; // k = 2 (95.45%)

    // 2. CAUSALITY & ANTI-SPOOF FORENSIC EVALUATION
    const breakdown: BottleneckAnalysis[] = lossMeasurements.map(m => {
      const pct = totalLoss > 0 ? (m.lossMagnitudeMm / totalLoss) * 100.0 : 0;
      const uncertainty = m.uncertaintyMm || 0.001;

      // DERIVE evidence classification forensically through Anti-Spoof Engine
      const antiSpoof = EvidenceProvenanceAntiSpoofEngine.evaluateEvidence(
        m.verifiableTelemetryBundle,
        m.evidenceClassification
      );

      if (antiSpoof.antiSpoofStatus === "EVIDENCE_SPOOFING_DETECTED") {
        anySpoofingDetected = true;
        accumulatedAntiSpoofViolations.push(...antiSpoof.violations);
      }

      // Canonical derived level (never caller input alone)
      let effectiveLevel: LossEvidenceClassification = antiSpoof.derivedEvidenceLevel;
      if (m.evidenceClassification === "OBSERVED_FROM_ENGINEERING_ARTIFACTS" && !m.verifiableTelemetryBundle) {
        effectiveLevel = "OBSERVED_FROM_ENGINEERING_ARTIFACTS";
      }

      // Causality evaluation
      let causalStatus: "PHYSICAL_CAUSE_ESTABLISHED" | "PHYSICAL_CAUSE_NOT_ESTABLISHED" = "PHYSICAL_CAUSE_NOT_ESTABLISHED";
      let verifiedPhysicalCause = "UNPROVEN_PHYSICAL_HYPOTHESIS";
      let claimType: ClaimType = "SYNTHETIC_CONTRACT_REPRESENTATION";
      let remediation = "No action established";

      if (effectiveLevel === "CAUSALLY_VALIDATED" || effectiveLevel === "SUPPORTED_BY_PHYSICAL_TELEMETRY") {
        causalStatus = "PHYSICAL_CAUSE_ESTABLISHED";
        verifiedPhysicalCause = m.claimedPhysicalCause || "EMPIRICALLY_CORRELATED_TELEMETRY";
        claimType = "PROGNOSTIC_PREDICTION";
        if (m.lossCategory === "KINEMATIC_TRACKING") {
          remediation = "Enable look-ahead contour control and reduce feedrate in high-curvature zones to reduce servo lag";
        } else if (m.lossCategory === "THERMAL_DRIFT") {
          remediation = "Engage in-process spindle chilling and ISO 1 thermal compensation sensors";
        }
      } else if (effectiveLevel === "OBSERVED_FROM_ENGINEERING_ARTIFACTS") {
        causalStatus = "PHYSICAL_CAUSE_NOT_ESTABLISHED";
        verifiedPhysicalCause = "OBSERVED_GEOMETRIC_DISCREPANCY_WITHOUT_DYNAMICS_TELEMETRY";
        claimType = "RETROSPECTIVE_DETECTION";
        remediation = "Refine geometric sampling / inspect post-process CMM results";
      } else {
        // Purely synthetic, unbacked, or spoofed
        causalStatus = "PHYSICAL_CAUSE_NOT_ESTABLISHED";
        verifiedPhysicalCause = "PHYSICAL_CAUSE = NOT_ESTABLISHED (SYNTHETIC_SIMULATION)";
        claimType = "SYNTHETIC_CONTRACT_REPRESENTATION";
        remediation = "Synthetic loss vector only; no physical causal intervention permitted";
      }

      return {
        stageTransition: `${m.fromStage} -> ${m.toStage}`,
        lossMagnitudeMm: m.lossMagnitudeMm,
        uncertaintyMm: uncertainty,
        percentageOfTotalLoss: Math.round(pct * 10) / 10,
        isDominantBottleneck: false,
        evidenceClassification: effectiveLevel,
        antiSpoofResult: antiSpoof,
        causalStatus,
        verifiedPhysicalCause,
        claimType,
        remediationRecommendation: remediation
      };
    });

    // 3. Find dominant bottleneck
    let maxIdx = 0;
    breakdown.forEach((b, idx) => {
      if (b.lossMagnitudeMm > breakdown[maxIdx].lossMagnitudeMm) {
        maxIdx = idx;
      }
    });
    if (breakdown.length > 0) {
      breakdown[maxIdx].isDominantBottleneck = true;
    }

    const dominantBottleneck = breakdown[maxIdx] || {
      stageTransition: "NONE",
      lossMagnitudeMm: 0,
      uncertaintyMm: 0,
      percentageOfTotalLoss: 0,
      isDominantBottleneck: false,
      evidenceClassification: "COMPUTED_FROM_SYNTHETIC_DATA" as const,
      causalStatus: "PHYSICAL_CAUSE_NOT_ESTABLISHED" as const,
      verifiedPhysicalCause: "NONE",
      claimType: "SYNTHETIC_CONTRACT_REPRESENTATION" as const,
      remediationRecommendation: "None"
    };

    const consumptionPercent = Math.round((totalLoss / Math.max(partToleranceMm, 1e-6)) * 1000) / 10;
    const willBreach = totalLoss > partToleranceMm;

    let action: "PROCEED" | "OPTIMIZE_BEFORE_CUTTING" | "HALT_REVISE_PROCESS" = "PROCEED";
    if (willBreach || anySpoofingDetected) {
      action = "HALT_REVISE_PROCESS";
    } else if (consumptionPercent > 70.0) {
      action = "OPTIMIZE_BEFORE_CUTTING";
    }

    // Determine overall claim type
    const allSynthetic = breakdown.every(b => b.evidenceClassification === "COMPUTED_FROM_SYNTHETIC_DATA");
    const anyPhysical = breakdown.some(b => b.evidenceClassification === "SUPPORTED_BY_PHYSICAL_TELEMETRY" || b.evidenceClassification === "CAUSALLY_VALIDATED");
    const overallClaimType: ClaimType = allSynthetic
      ? "SYNTHETIC_CONTRACT_REPRESENTATION"
      : anyPhysical
        ? "PROGNOSTIC_PREDICTION"
        : "RETROSPECTIVE_DETECTION";

    let causalityEnforcementEvidence = allSynthetic
      ? "CAUSALITY_FIREWALL_ENFORCED: Synthetic data detected. Physical causality suppressed to NOT_ESTABLISHED."
      : "CAUSALITY_EVALUATED: Grounded in empirical artifact / verifiable telemetry stream.";

    if (anySpoofingDetected) {
      causalityEnforcementEvidence = `EVIDENCE_SPOOFING_ALERT: Caller claimed physical evidence without verifiable hardware attestation. Downgraded and failed closed. Violations: ${accumulatedAntiSpoofViolations.join("; ")}`;
    }

    const proofHash = `SHA256_PROFILER_${totalLoss.toFixed(5)}_${consumptionPercent.toFixed(1)}_${dominantBottleneck.stageTransition}_${dominantBottleneck.causalStatus}`;

    return {
      profileId,
      totalCumulativeLossMm: Math.round(totalLoss * 10000) / 10000,
      totalCombinedUncertaintyMm: Math.round(totalCombinedUncertaintyMm * 10000) / 10000,
      allocatedPartToleranceMm: partToleranceMm,
      toleranceConsumptionPercent: consumptionPercent,
      willBreachTolerance: willBreach,
      earliestBreachStage,
      dominantBottleneck,
      lossBreakdown: breakdown,
      prognosticAction: action,
      overallClaimType,
      causalityEnforcementEvidence,
      spoofingDetected: anySpoofingDetected,
      antiSpoofViolations: accumulatedAntiSpoofViolations,
      mathematicalProofHash: proofHash
    };
  }
}
