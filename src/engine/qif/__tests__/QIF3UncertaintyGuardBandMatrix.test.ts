import { describe, it, expect } from 'vitest';
import { IndependentMeasurementVerifier } from '../IndependentMeasurementVerifier';
import { IndependentQifOracle } from '../IndependentQifOracle';
import { QifXmlEngine } from '../QifXmlEngine';
import { QifCharacteristic, QifDocument } from '../QifTypes';

describe('Point D & E: Calibration Semantic Matrix & Uncertainty Decision Matrix', () => {

  const buildBaseDocument = (): QifDocument => ({
    qifDocumentId: 'QIF-DOC-CAL-UNC',
    header: { title: 'Cal & Unc Test', author: 'Auditor', organization: 'SECP', timestamp: '2026-09-23T10:00:00Z', schemaVersion: '3.0' },
    plan: {
      planId: 'PLAN-01',
      designAuthorityId: 'DA-SECP-01',
      revisionId: 'REV-A',
      unitSystem: { lengthUnit: 'MILLIMETRE', angleUnit: 'DEGREE', scaleFactorToMm: 1.0 },
      planHash: 'sha256:1111222233334444555566667777888899990000111122223333444455556666',
      features: [{ id: 'FEAT-1', name: 'Bore', featureType: 'CYLINDER', persistentTopologyId: 'TOP-1', associatedCharacteristicIds: ['CHAR-1'] }],
      characteristics: [{
        id: 'CHAR-1', type: 'DIAMETER', name: 'Bore 50H7', nominalValue: 50.000, unit: 'mm', pmiId: 'PMI-1', targetGeometryId: 'TOP-1', isCriticalToQuality: true,
        tolerance: { type: 'LIMITS', upperLimitMm: 50.025, lowerLimitMm: 50.000, upperDeviationMm: 0.025, lowerDeviationMm: 0.000 },
        datumReferences: []
      }]
    },
    results: [
      {
        resultId: 'RES-1',
        featureId: 'FEAT-1',
        characteristicId: 'CHAR-1',
        designRevisionId: 'REV-A',
        partSerialNumber: 'SN-01',
        lotId: 'LOT-01',
        nominalValue: 50.000,
        measuredValue: 50.010,
        deviationMm: 0.010,
        unit: 'mm',
        decisionRule: 'GUARD_BANDED_95_CONFIDENCE',
        verdict: 'PASS',
        evidenceHash: 'sha256:2222333344445555666677778888999900001111222233334444555566667777',
        uncertainty: { standardUncertaintyMm: 0.001, instrumentContributionMm: 0.0005, environmentalContributionMm: 0.0005, repeatabilityMm: 0.0005, coverageFactor: 2, expandedUncertaintyMm: 0.002, confidenceLevelPercent: 95 },
        context: {
          operatorId: 'OP-1', measurementMethod: 'CMM', temperatureCelsius: 20.0, partSerialNumber: 'SN-01', lotId: 'LOT-01', revisionId: 'REV-A', timestamp: '2026-09-23T10:00:00Z', coordinateSystem: 'PCS',
          instrument: {
            instrumentId: 'INST-1', name: 'Zeiss CMM', type: 'ZEISS_CMM_PROBE', resolutionMm: 0.0001, inherentUncertaintyMm: 0.0008,
            calibration: { calibrationId: 'CAL-1', instrumentId: 'INST-1', calibratedAt: '2026-01-01T00:00:00Z', expiresAt: '2027-01-01T00:00:00Z', calibrationStandardId: 'ISO-1', verifiedAccuracyMm: 0.0008, isValid: true }
          }
        },
        binding: { designAuthorityId: 'DA-SECP-01', canonicalDocumentId: 'DOC-1', revisionId: 'REV-A', geometryPersistentId: 'TOP-1', pmiId: 'PMI-1', qualityCharacteristicId: 'CHAR-1', measurementFeatureId: 'FEAT-1', qifResultId: 'RES-1', traceabilityHash: 'sha256:3333444455556666777788889999000011112222333344445555666677778888' }
      }
    ]
  });

  describe('Point D: Fine-Grained Calibration Semantic Matrix', () => {
    it('1. VALID calibration => PASS', () => {
      const doc = buildBaseDocument();
      const xml = QifXmlEngine.exportToXml(doc);
      const audit = IndependentQifOracle.auditRawQifXml(xml);
      expect(audit.independentVerdicts[0].computedVerdict).toBe('PASS');
    });

    it('2. EXPIRED calibration date => EXPIRED_CALIBRATION', () => {
      const doc = buildBaseDocument();
      doc.results[0].context.instrument.calibration.expiresAt = '2025-01-01T00:00:00Z';
      const xml = QifXmlEngine.exportToXml(doc);
      const audit = IndependentQifOracle.auditRawQifXml(xml);
      expect(audit.independentVerdicts[0].computedVerdict).toBe('EXPIRED_CALIBRATION');
    });

    it('3. INVALID_FLAG calibration => INVALID_CALIBRATION', () => {
      const doc = buildBaseDocument();
      doc.results[0].context.instrument.calibration.isValid = false;
      const xml = QifXmlEngine.exportToXml(doc);
      const audit = IndependentQifOracle.auditRawQifXml(xml);
      expect(audit.independentVerdicts[0].computedVerdict).toBe('INVALID_CALIBRATION');
    });

    it('4. MISSING calibration block => MISSING_CALIBRATION', () => {
      const doc = buildBaseDocument();
      (doc.results[0].context.instrument as any).calibration = undefined;
      const xml = QifXmlEngine.exportToXml(doc);
      const audit = IndependentQifOracle.auditRawQifXml(xml);
      expect(audit.independentVerdicts[0].computedVerdict).toBe('MISSING_CALIBRATION');
    });

    it('5. UNKNOWN calibration ID => UNKNOWN_CALIBRATION', () => {
      const doc = buildBaseDocument();
      doc.results[0].context.instrument.calibration.calibrationId = '';
      const xml = QifXmlEngine.exportToXml(doc);
      const audit = IndependentQifOracle.auditRawQifXml(xml);
      expect(audit.independentVerdicts[0].computedVerdict).toBe('UNKNOWN_CALIBRATION');
    });

    it('6. OUTSIDE_INTERVAL timestamp => OUTSIDE_CALIBRATION_INTERVAL', () => {
      const doc = buildBaseDocument();
      doc.results[0].context.timestamp = '2028-01-01T00:00:00Z'; // Far past calibration expiration
      const xml = QifXmlEngine.exportToXml(doc);
      const audit = IndependentQifOracle.auditRawQifXml(xml);
      expect(audit.independentVerdicts[0].computedVerdict).toBe('OUTSIDE_CALIBRATION_INTERVAL');
    });
  });

  describe('Point E: Uncertainty & Decision Rule Matrix (ISO 14253-1)', () => {
    const char50H7: QifCharacteristic = {
      id: 'CHAR-BORE-50H7', type: 'DIAMETER', name: 'Bore 50H7', nominalValue: 50.000, unit: 'mm', pmiId: 'PMI-BORE-01', targetGeometryId: 'GEOM-CYL-01', isCriticalToQuality: true,
      tolerance: { type: 'LIMITS', upperLimitMm: 50.025, lowerLimitMm: 50.000, upperDeviationMm: 0.025, lowerDeviationMm: 0.000 }, datumReferences: []
    };

    it('1. Inside tolerance + low uncertainty => PASS', () => {
      const unc = { standardUncertaintyMm: 0.001, instrumentContributionMm: 0.0005, environmentalContributionMm: 0.0005, repeatabilityMm: 0.0005, coverageFactor: 2.0, expandedUncertaintyMm: 0.002, confidenceLevelPercent: 95.0 };
      const res = IndependentMeasurementVerifier.evaluateMeasurement(char50H7, 50.010, unc, 'GUARD_BANDED_95_CONFIDENCE');
      expect(res.verdict).toBe('PASS');
    });

    it('2. Inside tolerance + boundary uncertainty => INDETERMINATE', () => {
      const unc = { standardUncertaintyMm: 0.001, instrumentContributionMm: 0.0005, environmentalContributionMm: 0.0005, repeatabilityMm: 0.0005, coverageFactor: 2.0, expandedUncertaintyMm: 0.002, confidenceLevelPercent: 95.0 };
      const res = IndependentMeasurementVerifier.evaluateMeasurement(char50H7, 50.024, unc, 'GUARD_BANDED_95_CONFIDENCE');
      expect(res.verdict).toBe('INDETERMINATE');
    });

    it('3. Boundary value exactly at limit => INDETERMINATE', () => {
      const unc = { standardUncertaintyMm: 0.001, instrumentContributionMm: 0.0005, environmentalContributionMm: 0.0005, repeatabilityMm: 0.0005, coverageFactor: 2.0, expandedUncertaintyMm: 0.002, confidenceLevelPercent: 95.0 };
      const res = IndependentMeasurementVerifier.evaluateMeasurement(char50H7, 50.025, unc, 'GUARD_BANDED_95_CONFIDENCE');
      expect(res.verdict).toBe('INDETERMINATE');
    });

    it('4. Outside tolerance + low uncertainty => FAIL', () => {
      const unc = { standardUncertaintyMm: 0.001, instrumentContributionMm: 0.0005, environmentalContributionMm: 0.0005, repeatabilityMm: 0.0005, coverageFactor: 2.0, expandedUncertaintyMm: 0.002, confidenceLevelPercent: 95.0 };
      const res = IndependentMeasurementVerifier.evaluateMeasurement(char50H7, 50.026, unc, 'GUARD_BANDED_95_CONFIDENCE');
      expect(res.verdict).toBe('FAIL');
    });

    it('5. Outside tolerance + high uncertainty => FAIL', () => {
      const unc = { standardUncertaintyMm: 0.005, instrumentContributionMm: 0.004, environmentalContributionMm: 0.002, repeatabilityMm: 0.002, coverageFactor: 2.0, expandedUncertaintyMm: 0.010, confidenceLevelPercent: 95.0 };
      const res = IndependentMeasurementVerifier.evaluateMeasurement(char50H7, 50.035, unc, 'GUARD_BANDED_95_CONFIDENCE');
      expect(res.verdict).toBe('FAIL');
    });

    it('6. Missing uncertainty in raw XML => MISSING_UNCERTAINTY', () => {
      const doc = buildBaseDocument();
      (doc.results[0].uncertainty as any).expandedUncertaintyMm = undefined;
      const xml = QifXmlEngine.exportToXml(doc);
      const audit = IndependentQifOracle.auditRawQifXml(xml);
      expect(audit.independentVerdicts[0].computedVerdict).toBe('MISSING_UNCERTAINTY');
    });

    it('7. Invalid uncertainty (negative/NaN) => INVALID_UNCERTAINTY', () => {
      const doc = buildBaseDocument();
      doc.results[0].uncertainty.expandedUncertaintyMm = -0.005;
      const xml = QifXmlEngine.exportToXml(doc);
      const audit = IndependentQifOracle.auditRawQifXml(xml);
      expect(audit.independentVerdicts[0].computedVerdict).toBe('INVALID_UNCERTAINTY');
    });
  });
});
