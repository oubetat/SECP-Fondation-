/**
 * SECP ECAD-Thermal Multi-Physics Bridge
 * Automatically projects PcbCanonicalModel geometry, placements, and stackup
 * into authoritative Spatial Thermal Solver configuration.
 */

import { PcbCanonicalModel } from './PcbCanonicalModel';
import {
  PcbThermalBoardConfig,
  ComponentThermalSpec,
  createStandard4LayerStackup,
  PcbStackupLayer,
  STANDARD_THERMAL_CONDUCTIVITIES
} from '../engineeringCore/PcbThermalModel';
import {
  SpatialThermalSolver,
  SpatialThermalFieldResult
} from '../engineeringCore/SpatialThermalSolver';

export class PcbThermalBridge {
  /**
   * Builds an authoritative PcbThermalBoardConfig directly from a PcbCanonicalModel.
   */
  public static buildThermalConfig(
    pcb: PcbCanonicalModel,
    powerDissipations: Record<string, number> = {},
    ambientTempC: number = 25.0,
    forcedAirH_WM2K: number = 15.0
  ): PcbThermalBoardConfig {
    // Generate stackup based on layerCount
    let layers: PcbStackupLayer[];
    if (pcb.layerCount >= 4) {
      layers = createStandard4LayerStackup(1.0);
    } else {
      layers = [
        {
          id: 'L1_TOP',
          name: 'Top Copper',
          material: 'COPPER',
          thicknessMm: 0.035,
          thermalConductivityWMK: STANDARD_THERMAL_CONDUCTIVITIES.COPPER,
          copperCoverageRatio: 0.5,
          layerType: 'SIGNAL'
        },
        {
          id: 'CORE',
          name: 'FR4 Core',
          material: 'FR4',
          thicknessMm: Math.max(0.2, pcb.thicknessMm - 0.07),
          thermalConductivityWMK: STANDARD_THERMAL_CONDUCTIVITIES.FR4,
          copperCoverageRatio: 0.0,
          layerType: 'CORE'
        },
        {
          id: 'L2_BOT',
          name: 'Bottom Copper',
          material: 'COPPER',
          thicknessMm: 0.035,
          thermalConductivityWMK: STANDARD_THERMAL_CONDUCTIVITIES.COPPER,
          copperCoverageRatio: 0.5,
          layerType: 'SIGNAL'
        }
      ];
    }

    // Map components from placements and power ratings
    const components: ComponentThermalSpec[] = pcb.placements.map(plc => {
      const power = powerDissipations[plc.refDes] ?? 0.0;
      return {
        refDes: plc.refDes,
        powerDissipationWatts: power,
        xMm: plc.xMm,
        yMm: plc.yMm,
        widthMm: plc.widthMm,
        heightMm: plc.heightMm,
        rThetaJC_CW: 2.5,
        rThetaCS_CW: 0.8,
        maxJunctionTempC: 125.0,
        maxCaseTempC: 105.0
      };
    });

    // Map mounting holes as chassis contact sinks (if grounded/conductive)
    const prescribedBoundaries = (pcb.mountingHoles || []).map(hole => ({
      id: hole.id,
      xMm: hole.x,
      yMm: hole.y,
      radiusMm: hole.diameterMm / 2.0,
      temperatureC: ambientTempC,
      contactResistanceCW: hole.isPlated ? 1.5 : 5.0,
      description: `Mounting hole chassis thermal path ${hole.id}`
    }));

    return {
      designId: pcb.designId || 'SECP-PCB-CANONICAL',
      boardWidthMm: pcb.boardWidthMm,
      boardHeightMm: pcb.boardHeightMm,
      layers,
      components,
      boundaryConditions: {
        ambientTemperatureC: ambientTempC,
        convectionCoeffTopWM2K: forcedAirH_WM2K,
        convectionCoeffBottomWM2K: forcedAirH_WM2K * 0.7, // Lower convection on bottom surface
        convectionCoeffEdgesWM2K: forcedAirH_WM2K * 0.5,
        prescribedBoundaries
      },
      gridResolutionX: 25,
      gridResolutionY: 25
    };
  }

  /**
   * Solves spatial thermal field directly on the PCB Canonical Model.
   */
  public static solvePcb(
    pcb: PcbCanonicalModel,
    powerDissipations: Record<string, number> = {},
    ambientTempC: number = 25.0
  ): SpatialThermalFieldResult {
    const config = this.buildThermalConfig(pcb, powerDissipations, ambientTempC);
    return SpatialThermalSolver.solve(config);
  }
}
