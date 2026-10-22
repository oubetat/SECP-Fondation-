/**
 * SECP Industrial OS — Engineering Truth OS
 * PcbSignalIntegrityEngine.ts
 * 
 * Implements IPC-2141 based Characteristic Impedance ($Z_0$), propagation delay,
 * and high-speed signal integrity calculators for Microstrip and Stripline traces.
 */

export interface MicrostripParams {
  traceWidthMm: number;
  traceThicknessUm: number;
  dielectricHeightMm: number; // Height above reference plane (H)
  relativePermittivity: number; // Dielectric constant (Er), e.g. 4.3 for FR4
}

export interface StriplineParams {
  traceWidthMm: number;
  traceThicknessUm: number;
  totalDielectricHeightMm: number; // Distance between planes (B)
  tracePlaneOffsetMm: number; // Distance from center (H)
  relativePermittivity: number; // Er
}

export interface SignalIntegrityResult {
  impedanceOhms: number;
  effectiveDielectricConstant: number;
  propagationDelayPsPerMm: number;
  inductanceNpHm: number;
  capacitancePfm: number;
  isCompliant50Ohms: boolean;
  notes: string;
}

export class PcbSignalIntegrityEngine {
  /**
   * Calculates Microstrip characteristic impedance ($Z_0$) per IPC-2141 / Wheeler equations.
   */
  public static calculateMicrostrip(params: MicrostripParams): SignalIntegrityResult {
    const { traceWidthMm, traceThicknessUm, dielectricHeightMm, relativePermittivity } = params;
    const t = traceThicknessUm / 1000; // um to mm
    const w = traceWidthMm;
    const h = dielectricHeightMm;
    const er = relativePermittivity;

    if (h <= 0 || w <= 0) {
      return {
        impedanceOhms: 0,
        effectiveDielectricConstant: 0,
        propagationDelayPsPerMm: 0,
        inductanceNpHm: 0,
        capacitancePfm: 0,
        isCompliant50Ohms: false,
        notes: 'Invalid dimensions for microstrip calculation.'
      };
    }

    // Effective dielectric constant approximation
    const erEff = (er + 1) / 2 + ((er - 1) / 2) * Math.pow(1 + (12 * h) / w, -0.5);

    // Characteristic impedance Z0 per IPC-2141
    // Z0 = (87 / sqrt(er + 1.41)) * ln(5.98 * h / (0.8 * w + t))
    const numerator = 5.98 * h;
    const denominator = 0.8 * w + t;
    const z0 = (87 / Math.sqrt(er + 1.41)) * Math.log(numerator / denominator);

    // Propagation delay td = sqrt(erEff) / c (in ps/mm)
    // c approx 0.29979 mm/ps
    const c = 0.29979;
    const delayPsMm = Math.sqrt(erEff) / c;

    // Capacitance and Inductance per mm
    const capPfMm = erEff / (0.6 * z0 * c);
    const indNpHm = (z0 * z0 * capPfMm) / 1000;

    const isCompliant50Ohms = Math.abs(z0 - 50.0) <= 5.0; // within 10% of 50 ohm standard

    return {
      impedanceOhms: parseFloat(z0.toFixed(2)),
      effectiveDielectricConstant: parseFloat(erEff.toFixed(3)),
      propagationDelayPsPerMm: parseFloat(delayPsMm.toFixed(3)),
      inductanceNpHm: parseFloat(indNpHm.toFixed(4)),
      capacitancePfm: parseFloat(capPfMm.toFixed(4)),
      isCompliant50Ohms,
      notes: `Microstrip Z0 = ${z0.toFixed(2)} Ω (Er_eff = ${erEff.toFixed(2)}, Delay = ${delayPsMm.toFixed(2)} ps/mm).`
    };
  }

  /**
   * Calculates Stripline characteristic impedance ($Z_0$) for symmetric inner traces.
   */
  public static calculateStripline(params: StriplineParams): SignalIntegrityResult {
    const { traceWidthMm, traceThicknessUm, totalDielectricHeightMm, relativePermittivity } = params;
    const t = traceThicknessUm / 1000;
    const w = traceWidthMm;
    const b = totalDielectricHeightMm;
    const er = relativePermittivity;

    if (b <= 0 || w <= 0) {
      return {
        impedanceOhms: 0,
        effectiveDielectricConstant: er,
        propagationDelayPsPerMm: 0,
        inductanceNpHm: 0,
        capacitancePfm: 0,
        isCompliant50Ohms: false,
        notes: 'Invalid dimensions for stripline calculation.'
      };
    }

    // Z0 for symmetric stripline = (60 / sqrt(er)) * ln(1.9 * b / (0.8 * w + t))
    const z0 = (60 / Math.sqrt(er)) * Math.log((1.9 * b) / (0.8 * w + t));
    const c = 0.29979;
    const delayPsMm = Math.sqrt(er) / c;
    const capPfMm = er / (0.6 * z0 * c);
    const indNpHm = (z0 * z0 * capPfMm) / 1000;

    const isCompliant50Ohms = Math.abs(z0 - 50.0) <= 5.0;

    return {
      impedanceOhms: parseFloat(z0.toFixed(2)),
      effectiveDielectricConstant: er,
      propagationDelayPsPerMm: parseFloat(delayPsMm.toFixed(3)),
      inductanceNpHm: parseFloat(indNpHm.toFixed(4)),
      capacitancePfm: parseFloat(capPfMm.toFixed(4)),
      isCompliant50Ohms,
      notes: `Stripline Z0 = ${z0.toFixed(2)} Ω (Delay = ${delayPsMm.toFixed(2)} ps/mm).`
    };
  }
}
