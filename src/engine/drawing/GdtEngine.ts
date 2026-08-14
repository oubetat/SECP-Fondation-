/**
 * PATCH-SECP-044 — GD&T (Geometric Dimensioning & Tolerancing) Foundation
 * Formal data models and symbol builders for Feature Control Frames, Datums, and Surface Texture annotations.
 */

import { 
  GdtFeatureControlFrame, 
  GdtCharacteristic, 
  MaterialConditionModifier, 
  DrawingDatum, 
  SurfaceFinishSymbol, 
  Vector2D 
} from './DrawingTypes';

export class GdtEngine {
  /**
   * Unicode / ASCII geometric characteristic symbols
   */
  public static getCharacteristicSymbol(char: GdtCharacteristic): string {
    switch (char) {
      case 'POSITION': return '⌖'; // Position indicator
      case 'FLATNESS': return '⏥'; // Flatness
      case 'PARALLELISM': return '∥'; // Parallelism
      case 'PERPENDICULARITY': return '⟂'; // Perpendicularity
      case 'CONCENTRICITY': return '◎'; // Concentricity
      case 'CYLINDRICITY': return '⌭'; // Cylindricity
      case 'CIRCULAR_RUNOUT': return '↗'; // Circular Runout
      default: return '⌖';
    }
  }

  public static getMaterialModifierSymbol(mod: MaterialConditionModifier): string {
    switch (mod) {
      case 'MMC': return 'Ⓜ';
      case 'LMC': return 'Ⓛ';
      case 'RFS': return 'Ⓢ';
      case 'NONE':
      default: return '';
    }
  }

  /**
   * Creates a formal GD&T Feature Control Frame
   */
  public static createFeatureControlFrame(
    viewId: string,
    characteristic: GdtCharacteristic,
    toleranceValue: number,
    diameterSymbol: boolean,
    primaryDatum: string,
    options?: {
      materialCondition?: MaterialConditionModifier;
      secondaryDatum?: string;
      secondaryMaterialCondition?: MaterialConditionModifier;
      tertiaryDatum?: string;
      tertiaryMaterialCondition?: MaterialConditionModifier;
      position?: Vector2D;
      leaderAnchor?: Vector2D;
    }
  ): GdtFeatureControlFrame {
    return {
      id: `fcf-${Date.now().toString().slice(-4)}`,
      viewId,
      characteristic,
      diameterSymbol,
      toleranceValue,
      materialCondition: options?.materialCondition || 'NONE',
      primaryDatum,
      primaryMaterialCondition: options?.materialCondition || 'NONE',
      secondaryDatum: options?.secondaryDatum,
      secondaryMaterialCondition: options?.secondaryMaterialCondition,
      tertiaryDatum: options?.tertiaryDatum,
      tertiaryMaterialCondition: options?.tertiaryMaterialCondition,
      position: options?.position || { x: 100, y: 100 },
      leaderAnchor: options?.leaderAnchor,
      status: 'SUPPORTED'
    };
  }

  /**
   * Formats the FCF into compartmental text blocks [Sym | Tol M | Datums]
   */
  public static formatControlFrameText(fcf: GdtFeatureControlFrame): {
    symbol: string;
    toleranceText: string;
    datumCompartments: string[];
  } {
    const symbol = this.getCharacteristicSymbol(fcf.characteristic);
    const dia = fcf.diameterSymbol ? 'Ø ' : '';
    const mod = this.getMaterialModifierSymbol(fcf.materialCondition);
    const tolText = `${dia}${fcf.toleranceValue.toFixed(3)}${mod ? ' ' + mod : ''}`;

    const datumCompartments: string[] = [];
    if (fcf.primaryDatum) {
      const pMod = fcf.primaryMaterialCondition ? this.getMaterialModifierSymbol(fcf.primaryMaterialCondition) : '';
      datumCompartments.push(`${fcf.primaryDatum}${pMod ? ' ' + pMod : ''}`);
    }
    if (fcf.secondaryDatum) {
      const sMod = fcf.secondaryMaterialCondition ? this.getMaterialModifierSymbol(fcf.secondaryMaterialCondition) : '';
      datumCompartments.push(`${fcf.secondaryDatum}${sMod ? ' ' + sMod : ''}`);
    }
    if (fcf.tertiaryDatum) {
      const tMod = fcf.tertiaryMaterialCondition ? this.getMaterialModifierSymbol(fcf.tertiaryMaterialCondition) : '';
      datumCompartments.push(`${fcf.tertiaryDatum}${tMod ? ' ' + tMod : ''}`);
    }

    return {
      symbol,
      toleranceText: tolText,
      datumCompartments
    };
  }
}
