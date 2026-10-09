/**
 * SECP Industrial OS v2 — Independent QIF Oracle
 * Decoupled, stand-alone reference validator for QIF 3.0 ISO 23952 XML streams.
 * DOES NOT import SECP canonical QIF mapper, SECP verdict engine, or SECP feedback engine.
 */

import * as crypto from 'crypto';

export interface IndependentQifOracleAuditReport {
  readonly isValid: boolean;
  readonly entityCounts: {
    readonly features: number;
    readonly characteristics: number;
    readonly measurementResults: number;
    readonly datums: number;
  };
  readonly traceabilityGraph: {
    readonly totalResults: number;
    readonly resultsWithDesignAuthority: number;
    readonly brokenReferences: readonly string[];
  };
  readonly unitCheck: {
    readonly declaredUnit: string;
    readonly scaleFactorToMm: number;
    readonly isValid: boolean;
  };
  readonly calibrationAudit: {
    readonly totalInstruments: number;
    readonly validCalibrations: number;
    readonly expiredCalibrations: readonly string[];
  };
  readonly independentVerdicts: readonly Array<{
    readonly resultId: string;
    readonly characteristicId: string;
    readonly measuredValue: number;
    readonly nominalValue: number;
    readonly lowerLimit: number;
    readonly upperLimit: number;
    readonly expandedUncertainty: number;
    readonly computedVerdict: 'PASS' | 'FAIL' | 'INDETERMINATE' | 'EXPIRED_CALIBRATION' | 'INVALID_CALIBRATION' | 'MISSING_CALIBRATION' | 'UNKNOWN_CALIBRATION' | 'WRONG_INSTRUMENT' | 'WRONG_UNIT' | 'OUTSIDE_CALIBRATION_INTERVAL' | 'DESIGN_AUTHORITY_UNRESOLVED' | 'MISSING_UNCERTAINTY' | 'INVALID_UNCERTAINTY';
  }>;
  readonly rawXmlHash: string;
}

export class IndependentQifOracle {

  /**
   * Independently audits raw QIF 3.0 XML text directly using standalone lexing and evaluation.
   */
  public static auditRawQifXml(xmlText: string): IndependentQifOracleAuditReport {
    const brokenReferences: string[] = [];
    const expiredCalibrations: string[] = [];
    const independentVerdicts: Array<{
      resultId: string;
      characteristicId: string;
      measuredValue: number;
      nominalValue: number;
      lowerLimit: number;
      upperLimit: number;
      expandedUncertainty: number;
      computedVerdict: 'PASS' | 'FAIL' | 'INDETERMINATE' | 'EXPIRED_CALIBRATION' | 'DESIGN_AUTHORITY_UNRESOLVED';
    }> = [];

    // Helper regex extractors
    const extractTag = (xml: string, tag: string): string => {
      const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return match ? match[1].trim() : '';
    };

    const extractAttr = (xml: string, tag: string, attr: string): string => {
      const match = xml.match(new RegExp(`<${tag}[^>]*\\b${attr}=["']([^"']+)["']`));
      return match ? match[1] : '';
    };

    const extractAllBlocks = (xml: string, tag: string): string[] => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
      const results: string[] = [];
      let m;
      while ((m = regex.exec(xml)) !== null) {
        results.push(m[1]);
      }
      return results;
    };

    // 1. Feature Map
    const featureBlocks = extractAllBlocks(xmlText, 'Feature');
    const featureIds = new Set<string>();
    for (const fBlock of featureBlocks) {
      const fId = extractAttr(fBlock, 'Feature', 'id') || extractTag(fBlock, 'id');
      if (fId) featureIds.add(fId);
    }

    // 2. Characteristic Map
    const characteristicBlocks = extractAllBlocks(xmlText, 'Characteristic');
    const charIds = new Set<string>();
    const charNominalLimits = new Map<string, { nominal: number; upper: number; lower: number }>();

    let totalDatums = 0;
    for (const cBlock of characteristicBlocks) {
      const cId = extractAttr(cBlock, 'Characteristic', 'id') || extractTag(cBlock, 'id');
      if (cId) charIds.add(cId);

      const nom = parseFloat(extractTag(cBlock, 'NominalValue') || '0');
      const tolBlock = extractTag(cBlock, 'Tolerance');
      const upper = parseFloat(extractTag(tolBlock, 'UpperLimitMm') || (nom + 0.1).toString());
      const lower = parseFloat(extractTag(tolBlock, 'LowerLimitMm') || (nom - 0.1).toString());

      charNominalLimits.set(cId, { nominal: nom, upper, lower });

      const datumMatches = cBlock.match(/<Datum\s+[^>]*\/>/g) || [];
      totalDatums += datumMatches.length;
    }

    // 3. Results Audit
    const resultBlocks = extractAllBlocks(xmlText, 'MeasurementResult');
    let resultsWithDesignAuthority = 0;
    let totalInstruments = 0;
    let validCalibrations = 0;

    for (const rBlock of resultBlocks) {
      const rId = extractAttr(rBlock, 'MeasurementResult', 'id') || extractTag(rBlock, 'id');
      const fRef = extractTag(rBlock, 'FeatureRef');
      const cRef = extractTag(rBlock, 'CharacteristicRef');
      const measured = parseFloat(extractTag(rBlock, 'MeasuredValue') || '0');

      if (fRef && !featureIds.has(fRef)) {
        brokenReferences.push(`Result ${rId} references missing feature ${fRef}`);
      }
      if (cRef && !charIds.has(cRef)) {
        brokenReferences.push(`Result ${rId} references missing characteristic ${cRef}`);
      }

      // Design Authority Binding
      const daBlock = extractTag(rBlock, 'DesignAuthorityBinding');
      const daId = extractTag(daBlock, 'DesignAuthorityId');
      const daRevId = extractTag(daBlock, 'RevisionId');
      if (daId && daId.length > 0) {
        resultsWithDesignAuthority++;
      } else {
        brokenReferences.push(`Result ${rId} missing design authority binding`);
      }
      if (!daRevId || daRevId.length === 0) {
        brokenReferences.push(`Result ${rId} missing revision binding in DesignAuthorityBinding`);
      }

      // Uncertainty
      const uncBlock = extractTag(rBlock, 'Uncertainty');
      const hasUnc = uncBlock.length > 0;
      const expUncStr = extractTag(uncBlock, 'ExpandedUncertaintyMm');
      const expUnc = parseFloat(expUncStr || '0');

      // Calibration check
      const calBlock = extractTag(rBlock, 'Calibration');
      const instId = extractTag(rBlock, 'InstrumentId');
      const instUnit = extractTag(rBlock, 'InstrumentUnit') || extractTag(xmlText, 'LengthUnit') || 'MILLIMETRE';
      const charUnit = 'MILLIMETRE'; // Default canonical

      let calStatus: 'VALID' | 'EXPIRED' | 'INVALID_FLAG' | 'MISSING' | 'UNKNOWN' | 'WRONG_INSTRUMENT' | 'WRONG_UNIT' | 'OUTSIDE_INTERVAL' = 'VALID';

      if (!instId || instId.length === 0) {
        calStatus = 'UNKNOWN';
      } else if (!calBlock) {
        calStatus = 'MISSING';
      } else {
        totalInstruments++;
        const calId = extractTag(calBlock, 'CalibrationId');
        const calInstId = extractTag(calBlock, 'InstrumentId') || instId;
        const expiresAt = extractTag(calBlock, 'ExpiresAt');
        const calibratedAt = extractTag(calBlock, 'CalibratedAt');
        const isValidTag = extractTag(calBlock, 'IsValid') === 'true';
        const timestampStr = extractTag(rBlock, 'Timestamp') || '2026-09-23T10:00:00Z';

        if (!calId) {
          calStatus = 'UNKNOWN';
        } else if (instId && calInstId && instId !== calInstId) {
          calStatus = 'WRONG_INSTRUMENT';
        } else if (instUnit !== charUnit && instUnit !== 'mm') {
          calStatus = 'WRONG_UNIT';
        } else if (!isValidTag) {
          calStatus = 'INVALID_FLAG';
          expiredCalibrations.push(`Instrument ${instId} calibration marked invalid`);
        } else if (expiresAt && new Date(expiresAt) < new Date('2026-09-23T00:00:00Z')) {
          calStatus = 'EXPIRED';
          expiredCalibrations.push(`Instrument ${instId} calibration expired on ${expiresAt}`);
        } else if (calibratedAt && expiresAt && (new Date(timestampStr) < new Date(calibratedAt) || new Date(timestampStr) > new Date(expiresAt))) {
          calStatus = 'OUTSIDE_INTERVAL';
        } else {
          validCalibrations++;
        }
      }

      // Independent Verdict Computation
      const charLimit = charNominalLimits.get(cRef) || { nominal: 0, upper: 10, lower: -10 };
      let computedVerdict: 'PASS' | 'FAIL' | 'INDETERMINATE' | 'EXPIRED_CALIBRATION' | 'INVALID_CALIBRATION' | 'MISSING_CALIBRATION' | 'UNKNOWN_CALIBRATION' | 'WRONG_INSTRUMENT' | 'WRONG_UNIT' | 'OUTSIDE_CALIBRATION_INTERVAL' | 'DESIGN_AUTHORITY_UNRESOLVED' | 'MISSING_UNCERTAINTY' | 'INVALID_UNCERTAINTY' = 'PASS';

      if (!daId) {
        computedVerdict = 'DESIGN_AUTHORITY_UNRESOLVED';
      } else if (calStatus === 'EXPIRED') {
        computedVerdict = 'EXPIRED_CALIBRATION';
      } else if (calStatus === 'INVALID_FLAG') {
        computedVerdict = 'INVALID_CALIBRATION';
      } else if (calStatus === 'MISSING') {
        computedVerdict = 'MISSING_CALIBRATION';
      } else if (calStatus === 'UNKNOWN') {
        computedVerdict = 'UNKNOWN_CALIBRATION';
      } else if (calStatus === 'WRONG_INSTRUMENT') {
        computedVerdict = 'WRONG_INSTRUMENT';
      } else if (calStatus === 'WRONG_UNIT') {
        computedVerdict = 'WRONG_UNIT';
      } else if (calStatus === 'OUTSIDE_INTERVAL') {
        computedVerdict = 'OUTSIDE_CALIBRATION_INTERVAL';
      } else if (!hasUnc || expUncStr === '' || expUncStr === 'undefined') {
        computedVerdict = 'MISSING_UNCERTAINTY';
      } else if (isNaN(expUnc) || expUnc < 0) {
        computedVerdict = 'INVALID_UNCERTAINTY';
      } else {
        const effectiveUpper = charLimit.upper - expUnc;
        const effectiveLower = charLimit.lower + expUnc;

        if (measured > charLimit.upper || measured < charLimit.lower) {
          computedVerdict = 'FAIL';
        } else if (measured > effectiveUpper || measured < effectiveLower) {
          computedVerdict = 'INDETERMINATE';
        } else {
          computedVerdict = 'PASS';
        }
      }

      independentVerdicts.push({
        resultId: rId,
        characteristicId: cRef,
        measuredValue: measured,
        nominalValue: charLimit.nominal,
        lowerLimit: charLimit.lower,
        upperLimit: charLimit.upper,
        expandedUncertainty: expUnc,
        computedVerdict
      });
    }

    // Units check
    const unitBlock = extractTag(xmlText, 'UnitSystem');
    const declaredUnit = extractTag(unitBlock, 'LengthUnit') || 'MILLIMETRE';
    const scaleFactorToMm = parseFloat(extractTag(unitBlock, 'ScaleFactorToMm') || '1.0');

    // True SHA-256 digest of raw XML text stream
    const rawXmlHash = `sha256:${crypto.createHash('sha256').update(xmlText, 'utf8').digest('hex')}`;

    const isValid = brokenReferences.length === 0 &&
                    expiredCalibrations.length === 0 &&
                    resultsWithDesignAuthority === resultBlocks.length &&
                    independentVerdicts.every(v => v.computedVerdict === 'PASS');

    return {
      isValid,
      entityCounts: {
        features: featureBlocks.length,
        characteristics: characteristicBlocks.length,
        measurementResults: resultBlocks.length,
        datums: totalDatums
      },
      traceabilityGraph: {
        totalResults: resultBlocks.length,
        resultsWithDesignAuthority,
        brokenReferences
      },
      unitCheck: {
        declaredUnit,
        scaleFactorToMm,
        isValid: scaleFactorToMm > 0
      },
      calibrationAudit: {
        totalInstruments,
        validCalibrations,
        expiredCalibrations
      },
      independentVerdicts,
      rawXmlHash
    };
  }
}
