/**
 * SECP Industrial OS v2 — Energy Conservation Evaluator
 * PATCH-050: Conservation Framework
 */

import { 
  EnergyFluxData, 
  EnergyConservationResult, 
  SystemType, 
  AnalysisType, 
  ToleranceConfig,
  DomainBalanceTerms
} from "./ConservationTypes";
import { UnitsEngine } from "../units/UnitsEngine";

export class EnergyConservationEvaluator {

  public static evaluate(
    energyData: EnergyFluxData | undefined,
    systemType: SystemType,
    analysisType: AnalysisType,
    tolerance: ToleranceConfig
  ): EnergyConservationResult {
    const diagnostics: string[] = [];
    const availableTerms: string[] = [];
    const missingTerms: string[] = [];

    // 1. Data Availability & Explicit Zero Declarations
    if (!energyData) {
      return {
        verdict: "ENERGY_UNPROVEN",
        availableTerms: [],
        missingTerms: ["convectiveEnergy", "conductiveHeatFlux", "workOrPressurePower", "volumetricSources"],
        diagnostics: ["Energy flux data is completely missing"]
      };
    }

    const declaredZero = new Set(energyData.declaredZeroTerms ?? []);

    const convIn = energyData.convectiveEnergyIn ?? [];
    const convOut = energyData.convectiveEnergyOut ?? [];
    if (convIn.length > 0 || convOut.length > 0) availableTerms.push("convectiveEnergy");
    else if (declaredZero.has("convectiveEnergy")) availableTerms.push("convectiveEnergy (declared zero)");
    else missingTerms.push("convectiveEnergy");

    const condIn = energyData.conductiveHeatFluxIn ?? [];
    const condOut = energyData.conductiveHeatFluxOut ?? [];
    if (condIn.length > 0 || condOut.length > 0) availableTerms.push("conductiveHeatFlux");
    else if (declaredZero.has("conductiveHeatFlux")) availableTerms.push("conductiveHeatFlux (declared zero)");
    else missingTerms.push("conductiveHeatFlux");

    const workPower = energyData.workOrPressurePower ?? [];
    if (workPower.length > 0) availableTerms.push("workOrPressurePower");
    else if (declaredZero.has("workOrPressurePower")) availableTerms.push("workOrPressurePower (declared zero)");
    else missingTerms.push("workOrPressurePower");

    const volSources = energyData.volumetricSources ?? [];
    if (volSources.length > 0) availableTerms.push("volumetricSources");
    else if (declaredZero.has("volumetricSources")) availableTerms.push("volumetricSources (declared zero)");
    else missingTerms.push("volumetricSources");

    const storage = energyData.transientStorageRate;
    if (analysisType === "TRANSIENT") {
      if (storage) availableTerms.push("transientStorageRate");
      else if (declaredZero.has("transientStorageRate")) availableTerms.push("transientStorageRate (declared zero)");
      else missingTerms.push("transientStorageRate");
    }

    // Require at least 2 categories of terms or explicit declarations to consider balance evaluate-able
    if (missingTerms.length > 2) {
      return {
        verdict: "ENERGY_UNPROVEN",
        availableTerms,
        missingTerms,
        diagnostics: [`Energy conservation is UNPROVEN because essential energy terms are missing without being declared zero: ${missingTerms.join(", ")}`]
      };
    }

    // 2. Unit Validation (PATCH-043)
    const allFluxes = [
      ...convIn, ...convOut, ...condIn, ...condOut, ...workPower, ...volSources
    ];
    if (storage) allFluxes.push({ boundaryId: "storage", value: storage.value, unit: storage.unit });

    for (const f of allFluxes) {
      if (isNaN(f.value) || !isFinite(f.value)) {
        return {
          verdict: "ENERGY_INVALID",
          availableTerms,
          missingTerms,
          diagnostics: [`Invalid non-finite energy value detected on ${((f as any).boundaryId || (f as any).sourceId)}: ${f.value}`]
        };
      }

      if (f.unit) {
        const unitCheck = UnitsEngine.convertUnit(1, f.unit, "W");
        if (!unitCheck.valid) {
          return {
            verdict: "ENERGY_INVALID",
            availableTerms,
            missingTerms,
            diagnostics: [`Incompatible energy power unit '${f.unit}' on ${((f as any).boundaryId || (f as any).sourceId)}: ${unitCheck.errors.join("; ")}`]
          };
        }
      } else {
        return {
          verdict: "ENERGY_INVALID",
          availableTerms,
          missingTerms,
          diagnostics: [`Missing unit declaration on energy flux boundary/source ${((f as any).boundaryId || (f as any).sourceId)}`]
        };
      }
    }

    // 3. Balance Calculations (Converted to W)
    let totalIn = 0;
    for (const f of [...convIn, ...condIn, ...workPower]) {
      const conv = UnitsEngine.convertUnit(f.value, f.unit, "W");
      totalIn += conv.value ?? f.value;
    }

    let totalOut = 0;
    for (const f of [...convOut, ...condOut]) {
      const conv = UnitsEngine.convertUnit(f.value, f.unit, "W");
      totalOut += conv.value ?? f.value;
    }

    let totalSource = 0;
    for (const f of volSources) {
      const conv = UnitsEngine.convertUnit(f.value, f.unit, "W");
      totalSource += conv.value ?? f.value;
    }

    let totalStorage = 0;
    if (analysisType === "TRANSIENT" && storage) {
      const conv = UnitsEngine.convertUnit(storage.value, storage.unit, "W");
      totalStorage = conv.value ?? storage.value;
    }

    const absoluteImbalance = Math.abs((totalIn + totalSource) - (totalOut + totalStorage));
    const floor = 1e-12;
    let relativeImbalance = absoluteImbalance;

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
      unit: "W"
    };

    // 4. Decision
    const passesAbs = absoluteImbalance <= tolerance.absoluteTolerance;
    const passesRel = relativeImbalance <= tolerance.relativeTolerance;

    if (passesAbs && passesRel) {
      return {
        verdict: "ENERGY_CONVERGED",
        balanceTerms,
        availableTerms,
        missingTerms,
        diagnostics: [`Energy balance satisfied. Absolute imbalance: ${absoluteImbalance.toExponential(3)} W, Relative: ${relativeImbalance.toExponential(3)}`]
      };
    } else {
      return {
        verdict: "ENERGY_CONSERVATION_FAILURE",
        balanceTerms,
        availableTerms,
        missingTerms,
        diagnostics: [`Energy conservation failure. Absolute imbalance: ${absoluteImbalance.toExponential(3)} W (tol: ${tolerance.absoluteTolerance.toExponential(3)}), Relative: ${relativeImbalance.toExponential(3)}`]
      };
    }
  }
}
