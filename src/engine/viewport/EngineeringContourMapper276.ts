/**
 * PATCH-276: Engineering Contour Mapper
 * Maps scalar/vector CAE simulation results to continuous color scales (Rainbow, Jet, Viridis, Cool-Warm),
 * produces legend bins, unit metadata, and handles NO DATA gracefully.
 */

import {
  CaeFieldType,
  ContourScale,
  SimulationResultOverlay,
} from './ViewportTypes276';

export class EngineeringContourMapper {
  public static mapValueToColorHex(
    val: number,
    minVal: number,
    maxVal: number,
    palette: ContourScale['colorPalette'] = 'RAINBOW'
  ): string {
    if (isNaN(val) || minVal >= maxVal) return '#64748b'; // Gray fallback

    const t = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal)));

    switch (palette) {
      case 'JET':
        return this.jetRamp(t);
      case 'VIRIDIS':
        return this.viridisRamp(t);
      case 'COOL_WARM':
        return this.coolWarmRamp(t);
      case 'RAINBOW':
      default:
        return this.rainbowRamp(t);
    }
  }

  private static rainbowRamp(t: number): string {
    // Blue (0) -> Cyan -> Green -> Yellow -> Red (1)
    const hue = (1 - t) * 240; // 240 is blue, 0 is red
    return `hsl(${hue}, 100%, 50%)`;
  }

  private static jetRamp(t: number): string {
    const r = Math.max(0, Math.min(1, 1.5 - Math.abs(t * 4 - 3)));
    const g = Math.max(0, Math.min(1, 1.5 - Math.abs(t * 4 - 2)));
    const b = Math.max(0, Math.min(1, 1.5 - Math.abs(t * 4 - 1)));
    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
  }

  private static viridisRamp(t: number): string {
    // Dark purple -> teal -> yellow
    const r = Math.round((0.27 + 0.7 * t) * 255);
    const g = Math.round((0.01 + 0.9 * t) * 255);
    const b = Math.round((0.33 + 0.2 * (1 - t)) * 255);
    return `rgb(${r}, ${g}, ${b})`;
  }

  private static coolWarmRamp(t: number): string {
    // Blue -> White -> Red
    const r = Math.round(t * 255);
    const g = Math.round((1 - Math.abs(t - 0.5) * 2) * 200);
    const b = Math.round((1 - t) * 255);
    return `rgb(${r}, ${g}, ${b})`;
  }

  public static createSampleSimulationOverlay(
    fieldType: CaeFieldType = 'VON_MISES_STRESS',
    geometryRevision: string = 'REV-276.1'
  ): SimulationResultOverlay {
    if (fieldType === 'NONE') {
      return {
        datasetId: 'DS-NONE',
        fieldType: 'NONE',
        associatedModelRevision: geometryRevision,
        isStale: false,
        deformedGeometry: false,
        deformationFactor: 1.0,
        contourScale: {
          minVal: 0,
          maxVal: 0,
          unit: '',
          colorPalette: 'RAINBOW',
          numBins: 5,
          noData: true,
        },
        meshOverlayVisible: false,
      };
    }

    let minVal = 0;
    let maxVal = 250;
    let unit = 'MPa';

    switch (fieldType) {
      case 'VON_MISES_STRESS':
        minVal = 2.4;
        maxVal = 345.8;
        unit = 'MPa';
        break;
      case 'PRINCIPAL_STRESS':
        minVal = -120.0;
        maxVal = 280.5;
        unit = 'MPa';
        break;
      case 'STRAIN':
        minVal = 0.00001;
        maxVal = 0.0024;
        unit = 'm/m';
        break;
      case 'DISPLACEMENT_MAGNITUDE':
        minVal = 0.0;
        maxVal = 0.425;
        unit = 'mm';
        break;
      case 'FACTOR_OF_SAFETY':
        minVal = 0.85;
        maxVal = 4.5;
        unit = 'FoS';
        break;
      case 'CFD_PRESSURE':
        minVal = -15.2;
        maxVal = 101.3;
        unit = 'kPa';
        break;
      case 'CFD_VELOCITY_MAGNITUDE':
        minVal = 0.0;
        maxVal = 64.2;
        unit = 'm/s';
        break;
      case 'CFD_TEMPERATURE':
        minVal = 20.0;
        maxVal = 185.4;
        unit = '°C';
        break;
      case 'CFD_STREAMLINES':
        minVal = 0.0;
        maxVal = 85.0;
        unit = 'm/s';
        break;
    }

    // Generate sample scalar field for 100 node points
    const count = 100;
    const scalarValues = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const frac = i / count;
      scalarValues[i] = minVal + (maxVal - minVal) * Math.pow(frac, 1.5);
    }

    return {
      datasetId: `DS-${fieldType}-${Date.now().toString().slice(-4)}`,
      fieldType,
      associatedModelRevision: geometryRevision,
      isStale: false,
      deformedGeometry: true,
      deformationFactor: fieldType.startsWith('CFD') ? 1.0 : 25.0,
      contourScale: {
        minVal,
        maxVal,
        unit,
        colorPalette: fieldType.startsWith('CFD') ? 'JET' : 'RAINBOW',
        numBins: 6,
        noData: false,
      },
      scalarValues,
      meshOverlayVisible: true,
    };
  }

  public static generateLegendBins(scale: ContourScale): { label: string; colorHex: string; val: number }[] {
    if (scale.noData) {
      return [{ label: 'NO DATA', colorHex: '#64748b', val: 0 }];
    }

    const bins: { label: string; colorHex: string; val: number }[] = [];
    const step = (scale.maxVal - scale.minVal) / Math.max(1, scale.numBins - 1);

    for (let i = 0; i < scale.numBins; i++) {
      const val = scale.minVal + step * i;
      const colorHex = this.mapValueToColorHex(val, scale.minVal, scale.maxVal, scale.colorPalette);
      bins.push({
        label: `${val.toFixed(2)} ${scale.unit}`,
        colorHex,
        val,
      });
    }

    return bins.reverse(); // Top value first
  }
}
