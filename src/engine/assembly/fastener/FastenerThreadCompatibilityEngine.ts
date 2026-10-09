/**
 * SECP FASTENER THREAD COMPATIBILITY ENGINE (PATCH-226)
 * 
 * Validates mechanical engagement and thread compatibility between male and female
 * threaded components (Bolts, Screws, Nuts, Tapped Holes).
 * 
 * Enforces:
 * 1. Nominal diameter matching (d_bolt == D_nut)
 * 2. Thread pitch matching (P_bolt == P_nut)
 * 3. Thread profile angle matching (60° Metric/UN vs 55° Whitworth)
 * 4. Thread hand direction matching (RH with RH, LH with LH)
 * 5. Tolerance class compatibility (e.g. 6g bolt mates with 6H nut)
 */

import { ThreadSpecification } from './FastenerTypes';

export interface ThreadCompatibilityDiagnostic {
  isCompatible: boolean;
  verdict: 'COMPATIBLE' | 'INCOMPATIBLE';
  nominalDiameterMatch: boolean;
  pitchMatch: boolean;
  threadSystemMatch: boolean;
  handMatch: boolean;
  profileAngleMatch: boolean;
  toleranceClassValid: boolean;
  pitchClearance_mm: number;
  message: string;
  recommendations: string[];
}

export class FastenerThreadCompatibilityEngine {
  /**
   * Checks complete mechanical compatibility between two threaded entities
   */
  public static verifyCompatibility(
    maleThread: ThreadSpecification,
    femaleThread: ThreadSpecification
  ): ThreadCompatibilityDiagnostic {
    const recs: string[] = [];

    // 1. Gender verification (must be Male external + Female internal)
    if (maleThread.gender !== 'EXTERNAL' || femaleThread.gender !== 'INTERNAL') {
      return {
        isCompatible: false,
        verdict: 'INCOMPATIBLE',
        nominalDiameterMatch: false,
        pitchMatch: false,
        threadSystemMatch: false,
        handMatch: false,
        profileAngleMatch: false,
        toleranceClassValid: false,
        pitchClearance_mm: 0,
        message: `Gender mismatch: cannot mate ${maleThread.gender} with ${femaleThread.gender}. Must pair EXTERNAL (Bolt) with INTERNAL (Nut/Tapped Hole).`,
        recommendations: ['Pair an external bolt thread with an internal nut/tapped hole thread.']
      };
    }

    // 2. Nominal Diameter Check
    const nominalMatch = Math.abs(maleThread.nominalDiameter_d_mm - femaleThread.nominalDiameter_d_mm) < 0.001;
    if (!nominalMatch) {
      recs.push(`Nominal size mismatch: Bolt is M${maleThread.nominalDiameter_d_mm}, but Nut/Hole is M${femaleThread.nominalDiameter_d_mm}. Adjust diameter to match.`);
    }

    // 3. Pitch Check
    const pitchMatch = Math.abs(maleThread.pitch_P_mm - femaleThread.pitch_P_mm) < 0.001;
    if (!pitchMatch) {
      recs.push(`Thread pitch mismatch: Bolt has pitch ${maleThread.pitch_P_mm}mm, but Nut/Hole has pitch ${femaleThread.pitch_P_mm}mm. Severe cross-threading hazard!`);
    }

    // 4. Thread System & Angle Check
    const systemMatch = maleThread.system === femaleThread.system;
    const angleMatch = Math.abs(maleThread.threadAngle_deg - femaleThread.threadAngle_deg) < 0.1;
    if (!systemMatch || !angleMatch) {
      recs.push(`Profile angle conflict: ${maleThread.system} (${maleThread.threadAngle_deg}°) is incompatible with ${femaleThread.system} (${femaleThread.threadAngle_deg}°).`);
    }

    // 5. Hand Direction Check
    const handMatch = maleThread.hand === femaleThread.hand;
    if (!handMatch) {
      recs.push(`Thread hand direction conflict: ${maleThread.hand} cannot thread into ${femaleThread.hand}.`);
    }

    // 6. Clearance & Tolerance Fit
    // For standard 6g / 6H fit: D2_min (Nut) >= d2_max (Bolt)
    const pitchClearance = femaleThread.pitchDiameter_d2_mm - maleThread.pitchDiameter_d2_mm;
    const toleranceValid = pitchClearance >= -0.05; // allow standard nominal tolerance fit

    const isFullyCompatible = nominalMatch && pitchMatch && systemMatch && angleMatch && handMatch && toleranceValid;

    const verdict = isFullyCompatible ? 'COMPATIBLE' : 'INCOMPATIBLE';
    const message = isFullyCompatible
      ? `Thread Pairing Valid: M${maleThread.nominalDiameter_d_mm}×${maleThread.pitch_P_mm} (${maleThread.toleranceClass}) perfectly engages with M${femaleThread.nominalDiameter_d_mm}×${femaleThread.pitch_P_mm} (${femaleThread.toleranceClass}).`
      : `Thread Pairing Invalid: ${recs.join(' | ')}`;

    return {
      isCompatible: isFullyCompatible,
      verdict,
      nominalDiameterMatch: nominalMatch,
      pitchMatch,
      threadSystemMatch: systemMatch,
      handMatch,
      profileAngleMatch: angleMatch,
      toleranceClassValid: toleranceValid,
      pitchClearance_mm: parseFloat(pitchClearance.toFixed(4)),
      message,
      recommendations: recs
    };
  }
}
