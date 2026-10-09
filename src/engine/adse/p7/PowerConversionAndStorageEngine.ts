/**
 * SECP — ADSE-P7 Power Conversion & Storage Engine
 * 
 * Manages power conversion (DC/DC, AC/DC, DC/AC) and energy storage states (batteries).
 * Computes:
 * - Conversion efficiencies and electrical dissipation losses ($P_{loss} = P_{in} - P_{out}$)
 * - Storage state of charge (SoC) depletion/charging and C-rate limit verification
 * - Internal impedance losses ($I^2 \cdot R_{int}$)
 */

import { PowerConverter, PowerStorage } from './types';
import { PowerRegistry } from './PowerRegistry';

export class PowerConversionAndStorageEngine {
  private registry: PowerRegistry;

  constructor(registry: PowerRegistry) {
    this.registry = registry;
  }

  /**
   * Computes converter operating point given required output load power.
   */
  public computeConverterOperatingPoint(
    converterId: string,
    outputDemandWatts: number
  ): {
    converter: PowerConverter;
    inputPowerWatts: number;
    outputPowerWatts: number;
    conversionLossWatts: number;
    isOverloaded: boolean;
  } {
    const converter = this.registry.getConverter(converterId);
    if (!converter) {
      throw new Error(`CONVERTER_NOT_FOUND: Converter '${converterId}' not found.`);
    }

    if (outputDemandWatts < 0) {
      throw new Error(`INVALID_DEMAND: Output demand cannot be negative.`);
    }

    const isOverloaded = outputDemandWatts > converter.ratedPowerWatts;
    const efficiency = converter.efficiencyPercent / 100.0;

    // Pin = (Pout / eta) + fixedNoLoadLoss
    const inputPowerWatts = outputDemandWatts > 0 
      ? (outputDemandWatts / efficiency) + converter.fixedNoLoadLossWatts
      : converter.fixedNoLoadLossWatts;

    const conversionLossWatts = inputPowerWatts - outputDemandWatts;

    return {
      converter,
      inputPowerWatts,
      outputPowerWatts: outputDemandWatts,
      conversionLossWatts,
      isOverloaded
    };
  }

  /**
   * Computes storage discharge metrics for a given duration.
   */
  public computeStorageDischarge(
    storageId: string,
    dischargePowerWatts: number,
    durationHours: number
  ): {
    storage: PowerStorage;
    dischargeCurrentAmps: number;
    initialSocPercent: number;
    finalSocPercent: number;
    energyDrawnWh: number;
    internalResistanceLossWatts: number;
    isDepleted: boolean;
    isMaxCRateExceeded: boolean;
  } {
    const storage = this.registry.getStorage(storageId);
    if (!storage) {
      throw new Error(`STORAGE_NOT_FOUND: Storage '${storageId}' not found.`);
    }

    const dischargeCurrentAmps = dischargePowerWatts / storage.nominalVoltageV;
    const maxAllowableCurrent = storage.maxDischargeRateC * (storage.nameplateCapacityWh / storage.nominalVoltageV);
    const isMaxCRateExceeded = dischargeCurrentAmps > maxAllowableCurrent;

    const internalResistanceLossWatts = Math.pow(dischargeCurrentAmps, 2) * storage.internalResistanceOhms;
    const totalPowerDrawn = dischargePowerWatts + internalResistanceLossWatts;
    const energyDrawnWh = totalPowerDrawn * durationHours;

    const usableCapacityWh = storage.nameplateCapacityWh * ((storage.usableSocMaxPercent - storage.usableSocMinPercent) / 100.0);
    const deltaSocPercent = (energyDrawnWh / storage.nameplateCapacityWh) * 100.0;
    const finalSocPercent = Math.max(0, storage.stateOfChargePercent - deltaSocPercent);
    const isDepleted = finalSocPercent < storage.usableSocMinPercent;

    return {
      storage,
      dischargeCurrentAmps,
      initialSocPercent: storage.stateOfChargePercent,
      finalSocPercent,
      energyDrawnWh,
      internalResistanceLossWatts,
      isDepleted,
      isMaxCRateExceeded
    };
  }
}
