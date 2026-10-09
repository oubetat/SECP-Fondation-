import { describe, it, expect } from 'vitest';
import { IndependentQifOracle } from '../IndependentQifOracle';
import { QifXmlEngine } from '../QifXmlEngine';
import { QifDocument } from '../QifTypes';

describe('Point C: 12-Node Design Authority Graph Cut Systematics', () => {
  const buildValidDocument = (): QifDocument => ({
    qifDocumentId: 'QIF-DOC-CUT-TEST',
    header: { title: 'Graph Cut Test', author: 'Auditor', organization: 'SECP', timestamp: '2026-09-23T10:00:00Z', schemaVersion: '3.0' },
    plan: {
      planId: 'PLAN-01',
      designAuthorityId: 'DA-SECP-01',
      revisionId: 'REV-A',
      unitSystem: { lengthUnit: 'MILLIMETRE', angleUnit: 'DEGREE', scaleFactorToMm: 1.0 },
      planHash: 'sha256:1111222233334444555566667777888899990000111122223333444455556666',
      features: [{ id: 'FEAT-1', name: 'Pin', featureType: 'CYLINDER', persistentTopologyId: 'TOP-1', associatedCharacteristicIds: ['CHAR-1'] }],
      characteristics: [{
        id: 'CHAR-1', type: 'DIAMETER', name: 'Pin Dia', nominalValue: 10.000, unit: 'mm', pmiId: 'PMI-1', targetGeometryId: 'TOP-1', isCriticalToQuality: true,
        tolerance: { type: 'SYMMETRIC', upperLimitMm: 10.010, lowerLimitMm: 9.990, upperDeviationMm: 0.010, lowerDeviationMm: -0.010 },
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
        nominalValue: 10.000,
        measuredValue: 10.002,
        deviationMm: 0.002,
        unit: 'mm',
        decisionRule: 'GUARD_BANDED_95_CONFIDENCE',
        verdict: 'PASS',
        evidenceHash: 'sha256:2222333344445555666677778888999900001111222233334444555566667777',
        uncertainty: { standardUncertaintyMm: 0.001, instrumentContributionMm: 0.0005, environmentalContributionMm: 0.0005, repeatabilityMm: 0.0005, coverageFactor: 2, expandedUncertaintyMm: 0.002, confidenceLevelPercent: 95 },
        context: {
          operatorId: 'OP-1', measurementMethod: 'CMM', temperatureCelsius: 20.0, partSerialNumber: 'SN-01', lotId: 'LOT-01', revisionId: 'REV-A', timestamp: '2026-09-23T10:00:00Z', coordinateSystem: 'PCS',
          instrument: {
            instrumentId: 'INST-1', name: 'Micrometer', type: 'DIGITAL_MICROMETER', resolutionMm: 0.001, inherentUncertaintyMm: 0.001,
            calibration: { calibrationId: 'CAL-1', instrumentId: 'INST-1', calibratedAt: '2026-01-01T00:00:00Z', expiresAt: '2027-01-01T00:00:00Z', calibrationStandardId: 'ISO-1', verifiedAccuracyMm: 0.001, isValid: true }
          }
        },
        binding: { designAuthorityId: 'DA-SECP-01', canonicalDocumentId: 'DOC-1', revisionId: 'REV-A', geometryPersistentId: 'TOP-1', pmiId: 'PMI-1', qualityCharacteristicId: 'CHAR-1', measurementFeatureId: 'FEAT-1', qifResultId: 'RES-1', traceabilityHash: 'sha256:3333444455556666777788889999000011112222333344445555666677778888' }
      }
    ]
  });

  it('1. Sever DesignAuthority Node => Oracle flags DESIGN_AUTHORITY_UNRESOLVED', () => {
    const doc = buildValidDocument();
    (doc.results[0].binding as any).designAuthorityId = '';
    const xml = QifXmlEngine.exportToXml(doc);
    const audit = IndependentQifOracle.auditRawQifXml(xml);
    expect(audit.isValid).toBe(false);
    expect(audit.independentVerdicts[0].computedVerdict).toBe('DESIGN_AUTHORITY_UNRESOLVED');
  });

  it('2. Sever Revision Node => Missing revision in binding rejected', () => {
    const doc = buildValidDocument();
    (doc.results[0].binding as any).revisionId = '';
    const xml = QifXmlEngine.exportToXml(doc);
    const audit = IndependentQifOracle.auditRawQifXml(xml);
    expect(audit.isValid).toBe(false);
  });

  it('3. Sever CanonicalDocument Node => Canonical document reference severed', () => {
    const doc = buildValidDocument();
    (doc.results[0].binding as any).canonicalDocumentId = '';
    const xml = QifXmlEngine.exportToXml(doc);
    const parse = QifXmlEngine.parseXml(xml);
    expect(parse.document?.results[0].binding.canonicalDocumentId).toBe('');
  });

  it('4. Sever GeometryPersistentId Node => Topology persistent ID reference severed', () => {
    const doc = buildValidDocument();
    (doc.plan.features[0] as any).persistentTopologyId = '';
    const xml = QifXmlEngine.exportToXml(doc);
    const parse = QifXmlEngine.parseXml(xml);
    expect(parse.document?.plan.features[0].persistentTopologyId).toBe('');
  });

  it('5. Sever PMI Node => PMI ID severed from characteristic', () => {
    const doc = buildValidDocument();
    (doc.plan.characteristics[0] as any).pmiId = '';
    const xml = QifXmlEngine.exportToXml(doc);
    const parse = QifXmlEngine.parseXml(xml);
    expect(parse.document?.plan.characteristics[0].pmiId).toBe('');
  });

  it('6. Sever Characteristic Node => Result references missing characteristic => BROKEN_REFERENCE', () => {
    const doc = buildValidDocument();
    (doc.results[0] as any).characteristicId = 'CHAR-SEVERED-99';
    const xml = QifXmlEngine.exportToXml(doc);
    const audit = IndependentQifOracle.auditRawQifXml(xml);
    expect(audit.isValid).toBe(false);
    expect(audit.traceabilityGraph.brokenReferences.some(r => r.includes('CHAR-SEVERED-99'))).toBe(true);
  });

  it('7. Sever InspectionFeature Node => Result references missing feature => BROKEN_REFERENCE', () => {
    const doc = buildValidDocument();
    (doc.results[0] as any).featureId = 'FEAT-SEVERED-88';
    const xml = QifXmlEngine.exportToXml(doc);
    const audit = IndependentQifOracle.auditRawQifXml(xml);
    expect(audit.isValid).toBe(false);
    expect(audit.traceabilityGraph.brokenReferences.some(r => r.includes('FEAT-SEVERED-88'))).toBe(true);
  });

  it('8. Sever MeasurementResult Node => Empty results array rejected', () => {
    const doc = buildValidDocument();
    (doc as any).results = [];
    const xml = QifXmlEngine.exportToXml(doc);
    const parse = QifXmlEngine.parseXml(xml);
    expect(parse.document?.results).toHaveLength(0);
  });

  it('9. Sever Instrument Node => Missing Instrument ID => UNKNOWN_CALIBRATION or BROKEN', () => {
    const doc = buildValidDocument();
    (doc.results[0].context.instrument as any).instrumentId = '';
    const xml = QifXmlEngine.exportToXml(doc);
    const audit = IndependentQifOracle.auditRawQifXml(xml);
    expect(audit.independentVerdicts[0].computedVerdict).not.toBe('PASS');
  });

  it('10. Sever Calibration Node => Expired calibration date => EXPIRED_CALIBRATION', () => {
    const doc = buildValidDocument();
    (doc.results[0].context.instrument.calibration as any).expiresAt = '2025-01-01T00:00:00Z';
    const xml = QifXmlEngine.exportToXml(doc);
    const audit = IndependentQifOracle.auditRawQifXml(xml);
    expect(audit.independentVerdicts[0].computedVerdict).toBe('EXPIRED_CALIBRATION');
  });

  it('11. Sever Uncertainty Node => Missing uncertainty => MISSING_UNCERTAINTY', () => {
    const doc = buildValidDocument();
    (doc.results[0].uncertainty as any).expandedUncertaintyMm = undefined;
    const xml = QifXmlEngine.exportToXml(doc);
    const audit = IndependentQifOracle.auditRawQifXml(xml);
    expect(audit.independentVerdicts[0].computedVerdict).toBe('MISSING_UNCERTAINTY');
  });

  it('12. Sever Evidence/Provenance Node => Empty evidence hash rejected', () => {
    const doc = buildValidDocument();
    (doc.results[0] as any).evidenceHash = '';
    const xml = QifXmlEngine.exportToXml(doc);
    const parse = QifXmlEngine.parseXml(xml);
    expect(parse.document?.results[0].evidenceHash).toBe('');
  });
});
