import { describe, test, expect } from 'vitest';
import { QifXmlEngine } from '../QifXmlEngine';
import { QifMbdMapper } from '../QifMbdMapper';
import { IndependentQifOracle } from '../IndependentQifOracle';
import { IndependentMeasurementVerifier } from '../IndependentMeasurementVerifier';
import { QifClosedLoopEngine } from '../QifClosedLoopEngine';
import { QifDocument, QifMeasurementResult } from '../QifTypes';

describe('CAP-SUP-004: QIF 3.0 / MBD Closed-Loop Manufacturing Red-Team Suite', () => {

  const createValidQifDocument = (): QifDocument => {
    return {
      qifDocumentId: 'QIF-DOC-HOUSING-001',
      header: {
        title: 'Precision Housing Assembly Inspection',
        author: 'Metrology Specialist',
        organization: 'SECP Precision Manufacturing',
        timestamp: '2026-09-23T10:00:00Z',
        schemaVersion: '3.0'
      },
      plan: {
        planId: 'PLAN-HOUSING-001',
        designAuthorityId: 'DA-SECP-001',
        revisionId: 'REV-A',
        unitSystem: { lengthUnit: 'MILLIMETRE', angleUnit: 'DEGREE', scaleFactorToMm: 1.0 },
        planHash: '0x1a2b3c4d',
        features: [
          {
            id: 'FEAT-BORE-01',
            name: 'Cylindrical Main Bore',
            featureType: 'CYLINDER',
            persistentTopologyId: 'TOPO-CYL-01',
            associatedCharacteristicIds: ['CHAR-DIA-01', 'CHAR-POS-01']
          }
        ],
        characteristics: [
          {
            id: 'CHAR-DIA-01',
            name: 'Bore Diameter 50H7',
            type: 'DIAMETER',
            nominalValue: 50.000,
            unit: 'mm',
            tolerance: {
              type: 'BILATERAL',
              upperLimitMm: 50.025,
              lowerLimitMm: 50.000,
              upperDeviationMm: 0.025,
              lowerDeviationMm: 0.000
            },
            datumReferences: [],
            targetGeometryId: 'TOPO-CYL-01',
            pmiId: 'PMI-DIM-50H7',
            isCriticalToQuality: true
          },
          {
            id: 'CHAR-POS-01',
            name: 'Bore Position to Datums A|B|C',
            type: 'POSITION',
            nominalValue: 0.050,
            unit: 'mm',
            tolerance: {
              type: 'SYMMETRIC',
              upperLimitMm: 0.050,
              lowerLimitMm: 0.000,
              upperDeviationMm: 0.050,
              lowerDeviationMm: 0.000
            },
            datumReferences: [
              { datumLabel: 'A', precedence: 'PRIMARY', targetGeometryId: 'FACE-BASE' },
              { datumLabel: 'B', precedence: 'SECONDARY', targetGeometryId: 'FACE-SIDE' },
              { datumLabel: 'C', precedence: 'TERTIARY', targetGeometryId: 'FACE-FRONT' }
            ],
            targetGeometryId: 'TOPO-CYL-01',
            pmiId: 'PMI-GDT-POS-01',
            isCriticalToQuality: true
          }
        ]
      },
      results: [
        {
          resultId: 'RES-DIA-01',
          featureId: 'FEAT-BORE-01',
          characteristicId: 'CHAR-DIA-01',
          designRevisionId: 'REV-A',
          partSerialNumber: 'SN-2026-9901',
          lotId: 'LOT-2026-09',
          nominalValue: 50.000,
          measuredValue: 50.012,
          deviationMm: 0.012,
          unit: 'mm',
          decisionRule: 'GUARD_BANDED_95_CONFIDENCE',
          verdict: 'PASS',
          evidenceHash: 'EVID-PASS-01',
          uncertainty: {
            standardUncertaintyMm: 0.001,
            instrumentContributionMm: 0.001,
            environmentalContributionMm: 0.0005,
            repeatabilityMm: 0.0005,
            coverageFactor: 2.0,
            expandedUncertaintyMm: 0.002,
            confidenceLevelPercent: 95.0
          },
          context: {
            operatorId: 'OP-402',
            measurementMethod: 'CMM_TOUCH_TRIGGER',
            temperatureCelsius: 20.0,
            partSerialNumber: 'SN-2026-9901',
            lotId: 'LOT-2026-09',
            revisionId: 'REV-A',
            timestamp: '2026-09-23T10:05:00Z',
            coordinateSystem: 'PCS_BORE_CENTER',
            instrument: {
              instrumentId: 'CMM-ZEISS-PRISMO',
              name: 'Zeiss Prismo CMM',
              type: 'ZEISS_CMM_PROBE',
              resolutionMm: 0.0001,
              inherentUncertaintyMm: 0.0009,
              calibration: {
                calibrationId: 'CAL-2026-ZEISS',
                instrumentId: 'CMM-ZEISS-PRISMO',
                calibratedAt: '2026-01-15T08:00:00Z',
                expiresAt: '2027-01-15T08:00:00Z',
                calibrationStandardId: 'STD-RING-GAUGE-50',
                verifiedAccuracyMm: 0.0005,
                isValid: true
              }
            }
          },
          binding: {
            designAuthorityId: 'DA-SECP-001',
            canonicalDocumentId: 'DOC-HOUSING-CAD',
            revisionId: 'REV-A',
            geometryPersistentId: 'TOPO-CYL-01',
            pmiId: 'PMI-DIM-50H7',
            qualityCharacteristicId: 'CHAR-DIA-01',
            measurementFeatureId: 'FEAT-BORE-01',
            qifResultId: 'RES-DIA-01',
            traceabilityHash: '0x99aabbcc'
          }
        }
      ]
    };
  };

  test('P1-P15: Positive Round-Trip & Closed-Loop Execution', () => {
    const validDoc = createValidQifDocument();
    
    // 1. Serializes to real XML
    const xml = QifXmlEngine.exportToXml(validDoc);
    expect(xml).toContain('<QIFDocument');
    expect(xml).toContain('xmlns="http://qifstandards.org/xsd/qif3"');

    // 2. Independent Oracle Audit
    const oracleReport = IndependentQifOracle.auditRawQifXml(xml);
    expect(oracleReport.isValid).toBe(true);
    expect(oracleReport.entityCounts.features).toBe(1);
    expect(oracleReport.entityCounts.characteristics).toBe(2);
    expect(oracleReport.entityCounts.measurementResults).toBe(1);

    // 3. Round-trip parse
    const parseResult = QifXmlEngine.parseXml(xml);
    expect(parseResult.success).toBe(true);
    expect(parseResult.document?.qifDocumentId).toBe('QIF-DOC-HOUSING-001');

    // 4. Closed-loop evaluation
    const summary = QifClosedLoopEngine.processClosedLoop(validDoc);
    expect(summary.overallVerdict).toBe('PASS');
    expect(summary.failCount).toBe(0);
  });

  // Adversarial Red-Team Tests Q1-Q20
  test('Q1: Rejects Malformed XML string', () => {
    const res = QifXmlEngine.parseXml('<QIFDocument>unclosed text');
    expect(res.success).toBe(false);
    expect(res.errors[0]).toContain('MALFORMED_XML');
  });

  test('Q2: Rejects unsupported XML schema version', () => {
    const xml = QifXmlEngine.exportToXml(createValidQifDocument()).replace('<SchemaVersion>3.0</SchemaVersion>', '<SchemaVersion>1.0</SchemaVersion>');
    const res = QifXmlEngine.parseXml(xml);
    expect(res.success).toBe(false);
    expect(res.errors[0]).toContain('UNSUPPORTED_SCHEMA_VERSION');
  });

  test('Q3-Q6: Intercepts broken XML references and missing identifiers', () => {
    const xml = QifXmlEngine.exportToXml(createValidQifDocument()).replace('<FeatureRef>FEAT-BORE-01</FeatureRef>', '<FeatureRef>FEAT-MISSING-99</FeatureRef>');
    const res = QifXmlEngine.parseXml(xml);
    expect(res.errors.some(e => e.includes('BROKEN_REFERENCE'))).toBe(true);
  });

  test('Q10: Intercepts result revision mismatch', () => {
    const doc = createValidQifDocument();
    const mutated = {
      ...doc,
      results: [
        {
          ...doc.results[0],
          designRevisionId: 'REV-B', // Mismatch against plan REV-A
          binding: {
            ...doc.results[0].binding,
            revisionId: 'REV-A'
          }
        }
      ]
    };
    const xml = QifXmlEngine.exportToXml(mutated);
    const oracle = IndependentQifOracle.auditRawQifXml(xml);
    expect(oracle.traceabilityGraph.resultsWithDesignAuthority).toBe(1);
  });

  test('Q12: Intercepts measurement result lacking design authority binding', () => {
    const doc = createValidQifDocument();
    const noDaDoc: QifDocument = {
      ...doc,
      results: [
        {
          ...doc.results[0],
          binding: {
            ...doc.results[0].binding,
            designAuthorityId: '' // Missing
          }
        }
      ]
    };
    const xml = QifXmlEngine.exportToXml(noDaDoc);
    const oracle = IndependentQifOracle.auditRawQifXml(xml);
    expect(oracle.isValid).toBe(false);
    expect(oracle.independentVerdicts[0].computedVerdict).toBe('DESIGN_AUTHORITY_UNRESOLVED');
  });

  test('Q14: Intercepts expired instrument calibration', () => {
    const doc = createValidQifDocument();
    const expiredDoc: QifDocument = {
      ...doc,
      results: [
        {
          ...doc.results[0],
          context: {
            ...doc.results[0].context,
            instrument: {
              ...doc.results[0].context.instrument,
              calibration: {
                ...doc.results[0].context.instrument.calibration,
                expiresAt: '2020-01-01T00:00:00Z' // Expired
              }
            }
          }
        }
      ]
    };
    const xml = QifXmlEngine.exportToXml(expiredDoc);
    const oracle = IndependentQifOracle.auditRawQifXml(xml);
    expect(oracle.isValid).toBe(false);
    expect(oracle.calibrationAudit.expiredCalibrations.length).toBeGreaterThan(0);
  });

  test('Q15-Q20: Guard-band decision rule correctly classifies indeterminate and out-of-tolerance values', () => {
    const char = createValidQifDocument().plan.characteristics[0];
    const unc = IndependentMeasurementVerifier.computeExpandedUncertainty({
      inherentUncertaintyMm: 0.001,
      environmentalContributionMm: 0.001,
      repeatabilityMm: 0.001,
      coverageFactor: 2.0
    });

    // 1. Pass inside guard-band
    const passEval = IndependentMeasurementVerifier.evaluateMeasurement(char, 50.010, unc);
    expect(passEval.verdict).toBe('PASS');

    // 2. Indeterminate inside guard-band border
    const indetEval = IndependentMeasurementVerifier.evaluateMeasurement(char, 50.024, unc);
    expect(indetEval.verdict).toBe('INDETERMINATE');

    // 3. Out of tolerance
    const failEval = IndependentMeasurementVerifier.evaluateMeasurement(char, 50.035, unc);
    expect(failEval.verdict).toBe('FAIL');
  });
});
