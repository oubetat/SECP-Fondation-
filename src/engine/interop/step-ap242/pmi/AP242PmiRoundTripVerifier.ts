/**
 * SECP Industrial OS v2 — AP242 PMI Round Trip Verifier
 * PATCH-035: AP242 PMI
 */

import { PmiObject, PmiFidelityReport, PmiFidelityVerdict, DatumPmi, FeatureControlFramePmi } from './AP242PmiTypes';

export class AP242PmiRoundTripVerifier {
  public static verify(original: PmiObject[], roundTripped: PmiObject[]): PmiFidelityReport {
    let semanticPreserved = 0;
    let graphicalPreserved = 0;
    let lostPmi = 0;
    let unsupportedPmi = 0;
    let associationLoss = 0;
    let toleranceLoss = 0;
    let datumLoss = 0;
    let modifierLoss = 0;
    const criticalLosses: string[] = [];
    const lossDetails: string[] = [];

    const rtMap = new Map(roundTripped.map(p => [p.id, p]));

    for (const orig of original) {
      if (orig.supportStatus === 'UNSUPPORTED' || orig.supportStatus === 'UNPROVEN') {
        unsupportedPmi++;
        continue;
      }

      const rt = rtMap.get(orig.id);
      if (!rt) {
        lostPmi++;
        lossDetails.push(`Missing PMI: ${orig.id}`);
        if (orig.criticality === 'HIGH' || orig.criticality === 'CRITICAL') {
          criticalLosses.push(orig.id);
        }
        continue;
      }

      // Semantic Checks
      let isDegraded = false;
      if (orig.isSemantic !== rt.isSemantic) {
        isDegraded = true;
        lossDetails.push(`Semantic degradation: ${orig.id}`);
      }

      if (orig.value !== rt.value) {
        isDegraded = true;
        lossDetails.push(`Value mismatch on ${orig.id}: ${orig.value} vs ${rt.value}`);
      }

      if (orig.unit !== rt.unit) {
        isDegraded = true;
        lossDetails.push(`Unit mismatch on ${orig.id}: ${orig.unit} vs ${rt.unit}`);
      }

      // Tolerance Checks
      if (JSON.stringify(orig.tolerance) !== JSON.stringify(rt.tolerance)) {
        toleranceLoss++;
        isDegraded = true;
        lossDetails.push(`Tolerance mismatch on ${orig.id}`);
      }

      // Datum Checks
      if (orig.category === 'DATUM') {
        if ((orig as DatumPmi).datumLabel !== (rt as DatumPmi).datumLabel) {
          datumLoss++;
          isDegraded = true;
        }
      }
      if (orig.category === 'FEATURE_CONTROL_FRAME') {
        const origDatumStr = (orig.datumReferences || []).join('|');
        const rtDatumStr = (rt.datumReferences || []).join('|');
        if (origDatumStr !== rtDatumStr) {
          datumLoss++;
          isDegraded = true;
          lossDetails.push(`Datum ordering mismatch on ${orig.id}`);
        }
      }

      // Association Check
      const origRefs = [...orig.geometryReferences].sort().join(',');
      const rtRefs = [...rt.geometryReferences].sort().join(',');
      if (origRefs !== rtRefs) {
        associationLoss++;
        isDegraded = true;
        lossDetails.push(`Association mismatch on ${orig.id}`);
      }

      if (isDegraded) {
        lostPmi++; // Degraded counts as lost in strict fidelity
        if (orig.criticality === 'HIGH' || orig.criticality === 'CRITICAL') {
          criticalLosses.push(orig.id);
        }
      } else {
        if (orig.isSemantic) {
          semanticPreserved++;
        } else {
          graphicalPreserved++;
        }
      }
    }

    const preservedPmi = semanticPreserved + graphicalPreserved;
    const totalPmi = original.length;
    
    // Calculate fidelity (only over supported items)
    const activeTotal = totalPmi - unsupportedPmi;
    const fidelityRatio = activeTotal > 0 ? preservedPmi / activeTotal : 1.0;

    let verdict: PmiFidelityVerdict = 'EXACT';
    if (fidelityRatio < 1.0) verdict = 'DEGRADED';
    if (criticalLosses.length > 0) verdict = 'LOSS_DETECTED';

    return {
      verdict,
      totalPmi,
      preservedPmi,
      semanticPreserved,
      graphicalPreserved,
      lostPmi,
      unsupportedPmi,
      associationLoss,
      toleranceLoss,
      datumLoss,
      modifierLoss,
      fidelityRatio,
      criticalPmiLosses: criticalLosses,
      lossDetails
    };
  }
}
