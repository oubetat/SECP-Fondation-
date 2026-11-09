import { NIOSHInput, ErgonomicEvidence, ErgonomicMethodology, NIOSHResult, NIOSHStatus } from './types';
import { Vector3D } from '../../assembly/graph/types';

export class NIOSHEngine {
  public static readonly VERSION = '1.1.0-PROD';
  public static readonly LOAD_CONSTANT = 23; // kg

  public static assess(input: NIOSHInput, profileId: string = 'ANSUR2_MALE_P50'): ErgonomicEvidence {
    const result = this.calculateRWL(input);

    return {
      methodology: ErgonomicMethodology.NIOSH,
      version: this.VERSION,
      documentId: 'DOC_ERG_001',
      revision: 1,
      dhmProfileId: profileId,
      timestampIso: new Date().toISOString(),
      provenanceHash: this.hashResult(result),
      scores: {
        rwl: result.rwl,
        li: result.li,
        hm: result.multipliers.hm,
        vm: result.multipliers.vm,
        dm: result.multipliers.dm,
        am: result.multipliers.am,
        fm: result.multipliers.fm,
        cm: result.multipliers.cm,
        validityCode: result.status === NIOSHStatus.VALID_RESULT ? 1 : 0
      },
      actionLevel: result.li > 1.0 ? 2 : 1,
      interpretation: this.getInterpretation(result),
      limitations: [
        'NIOSH equation applies to two-handed manual lifting only.',
        'Assumes lifting conditions are within the methodology validity domain.',
        'Does not apply to one-handed lifting, seated lifting, or unstable loads.'
      ],
      references: {
        source: 'Waters, T.R., Putz-Anderson, V., Garg, A., & Fine, L.J. (1993). Revised NIOSH equation for the design and evaluation of manual lifting tasks. Ergonomics, 36(7), 749-776.',
        tables: ['Frequency Multiplier Table (p. 760)', 'Coupling Multiplier Table (p. 761)'],
        pages: ['749-776']
      }
    };
  }

  private static calculateRWL(input: NIOSHInput): NIOSHResult {
    // 1. Calculate Horizontal Distance H (midpoint between ankles to midpoint between hands)
    const H = Math.sqrt(Math.pow(input.originMm.x, 2) + Math.pow(input.originMm.y, 2)) / 10; // to cm
    if (H > 63) return this.createErrorResult(NIOSHStatus.OUT_OF_DOMAIN, 'H > 63cm');
    const HM = H < 25 ? 1.0 : 25 / H;

    // 2. Calculate Vertical Height V (hands above floor)
    const V = input.originMm.z / 10;
    if (V < 0 || V > 175) return this.createErrorResult(NIOSHStatus.OUT_OF_DOMAIN, 'V out of range [0, 175]cm');
    const VM = 1 - 0.003 * Math.abs(V - 75);

    // 3. Calculate Vertical Travel Distance D
    const D = Math.abs(input.destinationMm.z - input.originMm.z) / 10;
    if (D > 175) return this.createErrorResult(NIOSHStatus.OUT_OF_DOMAIN, 'D > 175cm');
    // If D < 25cm, DM = 1.0. Formula: DM = 0.82 + (4.5 / D)
    const finalDM = D < 25 ? 1.0 : 0.82 + 4.5 / D;

    // 4. Calculate Asymmetry Multiplier AM
    const A = Math.abs(input.asymmetryAngleDeg);
    if (A > 135) return this.createErrorResult(NIOSHStatus.OUT_OF_DOMAIN, 'Asymmetry > 135°');
    const AM = 1 - 0.0032 * A;

    // 5. Frequency Multiplier FM
    const FM = this.getFrequencyMultiplier(input.frequency, V, input.durationHours);
    if (FM === 0) return this.createErrorResult(NIOSHStatus.OUT_OF_DOMAIN, 'Frequency/Duration out of range');

    // 6. Coupling Multiplier CM
    const CM = this.getCouplingMultiplier(input.coupling, V);

    const rwl = this.LOAD_CONSTANT * HM * Math.max(0, VM) * finalDM * AM * FM * CM;
    
    if (rwl <= 0) {
      return this.createErrorResult(NIOSHStatus.RWL_ZERO, 'Calculated RWL is zero; task is infeasible/prohibited.');
    }

    const li = input.loadKg / rwl;

    return {
      status: NIOSHStatus.VALID_RESULT,
      rwl: Number(rwl.toFixed(2)),
      li: Number(li.toFixed(2)),
      multipliers: {
        hm: Number(HM.toFixed(3)),
        vm: Number(VM.toFixed(3)),
        dm: Number(finalDM.toFixed(3)),
        am: Number(AM.toFixed(3)),
        fm: Number(FM.toFixed(3)),
        cm: Number(CM.toFixed(3))
      }
    };
  }

  private static getFrequencyMultiplier(f: number, v: number, duration: number): number {
    // Standard NIOSH FM Table (approximate intervals)
    const v_cat = v < 75 ? 0 : 1; // 0: V < 30in (75cm), 1: V >= 30in (75cm)
    
    if (f > 15) return 0;
    
    // Simplification of the 1991/1993 FM Table
    // Frequency bins: 0.2, 1, 4, 6, 9, 12, 15
    const frequencies = [0.2, 1, 4, 6, 9, 12, 15];
    const dur_cat = duration <= 1 ? 0 : (duration <= 2 ? 1 : 2); // 1hr, 2hr, 8hr
    
    const fm_table = [
      // Dur <= 1hr
      [[1.00, 1.00], [0.94, 0.94], [0.84, 0.84], [0.75, 0.75], [0.52, 0.52], [0.37, 0.37], [0.00, 0.28]],
      // Dur <= 2hr
      [[0.95, 0.95], [0.88, 0.88], [0.72, 0.72], [0.50, 0.50], [0.30, 0.30], [0.21, 0.21], [0.00, 0.00]],
      // Dur <= 8hr
      [[0.85, 0.85], [0.75, 0.75], [0.45, 0.45], [0.27, 0.27], [0.15, 0.15], [0.00, 0.00], [0.00, 0.00]]
    ];

    let f_idx = frequencies.findIndex(freq => f <= freq);
    if (f_idx === -1) f_idx = frequencies.length - 1;

    return fm_table[dur_cat][f_idx][v_cat];
  }

  private static getCouplingMultiplier(c: string, v: number): number {
    const isVLow = v < 75;
    if (c === 'Good') return 1.0;
    if (c === 'Fair') return isVLow ? 0.95 : 1.0;
    // Poor
    return 0.90;
  }

  private static getInterpretation(res: NIOSHResult): string {
    if (res.status !== NIOSHStatus.VALID_RESULT) return `Lifting assessment not applicable: ${res.status}`;
    if (res.li <= 1.0) return 'Lift is within safe limits (LI <= 1.0).';
    if (res.li <= 3.0) return 'Increased risk of injury. Task should be redesigned.';
    return 'High risk of injury. Immediate task redesign required.';
  }

  private static createErrorResult(status: NIOSHStatus, reason: string): NIOSHResult {
    return {
      status,
      rwl: 0,
      li: 0,
      multipliers: { hm: 0, vm: 0, dm: 0, am: 0, fm: 0, cm: 0 }
    };
  }

  private static hashResult(res: NIOSHResult): string {
    return `${res.status}|${res.rwl}|${res.li}`;
  }
}
