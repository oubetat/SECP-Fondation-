/**
 * SECP Engineering Truth OS — Spatial Multilayer PCB Thermal Model
 * Canonical Definitions, Material Properties, Layer Stackups, and Deterministic Digest.
 */

import { createHash } from 'crypto';

export type PcbLayerMaterialType = 'COPPER' | 'FR4' | 'POLYIMIDE' | 'ALUMINUM' | 'SOLDERMASK' | 'CUSTOM';

export interface PcbStackupLayer {
  id: string;
  name: string;
  material: PcbLayerMaterialType;
  thicknessMm: number;
  thermalConductivityWMK: number; // e.g. 390 for Cu, 0.3 for FR4
  copperCoverageRatio?: number; // 0.0 to 1.0 (e.g. 1.0 for solid power plane, 0.25 for signal routing)
  layerType: 'SIGNAL' | 'PLANE' | 'DIELECTRIC' | 'CORE' | 'PREPREG' | 'SURFACE';
}

export interface PcbThermalViaArray {
  id: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  viaCount: number;
  drillDiameterMm: number;
  platingThicknessMm?: number; // Default 0.025 mm (25 microns)
  filledConductive?: boolean;
}

export interface ComponentThermalSpec {
  refDes: string;
  powerDissipationWatts: number;
  xMm: number; // Centroid X
  yMm: number; // Centroid Y
  widthMm: number;
  heightMm: number;
  rThetaJC_CW?: number; // Junction-to-case thermal resistance [K/W or °C/W]
  rThetaCS_CW?: number; // Case-to-sink/board thermal resistance [K/W or °C/W]
  maxJunctionTempC?: number; // Maximum rated junction temperature (e.g. 125°C or 150°C)
  maxCaseTempC?: number; // Maximum rated case temperature
}

export interface PrescribedThermalBoundary {
  id: string;
  xMm: number;
  yMm: number;
  radiusMm?: number; // Radius of contact area, or point if 0
  temperatureC: number;
  contactResistanceCW?: number; // Finite thermal resistance to sink (0 for ideal Dirichlet)
  description?: string;
}

export interface ThermalBoundaryCondition {
  ambientTemperatureC: number;
  convectionCoeffTopWM2K: number; // Natural convection: 5-15 W/m²K, Forced: 20-80 W/m²K
  convectionCoeffBottomWM2K: number;
  convectionCoeffEdgesWM2K?: number; // Default: 0 (adiabatic edges)
  prescribedBoundaries?: PrescribedThermalBoundary[];
}

export interface PcbThermalBoardConfig {
  designId?: string;
  boardWidthMm: number;
  boardHeightMm: number;
  layers: PcbStackupLayer[];
  viaArrays?: PcbThermalViaArray[];
  components: ComponentThermalSpec[];
  boundaryConditions: ThermalBoundaryCondition;
  gridResolutionX?: number; // Default 20
  gridResolutionY?: number; // Default 20
}

/**
 * Standard default material thermal conductivities [W/m·K]
 */
export const STANDARD_THERMAL_CONDUCTIVITIES: Record<PcbLayerMaterialType, number> = {
  COPPER: 390.0,
  FR4: 0.30,
  POLYIMIDE: 0.28,
  ALUMINUM: 205.0,
  SOLDERMASK: 0.20,
  CUSTOM: 1.0
};

/**
 * Standard 4-Layer PCB Stackup Preset (1.6mm total thickness)
 * Top Copper (1oz = 35um) -> Prepreg (0.2mm) -> Inner Copper 1 (1oz) -> Core (1.06mm) -> Inner Copper 2 (1oz) -> Prepreg (0.2mm) -> Bottom Copper (1oz)
 */
export function createStandard4LayerStackup(copperWeightOz: number = 1.0): PcbStackupLayer[] {
  const cuThickMm = copperWeightOz * 0.035; // 35 um per oz
  return [
    {
      id: 'L1_TOP',
      name: 'Top Layer (Signal/Component)',
      material: 'COPPER',
      thicknessMm: cuThickMm,
      thermalConductivityWMK: STANDARD_THERMAL_CONDUCTIVITIES.COPPER,
      copperCoverageRatio: 0.35,
      layerType: 'SIGNAL'
    },
    {
      id: 'DIEL_1',
      name: 'Prepreg 1080/2116',
      material: 'FR4',
      thicknessMm: 0.20,
      thermalConductivityWMK: STANDARD_THERMAL_CONDUCTIVITIES.FR4,
      copperCoverageRatio: 0.0,
      layerType: 'PREPREG'
    },
    {
      id: 'L2_GND',
      name: 'Inner Layer 1 (GND Plane)',
      material: 'COPPER',
      thicknessMm: cuThickMm,
      thermalConductivityWMK: STANDARD_THERMAL_CONDUCTIVITIES.COPPER,
      copperCoverageRatio: 0.90, // Solid ground plane
      layerType: 'PLANE'
    },
    {
      id: 'CORE_1',
      name: 'FR4 Core',
      material: 'FR4',
      thicknessMm: 1.06,
      thermalConductivityWMK: STANDARD_THERMAL_CONDUCTIVITIES.FR4,
      copperCoverageRatio: 0.0,
      layerType: 'CORE'
    },
    {
      id: 'L3_PWR',
      name: 'Inner Layer 2 (Power Plane)',
      material: 'COPPER',
      thicknessMm: cuThickMm,
      thermalConductivityWMK: STANDARD_THERMAL_CONDUCTIVITIES.COPPER,
      copperCoverageRatio: 0.85, // Power plane with isolation channels
      layerType: 'PLANE'
    },
    {
      id: 'DIEL_2',
      name: 'Prepreg 1080/2116',
      material: 'FR4',
      thicknessMm: 0.20,
      thermalConductivityWMK: STANDARD_THERMAL_CONDUCTIVITIES.FR4,
      copperCoverageRatio: 0.0,
      layerType: 'PREPREG'
    },
    {
      id: 'L4_BOT',
      name: 'Bottom Layer (Signal)',
      material: 'COPPER',
      thicknessMm: cuThickMm,
      thermalConductivityWMK: STANDARD_THERMAL_CONDUCTIVITIES.COPPER,
      copperCoverageRatio: 0.30,
      layerType: 'SIGNAL'
    }
  ];
}

/**
 * Computes deterministic cryptographic digest of a PCB Thermal Configuration
 */
export function computePcbThermalCanonicalHash(config: PcbThermalBoardConfig): string {
  const normalized = {
    designId: config.designId || 'SECP-PCB-THERMAL-CONFIG',
    boardWidthMm: Number(config.boardWidthMm.toFixed(4)),
    boardHeightMm: Number(config.boardHeightMm.toFixed(4)),
    layers: config.layers.map(l => ({
      id: l.id,
      mat: l.material,
      t: Number(l.thicknessMm.toFixed(5)),
      k: Number(l.thermalConductivityWMK.toFixed(2)),
      cov: Number((l.copperCoverageRatio ?? 1.0).toFixed(4))
    })),
    viaArrays: (config.viaArrays || []).map(v => ({
      id: v.id,
      x: Number(v.xMm.toFixed(3)),
      y: Number(v.yMm.toFixed(3)),
      w: Number(v.widthMm.toFixed(3)),
      h: Number(v.heightMm.toFixed(3)),
      cnt: v.viaCount,
      drill: Number(v.drillDiameterMm.toFixed(3))
    })).sort((a, b) => a.id.localeCompare(b.id)),
    components: config.components.map(c => ({
      refDes: c.refDes,
      P: Number(c.powerDissipationWatts.toFixed(4)),
      x: Number(c.xMm.toFixed(3)),
      y: Number(c.yMm.toFixed(3)),
      w: Number(c.widthMm.toFixed(3)),
      h: Number(c.heightMm.toFixed(3)),
      rJC: c.rThetaJC_CW !== undefined ? Number(c.rThetaJC_CW.toFixed(3)) : null,
      rCS: c.rThetaCS_CW !== undefined ? Number(c.rThetaCS_CW.toFixed(3)) : null
    })).sort((a, b) => a.refDes.localeCompare(b.refDes)),
    boundaryConditions: {
      ambientC: Number(config.boundaryConditions.ambientTemperatureC.toFixed(2)),
      hTop: Number(config.boundaryConditions.convectionCoeffTopWM2K.toFixed(2)),
      hBot: Number(config.boundaryConditions.convectionCoeffBottomWM2K.toFixed(2)),
      hEdge: Number((config.boundaryConditions.convectionCoeffEdgesWM2K || 0).toFixed(2)),
      prescribed: (config.boundaryConditions.prescribedBoundaries || []).map(p => ({
        id: p.id,
        x: Number(p.xMm.toFixed(3)),
        y: Number(p.yMm.toFixed(3)),
        T: Number(p.temperatureC.toFixed(2)),
        rContact: p.contactResistanceCW !== undefined ? Number(p.contactResistanceCW.toFixed(3)) : 0
      })).sort((a, b) => a.id.localeCompare(b.id))
    }
  };

  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 16);
}
