/**
 * SECP Industrial OS v2 — Momentum Conservation Evaluator
 * PATCH-050: Conservation Framework
 */

import { 
  MomentumFluxData, 
  MomentumConservationResult, 
  SystemType, 
  AnalysisType, 
  ToleranceConfig,
  MomentumComponentTerms,
  DomainBalanceTerms
} from "./ConservationTypes";
import { UnitsEngine } from "../units/UnitsEngine";

export class MomentumConservationEvaluator {

  public static evaluate(
    momentumData: MomentumFluxData | undefined,
    systemType: SystemType,
    analysisType: AnalysisType,
    tolerance: ToleranceConfig
  ): MomentumConservationResult {
    const diagnostics: string[] = [];

    // 1. Data Availability Check
    if (!momentumData) {
      return {
        verdict: "MOMENTUM_UNPROVEN",
        diagnostics: ["Momentum flux/force data is completely missing"]
      };
    }

    const convectiveIn = momentumData.convectiveFluxesIn ?? [];
    const convectiveOut = momentumData.convectiveFluxesOut ?? [];
    const surfaceForces = momentumData.surfaceForces ?? [];
    const bodyForces = momentumData.bodyForces ?? [];
    const sources = momentumData.momentumSources ?? [];
    const storage = momentumData.transientStorageRate;

    if (convectiveIn.length === 0 && convectiveOut.length === 0 && surfaceForces.length === 0 && bodyForces.length === 0 && sources.length === 0) {
      return {
        verdict: "MOMENTUM_UNPROVEN",
        diagnostics: ["No momentum convective fluxes, surface forces, body forces, or sources provided"]
      };
    }

    if (analysisType === "TRANSIENT" && !storage) {
      return {
        verdict: "MOMENTUM_UNPROVEN",
        diagnostics: ["Transient analysis specified, but transient momentum storage rate term (d/dt ∫ρu dV) was not provided"]
      };
    }

    // 2. Unit Validation (PATCH-043)
    const allVectors: any[] = [...convectiveIn, ...convectiveOut, ...surfaceForces, ...bodyForces, ...sources];
    if (storage) {
      allVectors.push({ boundaryId: "storage", x: storage.x, y: storage.y, z: storage.z, unit: storage.unit });
    }

    for (const vec of allVectors) {
      const vecId = vec.boundaryId ?? vec.sourceId ?? "unknown";
      if (isNaN(vec.x) || !isFinite(vec.x) || isNaN(vec.y) || !isFinite(vec.y) || isNaN(vec.z) || !isFinite(vec.z)) {
        return {
          verdict: "MOMENTUM_INVALID",
          diagnostics: [`Invalid non-finite momentum/force vector value detected on ${vecId}: [${vec.x}, ${vec.y}, ${vec.z}]`]
        };
      }

      if (vec.unit) {
        const unitCheck = UnitsEngine.convertUnit(1, vec.unit, "N");
        if (!unitCheck.valid) {
          return {
            verdict: "MOMENTUM_INVALID",
            diagnostics: [`Incompatible momentum/force unit '${vec.unit}' on ${vecId}: ${unitCheck.errors.join("; ")}`]
          };
        }
      } else {
        return {
          verdict: "MOMENTUM_INVALID",
          diagnostics: [`Missing unit declaration on momentum boundary/force ${vecId}`]
        };
      }
    }

    // 3. Component-wise Balance Calculations (Converted to N)
    const calculateComponentBalance = (axis: 'x' | 'y' | 'z'): DomainBalanceTerms => {
      let totalIn = 0;
      for (const f of convectiveIn) {
        const conv = UnitsEngine.convertUnit(f[axis], f.unit, "N");
        totalIn += conv.value ?? f[axis];
      }

      let totalOut = 0;
      for (const f of convectiveOut) {
        const conv = UnitsEngine.convertUnit(f[axis], f.unit, "N");
        totalOut += conv.value ?? f[axis];
      }

      let totalSource = 0;
      for (const f of surfaceForces) {
        const conv = UnitsEngine.convertUnit(f[axis], f.unit, "N");
        totalSource += conv.value ?? f[axis];
      }
      for (const f of bodyForces) {
        const conv = UnitsEngine.convertUnit(f[axis], f.unit, "N");
        totalSource += conv.value ?? f[axis];
      }
      for (const f of sources) {
        const conv = UnitsEngine.convertUnit(f[axis], f.unit, "N");
        totalSource += conv.value ?? f[axis];
      }

      let totalStorage = 0;
      if (analysisType === "TRANSIENT" && storage) {
        const conv = UnitsEngine.convertUnit(storage[axis], storage.unit, "N");
        totalStorage = conv.value ?? storage[axis];
      }

      const absImbalance = Math.abs((totalIn + totalSource) - (totalOut + totalStorage));
      const floor = 1e-12;
      let relImbalance = absImbalance;

      if (tolerance.normalizationMethod === "INLET_FLUX") {
        const ref = Math.max(Math.abs(totalIn), floor);
        relImbalance = absImbalance / ref;
      } else if (tolerance.normalizationMethod === "TOTAL_CAPACITY") {
        const ref = Math.max(Math.abs(totalIn) + Math.abs(totalOut) + Math.abs(totalSource), floor);
        relImbalance = absImbalance / ref;
      } else if (tolerance.normalizationMethod === "REFERENCE_VALUE" && tolerance.referenceValue) {
        const ref = Math.max(Math.abs(tolerance.referenceValue), floor);
        relImbalance = absImbalance / ref;
      }

      return {
        totalIn,
        totalOut,
        totalStorage,
        totalSource,
        absoluteImbalance: absImbalance,
        relativeImbalance: relImbalance,
        unit: "N"
      };
    };

    const xTerms = calculateComponentBalance('x');
    const yTerms = calculateComponentBalance('y');
    const zTerms = calculateComponentBalance('z');

    const vectorNormImbalance = Math.sqrt(
      Math.pow(xTerms.absoluteImbalance, 2) +
      Math.pow(yTerms.absoluteImbalance, 2) +
      Math.pow(zTerms.absoluteImbalance, 2)
    );

    const componentTerms: MomentumComponentTerms = {
      x: xTerms,
      y: yTerms,
      z: zTerms,
      vectorNormImbalance
    };

    // 4. Component-wise Verification
    const xPass = xTerms.absoluteImbalance <= tolerance.absoluteTolerance && xTerms.relativeImbalance <= tolerance.relativeTolerance;
    const yPass = yTerms.absoluteImbalance <= tolerance.absoluteTolerance && yTerms.relativeImbalance <= tolerance.relativeTolerance;
    const zPass = zTerms.absoluteImbalance <= tolerance.absoluteTolerance && zTerms.relativeImbalance <= tolerance.relativeTolerance;

    if (!xPass) diagnostics.push(`Momentum X-component imbalance failed: ${xTerms.absoluteImbalance.toExponential(3)} N (tol: ${tolerance.absoluteTolerance.toExponential(3)})`);
    if (!yPass) diagnostics.push(`Momentum Y-component imbalance failed: ${yTerms.absoluteImbalance.toExponential(3)} N (tol: ${tolerance.absoluteTolerance.toExponential(3)})`);
    if (!zPass) diagnostics.push(`Momentum Z-component imbalance failed: ${zTerms.absoluteImbalance.toExponential(3)} N (tol: ${tolerance.absoluteTolerance.toExponential(3)})`);

    if (xPass && yPass && zPass) {
      return {
        verdict: "MOMENTUM_CONVERGED",
        componentTerms,
        diagnostics: [`All 3 momentum component balances satisfied. Vector norm imbalance: ${vectorNormImbalance.toExponential(3)} N`]
      };
    } else {
      return {
        verdict: "MOMENTUM_CONSERVATION_FAILURE",
        componentTerms,
        diagnostics
      };
    }
  }
}
