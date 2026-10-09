import {
  FatigueAnalysisModel,
  StressHistory,
  ExtractedCycle,
  FatigueHotspot,
  FatigueResult,
  FatigueVerdict,
  FatigueStateHash,
  ExtrapolationPolicy,
  MeanStressCorrectionMethod,
  SNMaterialModel
} from "./types";
import { RainflowCycleCounter } from "./RainflowCycleCounter";
import { MeanStressCorrector } from "./MeanStressCorrector";
import { SNMaterialModelEngine } from "./SNMaterialModelEngine";

export class FatigueAnalysisEngine {
  /**
   * Computes deterministic state hash for fatigue analysis configuration.
   */
  public static computeStateHash(model: FatigueAnalysisModel, stressHistories: StressHistory[]): FatigueStateHash {
    const structStr = stressHistories.map(h => `${h.locationId}:${h.equivalentStress.length}`).sort().join(";");
    const loadStr = model.loadHistory ? `${model.loadHistory.historyId}:${model.loadHistory.historyHash}` : "N/A";

    const mat = model.fatigueMaterialModel;
    const matStr = mat ? `${mat.materialId}:UTS=${mat.uts}:Type=${mat.curveType}` : "EMPTY";
    const policyStr = `${model.cycleCountingMethod}:${model.meanStressCorrection}:${model.damageRule}`;

    const raw = `${structStr}|${loadStr}|${matStr}|${policyStr}`;

    // Simple deterministic string hash
    let hashVal = 0;
    for (let i = 0; i < raw.length; i++) {
      hashVal = ((hashVal << 5) - hashVal) + raw.charCodeAt(i);
      hashVal |= 0;
    }

    const hexHash = Math.abs(hashVal).toString(16).padStart(8, '0');

    return {
      structuralStateHash: `ST_${hexHash}`,
      loadHistoryHash: `LH_${hexHash}`,
      materialFatigueHash: `MAT_${hexHash}`,
      cycleCountingPolicy: model.cycleCountingMethod,
      meanStressPolicy: model.meanStressCorrection,
      damageRule: model.damageRule,
      solverConfiguration: `EXTRAP=${ExtrapolationPolicy.OUTSIDE_MATERIAL_DATA_RANGE}`,
      compositeHash: `FATIGUE_HASH_${hexHash}`
    };
  }

  /**
   * Analyzes stress history at a single location, extracts cycles, applies mean stress correction,
   * calculates Miner damage and predicted life.
   */
  public static analyzeStressHistory(
    stressHistory: StressHistory,
    materialModel: SNMaterialModel,
    meanCorrection: MeanStressCorrectionMethod = MeanStressCorrectionMethod.GOODMAN,
    extrapolationPolicy: ExtrapolationPolicy = ExtrapolationPolicy.OUTSIDE_MATERIAL_DATA_RANGE
  ): {
    cycles: ExtractedCycle[];
    cumulativeDamage: number;
    predictedLifeBlocks: number;
    governingCycle?: ExtractedCycle;
    maxStressRange: number;
    maxStressAmplitude: number;
    maxMeanStress: number;
    totalAppliedCycles: number;
  } {
    if (!stressHistory || !stressHistory.equivalentStress || stressHistory.equivalentStress.length < 2) {
      throw new Error("INVALID_STRESS_HISTORY: Stress history series must contain at least 2 points");
    }

    const cycles = RainflowCycleCounter.countCycles(stressHistory.equivalentStress);

    let cumulativeDamage = 0;
    let maxDamage = -1;
    let governingCycle: ExtractedCycle | undefined = undefined;
    let maxRange = 0;
    let maxAmp = 0;
    let maxMean = -Infinity;
    let totalAppliedCycles = 0;

    for (const cycle of cycles) {
      totalAppliedCycles += cycle.count;
      if (cycle.range > maxRange) maxRange = cycle.range;
      if (cycle.amplitude > maxAmp) maxAmp = cycle.amplitude;
      if (cycle.mean > maxMean) maxMean = cycle.mean;

      // Mean stress correction
      const correctedAmp = MeanStressCorrector.correctMeanStress(
        cycle.amplitude,
        cycle.mean,
        materialModel.uts,
        materialModel.yieldStrength,
        meanCorrection
      );
      cycle.correctedAmplitude = correctedAmp;

      // S-N lookup for cycles to failure
      const Nf = SNMaterialModelEngine.calculateCyclesToFailure(
        materialModel,
        correctedAmp,
        extrapolationPolicy
      );
      cycle.cyclesToFailure = Nf;

      // Miner damage contribution per cycle
      const cycleDamage = isFinite(Nf) && Nf > 0 ? cycle.count / Nf : 0;
      cycle.damage = cycleDamage;
      cumulativeDamage += cycleDamage;

      if (cycleDamage > maxDamage) {
        maxDamage = cycleDamage;
        governingCycle = cycle;
      }
    }

    const predictedLifeBlocks = cumulativeDamage > 0 ? 1.0 / cumulativeDamage : Infinity;

    return {
      cycles,
      cumulativeDamage,
      predictedLifeBlocks,
      governingCycle,
      maxStressRange: maxRange,
      maxStressAmplitude: maxAmp,
      maxMeanStress: maxMean,
      totalAppliedCycles
    };
  }

  /**
   * Evaluates complete fatigue analysis model across multiple locations/hotspots.
   */
  public static evaluateModel(
    model: FatigueAnalysisModel,
    stressHistories: StressHistory[]
  ): FatigueResult {
    if (!stressHistories || stressHistories.length === 0) {
      return {
        damage: 0,
        predictedLife: Infinity,
        totalCycles: 0,
        hotspots: [],
        cycles: [],
        verdict: FatigueVerdict.INVALID_STRESS_HISTORY,
        stateHash: "INVALID"
      };
    }

    const stateHashObj = this.computeStateHash(model, stressHistories);
    const hotspots: FatigueHotspot[] = [];
    let maxDamage = -1;
    let primaryGoverningCycle: ExtractedCycle | undefined = undefined;
    let primaryCycles: ExtractedCycle[] = [];
    let totalCyclesAllLocations = 0;

    try {
      for (const history of stressHistories) {
        const res = this.analyzeStressHistory(
          history,
          model.fatigueMaterialModel,
          model.meanStressCorrection
        );

        totalCyclesAllLocations += res.totalAppliedCycles;

        const hotspot: FatigueHotspot = {
          elementId: history.elementId,
          integrationPoint: history.integrationPoint,
          locationId: history.locationId,
          stressHistory: history,
          damage: res.cumulativeDamage,
          predictedLife: res.predictedLifeBlocks,
          governingCycle: res.governingCycle,
          governingCriterion: `MINER_GOODMAN_${model.meanStressCorrection}`
        };

        hotspots.push(hotspot);

        if (res.cumulativeDamage > maxDamage) {
          maxDamage = res.cumulativeDamage;
          primaryGoverningCycle = res.governingCycle;
          primaryCycles = res.cycles;
        }
      }

      // Sort hotspots descending by damage
      hotspots.sort((a, b) => b.damage - a.damage);

      const topDamage = hotspots[0]?.damage || 0;
      const predictedLife = topDamage > 0 ? 1.0 / topDamage : Infinity;

      let verdict = FatigueVerdict.SAFE_FOR_DEFINED_CRITERION;
      if (topDamage >= 1.0) {
        verdict = FatigueVerdict.FATIGUE_FAILURE;
      } else if (topDamage > 0.8) {
        verdict = FatigueVerdict.INSUFFICIENT_LIFE;
      }

      return {
        damage: topDamage,
        predictedLife,
        totalCycles: totalCyclesAllLocations,
        hotspots,
        cycles: primaryCycles,
        verdict,
        stateHash: stateHashObj.compositeHash
      };

    } catch (err: any) {
      const errMsg = err?.message || String(err);
      let errVerdict = FatigueVerdict.DAMAGE_MODEL_FAILURE;

      if (errMsg.includes("MEAN_STRESS_CORRECTION_FAILURE")) {
        errVerdict = FatigueVerdict.MEAN_STRESS_CORRECTION_FAILURE;
      } else if (errMsg.includes("INVALID_STRESS_HISTORY")) {
        errVerdict = FatigueVerdict.INVALID_STRESS_HISTORY;
      } else if (errMsg.includes("INVALID_MATERIAL_DATA")) {
        errVerdict = FatigueVerdict.INVALID_MATERIAL_DATA;
      } else if (errMsg.includes("MISSING_FATIGUE_CURVE")) {
        errVerdict = FatigueVerdict.MISSING_FATIGUE_CURVE;
      } else if (errMsg.includes("OUTSIDE_MATERIAL_DATA_RANGE")) {
        errVerdict = FatigueVerdict.OUTSIDE_MATERIAL_DATA_RANGE;
      }

      return {
        damage: 0,
        predictedLife: 0,
        totalCycles: 0,
        hotspots: [],
        cycles: [],
        verdict: errVerdict,
        stateHash: stateHashObj.compositeHash,
        details: errMsg
      };
    }
  }

  /**
   * Verifies mesh convergence for spatial fatigue analysis.
   * Compares max fatigue damage between coarse and fine meshes.
   */
  public static verifyMeshConvergence(
    coarseDamage: number,
    fineDamage: number,
    toleranceRel: number = 0.05
  ): { converged: boolean; relativeDifference: number } {
    if (coarseDamage <= 0 && fineDamage <= 0) {
      return { converged: true, relativeDifference: 0 };
    }
    const diff = Math.abs(fineDamage - coarseDamage) / Math.max(Math.abs(fineDamage), 1e-12);
    return {
      converged: diff <= toleranceRel,
      relativeDifference: diff
    };
  }

  /**
   * Verifies sampling rate convergence for cycle history.
   */
  public static verifyHistoryConvergence(
    coarseCycles: ExtractedCycle[],
    fineCycles: ExtractedCycle[],
    toleranceRel: number = 0.05
  ): { converged: boolean; relativeDifference: number } {
    const coarseCount = coarseCycles.reduce((s, c) => s + c.count, 0);
    const fineCount = fineCycles.reduce((s, c) => s + c.count, 0);

    const diff = Math.abs(fineCount - coarseCount) / Math.max(fineCount, 1.0);
    return {
      converged: diff <= toleranceRel,
      relativeDifference: diff
    };
  }
}
