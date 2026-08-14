/**
 * PATCH-SECP-044 — Technical Drawing Standards Layer
 * Formulates ISO (ISO 128, ISO 129, ISO 5455) & ASME (ASME Y14.5, ASME Y14.3) engineering drafting specifications.
 */

import { 
  DrawingStandardType, 
  ProjectionStandard, 
  SheetSize, 
  LineType, 
  DimensionTolerance 
} from './DrawingTypes';

export interface SheetDimensions {
  widthMm: number;
  heightMm: number;
  marginMm: number;
  titleBlockWidthMm: number;
  titleBlockHeightMm: number;
}

export interface LineStyleSpec {
  strokeWidthMm: number;
  strokeDashArray?: string;
  colorHex: string;
  description: string;
}

export class DrawingStandardEngine {
  /**
   * Standard sheet sizes conforming to ISO 216 (A-series) and ANSI / ASME Y14.1
   */
  public static getSheetDimensions(size: SheetSize): SheetDimensions {
    switch (size) {
      case 'A0':
        return { widthMm: 1189, heightMm: 841, marginMm: 20, titleBlockWidthMm: 180, titleBlockHeightMm: 85 };
      case 'A1':
        return { widthMm: 841, heightMm: 594, marginMm: 20, titleBlockWidthMm: 180, titleBlockHeightMm: 85 };
      case 'A2':
        return { widthMm: 594, heightMm: 420, marginMm: 10, titleBlockWidthMm: 180, titleBlockHeightMm: 75 };
      case 'A3':
        return { widthMm: 420, heightMm: 297, marginMm: 10, titleBlockWidthMm: 170, titleBlockHeightMm: 65 };
      case 'A4':
        return { widthMm: 297, heightMm: 210, marginMm: 10, titleBlockWidthMm: 140, titleBlockHeightMm: 55 };
      case 'LETTER':
        return { widthMm: 279.4, heightMm: 215.9, marginMm: 10, titleBlockWidthMm: 140, titleBlockHeightMm: 55 };
      case 'TABLOID':
        return { widthMm: 431.8, heightMm: 279.4, marginMm: 12.7, titleBlockWidthMm: 170, titleBlockHeightMm: 65 };
      case 'ANSI_D':
        return { widthMm: 863.6, heightMm: 558.8, marginMm: 12.7, titleBlockWidthMm: 180, titleBlockHeightMm: 85 };
      default:
        return { widthMm: 420, heightMm: 297, marginMm: 10, titleBlockWidthMm: 170, titleBlockHeightMm: 65 };
    }
  }

  /**
   * ISO 128 / ASME line styles: Visible (0.5mm), Hidden (0.25mm dashed), Center (0.25mm long-dash-dot), etc.
   */
  public static getLineStyle(standard: DrawingStandardType, lineType: LineType): LineStyleSpec {
    const isIso = standard.startsWith('ISO');
    
    switch (lineType) {
      case 'VISIBLE':
        return {
          strokeWidthMm: isIso ? 0.5 : 0.6,
          colorHex: '#0f172a', // crisp dark blueprint line
          description: isIso ? 'ISO 128-20 Type A (Continuous Thick)' : 'ASME Visible Line'
        };
      case 'HIDDEN':
        return {
          strokeWidthMm: isIso ? 0.25 : 0.3,
          strokeDashArray: isIso ? '4,2' : '3,1.5',
          colorHex: '#64748b',
          description: isIso ? 'ISO 128-20 Type E (Dashed Thin)' : 'ASME Hidden Line'
        };
      case 'CENTER':
        return {
          strokeWidthMm: isIso ? 0.25 : 0.3,
          strokeDashArray: isIso ? '10,2,2,2' : '12,2,3,2',
          colorHex: '#0284c7', // Blueprint technical cyan
          description: isIso ? 'ISO 128-20 Type G (Long-dashed Dotted Thin)' : 'ASME Centerline'
        };
      case 'CONSTRUCTION':
      case 'DIMENSION':
        return {
          strokeWidthMm: isIso ? 0.25 : 0.25,
          colorHex: '#0f172a',
          description: 'Continuous Thin Line'
        };
      case 'HATCH':
        return {
          strokeWidthMm: isIso ? 0.25 : 0.25,
          colorHex: '#475569',
          description: 'Section Hatching Line'
        };
      case 'SECTION_CUT':
        return {
          strokeWidthMm: isIso ? 0.5 : 0.6,
          strokeDashArray: '12,3,3,3',
          colorHex: '#be123c',
          description: 'Cutting Plane Line'
        };
    }
  }

  /**
   * Standard Drawing Scales (ISO 5455 / ASME Y14.1)
   */
  public static readonly STANDARD_SCALES = [
    '50:1', '20:1', '10:1', '5:1', '2:1',
    '1:1',
    '1:2', '1:5', '1:10', '1:20', '1:50', '1:100'
  ];

  public static parseScaleRatio(scaleStr: string): number {
    const parts = scaleStr.split(':').map(s => parseFloat(s.trim()));
    if (parts.length === 2 && parts[1] > 0) {
      return parts[0] / parts[1];
    }
    return 1.0;
  }

  /**
   * Format dimension value according to standard decimal separator and precision
   */
  public static formatDimensionText(
    valueMm: number, 
    standard: DrawingStandardType, 
    tolerance?: DimensionTolerance,
    prefix: string = '',
    suffix: string = ''
  ): string {
    const isIso = standard.startsWith('ISO');
    const decimalSep: string = isIso ? '.' : '.'; // ISO standard allows decimal point in CAD interchange
    const precision = tolerance?.precision ?? 1;
    
    let baseStr = valueMm.toFixed(precision);
    if (decimalSep === ',') {
      baseStr = baseStr.replace('.', ',');
    }

    let result = `${prefix}${baseStr}`;

    if (tolerance) {
      if (tolerance.type === 'SYMMETRIC') {
        const tolVal = tolerance.upperMm.toFixed(precision);
        result += ` ±${tolVal}`;
      } else if (tolerance.type === 'DEVIATION') {
        const u = tolerance.upperMm >= 0 ? `+${tolerance.upperMm.toFixed(precision)}` : tolerance.upperMm.toFixed(precision);
        const l = tolerance.lowerMm >= 0 ? `+${tolerance.lowerMm.toFixed(precision)}` : tolerance.lowerMm.toFixed(precision);
        result += ` ${u}/${l}`;
      } else if (tolerance.type === 'BASIC') {
        result = `[ ${result} ]`;
      } else if (tolerance.type === 'REFERENCE') {
        result = `(${result})`;
      }
    }

    if (suffix) {
      result += suffix;
    }

    return result;
  }
}
