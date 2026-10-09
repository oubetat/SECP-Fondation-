/**
 * SECP — ADSE-P7 Power Budget & Balance Engine
 * 
 * Computes authoritative electrical power balance across operating states:
 * P_available >= P_required + P_losses + P_reserveMargin
 */

import { PowerBudgetSummary } from './types';
import { PowerRegistry } from './PowerRegistry';
import { PowerTopologyEngine } from './PowerTopologyEngine';
import { PowerConversionAndStorageEngine } from './PowerConversionAndStorageEngine';

export class PowerBudgetEngine {
  constructor(
    private registry: PowerRegistry,
    private topology: PowerTopologyEngine,
    private conversion: PowerConversionAndStorageEngine
  ) {}

  /**
   * Computes authoritative power budget for a specific operating state.
   */
  public computeStateBudget(operatingStateId: string): PowerBudgetSummary {
    const state = this.registry.getOperatingState(operatingStateId);
    if (!state) {
      throw new Error(`OPERATING_STATE_NOT_FOUND: Operating state '${operatingStateId}' not found.`);
    }

    // 1. Total Generation Capacity from active sources
    const activeSources = state.activeSourceIds
      .map(id => this.registry.getSource(id))
      .filter(s => s !== undefined);

    let totalGenerationCapacityWatts = activeSources.reduce(
      (sum, src) => sum + src.ratedContinuousPowerWatts,
      0
    );

    // 2. Total Demand from active loads
    const activeLoads = state.activeLoadIds
      .map(id => this.registry.getLoad(id))
      .filter(l => l !== undefined);

    let totalActiveDemandWatts = 0;
    let totalDistributionLossesWatts = 0;

    for (const load of activeLoads) {
      const scale = state.loadScalingFactors[load.loadId] ?? 1.0;
      const effectiveDemand = load.nominalDemandWatts * scale * load.dutyCycle;
      totalActiveDemandWatts += effectiveDemand;

      // Approximate distribution loss across connecting branch if present
      const pathInfo = this.topology.tracePathToLoad(load.loadId);
      if (pathInfo.branch && pathInfo.bus) {
        const branchCurrent = effectiveDemand / pathInfo.bus.nominalVoltageV;
        const lineLoss = Math.pow(branchCurrent, 2) * pathInfo.branch.lineResistanceOhms;
        totalDistributionLossesWatts += lineLoss;
      }
    }

    // 3. Converter Losses
    let totalConverterLossesWatts = 0;
    for (const convId of state.activeConverterIds) {
      const conv = this.registry.getConverter(convId);
      if (conv) {
        // Approximate converter throughput based on connected bus loads
        const convPoint = this.conversion.computeConverterOperatingPoint(convId, conv.ratedPowerWatts * 0.5);
        totalConverterLossesWatts += convPoint.conversionLossWatts;
      }
    }

    // 4. Storage Contribution (if generation capacity < demand and storage is enabled)
    let batteryDischargePowerWatts = 0;
    let batteryDepletionRatePercentPerHour = 0;

    const totalSystemDemandWithLosses = totalActiveDemandWatts + totalDistributionLossesWatts + totalConverterLossesWatts;

    if (totalSystemDemandWithLosses > totalGenerationCapacityWatts && state.storageDischargeEnabled) {
      const storages = this.registry.getStoragesForSystem(state.systemId);
      const activeStorage = storages[0];
      if (activeStorage) {
        const deficitWatts = totalSystemDemandWithLosses - totalGenerationCapacityWatts;
        batteryDischargePowerWatts = deficitWatts;
        totalGenerationCapacityWatts += deficitWatts; // Storage supplements generation
        batteryDepletionRatePercentPerHour = (deficitWatts / activeStorage.nameplateCapacityWh) * 100.0;
      }
    }

    const netReserveMarginWatts = totalGenerationCapacityWatts - totalSystemDemandWithLosses;
    const reserveMarginPercent = totalGenerationCapacityWatts > 0 
      ? (netReserveMarginWatts / totalGenerationCapacityWatts) * 100.0
      : 0;

    return {
      stateId: state.stateId,
      mode: state.mode,
      totalGenerationCapacityWatts: Number(totalGenerationCapacityWatts.toFixed(2)),
      totalActiveDemandWatts: Number(totalActiveDemandWatts.toFixed(2)),
      totalDistributionLossesWatts: Number(totalDistributionLossesWatts.toFixed(2)),
      totalConverterLossesWatts: Number(totalConverterLossesWatts.toFixed(2)),
      netReserveMarginWatts: Number(netReserveMarginWatts.toFixed(2)),
      reserveMarginPercent: Number(reserveMarginPercent.toFixed(2)),
      isPositiveMargin: netReserveMarginWatts >= 0,
      batteryDischargePowerWatts: Number(batteryDischargePowerWatts.toFixed(2)),
      batteryDepletionRatePercentPerHour: Number(batteryDepletionRatePercentPerHour.toFixed(2))
    };
  }
}
