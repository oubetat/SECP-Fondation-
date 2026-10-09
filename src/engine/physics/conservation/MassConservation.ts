/**
 * SECP Industrial OS v2 — Mass Conservation Evaluator
 * PATCH-050: Conservation Framework
 */

import { 
  MassFluxData, 
  MassConservationResult, 
  SystemType, 
  AnalysisType, 
  ToleranceConfig,
  DomainBalanceTerms
} from "./ConservationTypes";
import { UnitsEngine } from "../units/UnitsEngine";

export class MassConservationEvaluator {

  public static evaluate(
    massData: MassFluxData | undefined,
    systemType: SystemType,
    analysisType: AnalysisType,
    tolerance: ToleranceConfig
  ): MassConservationResult {
    const diagnostics: string[] = [];

    // 1. Data Availability Check
    if (!massData) {
      return {
        verdict: "MASS_UNPROVEN",
        diagnostics: ["Mass flux data is completely missing"]
      };
    }

    const inlets = massData.inletMassFlows ?? [];
    const outlets = massData.outletMassFlows ?? [];
    const sources = massData.massSources ?? [];
    const storage = massData.transientStorageRate;

    if (systemType === "OPEN_SYSTEM" || systemType === "CONTROL_VOLUME" || systemType === "DOMAIN_BALANCE") {
      if (inlets.length === 0 && outlets.length === 0 && sources.length === 0) {
        return {
          verdict: "MASS_UNPROVEN",
          diagnostics: [`System type ${systemType} requires inlet/outlet mass boundary or source data, but none was provided`]
        };
      }
    }

    if (analysisType === "TRANSIENT" && !storage) {
      diagnostics.push("Transient analysis specified, but transient storage term (d/dt ∫ρ dV) was not provided");
      return {
        verdict: "MASS_UNPROVEN",
        diagnostics
      };
    }

    // 2. Unit Validation (PATCH-043)
    const allFluxes = [...inlets, ...outlets, ...sources];
    if (storage) allFluxes.push({ boundaryId: "storage", value: storage.value, unit: storage.unit });

    for (const flux of allFluxes) {
      if (isNaN(flux.value) || !isFinite(flux.value)) {
        return {
          verdict: "MASS_INVALID",
          diagnostics: [`Invalid non-finite mass flux value detected: ${flux.value} on ${(flux as any).boundaryId}`]
        };
      }

      if (flux.value < 0) {
        return {
          verdict: "MASS_INVALID",
          diagnostics: [`Negative mass flux value (${flux.value}) detected on boundary/source ${(flux as any).boundaryId}. Flow direction must be indicated via inlet/outlet classification, not negative scalar magnitudes.`]
        };
      }

      // Check unit compatibility with kg/s
      if (flux.unit) {
        const unitCheck = UnitsEngine.convertUnit(1, flux.unit, "kg/s");
        if (!unitCheck.valid) {
          return {
            verdict: "MASS_INVALID",
            diagnostics: [`Incompatible mass flow unit '${flux.unit}' on ${(flux as any).boundaryId}: ${unitCheck.errors.join("; ")}`]
          };
        }
      } else {
        return {
          verdict: "MASS_INVALID",
          diagnostics: [`Missing unit declaration on mass flux boundary/source ${(flux as any).boundaryId}`]
        };
      }
    }

    // 3. Balance Calculations (Converted to standard kg/s)
    let totalIn = 0;
    for (const f of inlets) {
      const conv = UnitsEngine.convertUnit(f.value, f.unit, "kg/s");
      totalIn += conv.value ?? f.value;
    }

    let totalOut = 0;
    for (const f of outlets) {
      const conv = UnitsEngine.convertUnit(f.value, f.unit, "kg/s");
      totalOut += conv.value ?? f.value;
    }

    let totalSource = 0;
    for (const s of sources) {
      const conv = UnitsEngine.convertUnit(s.value, s.unit, "kg/s");
      totalSource += conv.value ?? s.value;
    }

    let totalStorage = 0;
    if (analysisType === "TRANSIENT" && storage) {
      const conv = UnitsEngine.convertUnit(storage.value, storage.unit, "kg/s");
      totalStorage = conv.value ?? storage.value;
    }

    // Conservation equation: Total In + Total Source = Total Out + Total Storage
    // Imbalance = (In + Source) - (Out + Storage)
    const absoluteImbalance = Math.abs((totalIn + totalSource) - (totalOut + totalStorage));

    // Normalization
    let relativeImbalance = absoluteImbalance;
    const floor = 1e-12;

    if (tolerance.normalizationMethod === "INLET_FLUX") {
      const ref = Math.max(totalIn, floor);
      relativeImbalance = absoluteImbalance / ref;
    } else if (tolerance.normalizationMethod === "TOTAL_CAPACITY") {
      const ref = Math.max(totalIn + totalOut + Math.abs(totalStorage), floor);
      relativeImbalance = absoluteImbalance / ref;
    } else if (tolerance.normalizationMethod === "REFERENCE_VALUE" && tolerance.referenceValue) {
      const ref = Math.max(Math.abs(tolerance.referenceValue), floor);
      relativeImbalance = absoluteImbalance / ref;
    }

    const balanceTerms: DomainBalanceTerms = {
      totalIn,
      totalOut,
      totalStorage,
      totalSource,
      absoluteImbalance,
      relativeImbalance,
      unit: "kg/s"
    };

    // 4. Tolerance Decision
    const passesAbs = absoluteImbalance <= tolerance.absoluteTolerance;
    const passesRel = relativeImbalance <= tolerance.relativeTolerance;

    if (passesAbs && passesRel) {
      return {
        verdict: "MASS_CONVERGED",
        balanceTerms,
        diagnostics: [
          `Mass balance satisfied. Absolute imbalance: ${absoluteImbalance.toExponential(3)} kg/s <= ${tolerance.absoluteTolerance.toExponential(3)} kg/s, Relative imbalance: ${relativeImbalance.toExponential(3)} <= ${tolerance.relativeTolerance.toExponential(3)}`
        ]
      };
    } else {
      return {
        verdict: "MASS_CONSERVATION_FAILURE",
        balanceTerms,
        diagnostics: [
          `Mass conservation failure. Absolute imbalance: ${absoluteImbalance.toExponential(3)} kg/s (tol: ${tolerance.absoluteTolerance.toExponential(3)}), Relative imbalance: ${relativeImbalance.toExponential(3)} (tol: ${tolerance.relativeTolerance.toExponential(3)})`
        ]
      };
    }
  }
}
