import { describe, it, expect } from 'vitest';
import { QifXmlEngine } from '../QifXmlEngine';
import { Qif30XsdSchemaValidator } from '../Qif30XsdSchemaValidator';
import { QifDocument } from '../QifTypes';

describe('Point 1: Raw QIF 3.0 ISO 23952 Exchange Schema Proof', () => {
  it('should export valid raw ANSI/ISO 23952 QIF 3.0 XML and pass independent XSD schema validation', () => {
    const doc: QifDocument = {
      qifDocumentId: 'QIF-DOC-HOUSING-001',
      header: {
        title: 'Precision Housing QIF Export',
        author: 'Lead Metrology Engineer',
        organization: 'SECP Aerospace',
        timestamp: '2026-09-23T10:00:00Z',
        schemaVersion: '3.0'
      },
      plan: {
        planId: 'PLAN-HOUSING-01',
        designAuthorityId: 'DA-SECP-AERO-01',
        revisionId: 'REV-A',
        unitSystem: { lengthUnit: 'MILLIMETRE', angleUnit: 'DEGREE', scaleFactorToMm: 1.0 },
        planHash: 'sha256:11223344556677889900aabbccddeeff',
        features: [
          { id: 'FEAT-BORE-01', name: 'Main Bearing Bore', featureType: 'CYLINDER', persistentTopologyId: 'TOPOLOGY-CYL-99', associatedCharacteristicIds: ['CHAR-DIA-01'] }
        ],
        characteristics: [
          {
            id: 'CHAR-DIA-01',
            type: 'DIAMETER',
            name: 'Bore Diameter 50H7',
            nominalValue: 50.000,
            unit: 'mm',
            pmiId: 'PMI-DIM-50H7',
            targetGeometryId: 'TOPOLOGY-CYL-99',
            isCriticalToQuality: true,
            tolerance: { type: 'PLUS_MINUS', upperLimitMm: 50.025, lowerLimitMm: 50.000, upperDeviationMm: 0.025, lowerDeviationMm: 0.000 },
            datumReferences: [{ datumLabel: 'A', precedence: 'PRIMARY', targetGeometryId: 'TOPOLOGY-FACE-A' }]
          }
        ]
      },
      results: [
        {
          resultId: 'RES-001',
          featureId: 'FEAT-BORE-01',
          characteristicId: 'CHAR-DIA-01',
          designRevisionId: 'REV-A',
          partSerialNumber: 'SN-2026-0001',
          lotId: 'LOT-9988',
          nominalValue: 50.000,
          measuredValue: 50.012,
          deviationMm: 0.012,
          unit: 'mm',
          decisionRule: 'GUARD_BANDED_95_CONFIDENCE',
          verdict: 'PASS',
          evidenceHash: 'sha256:aabbcc112233',
          uncertainty: {
            standardUncertaintyMm: 0.001,
            instrumentContributionMm: 0.0008,
            environmentalContributionMm: 0.0004,
            repeatabilityMm: 0.0004,
            coverageFactor: 2,
            expandedUncertaintyMm: 0.002,
            confidenceLevelPercent: 95
          },
          context: {
            operatorId: 'OP-441',
            measurementMethod: 'ZEISS CMM Touch Trigger Probe',
            temperatureCelsius: 20.1,
            partSerialNumber: 'SN-2026-0001',
            lotId: 'LOT-9988',
            revisionId: 'REV-A',
            timestamp: '2026-09-23T10:15:00Z',
            coordinateSystem: 'PCS_BORE_DATUM_A',
            instrument: {
              instrumentId: 'ZEISS-PRISMO-01',
              name: 'Zeiss Prismo CMM',
              type: 'ZEISS_CMM_PROBE',
              resolutionMm: 0.0001,
              inherentUncertaintyMm: 0.0008,
              calibration: {
                calibrationId: 'CAL-2026-88',
                instrumentId: 'ZEISS-PRISMO-01',
                calibratedAt: '2026-01-10T00:00:00Z',
                expiresAt: '2027-01-10T00:00:00Z',
                calibrationStandardId: 'ISO-10360-2',
                verifiedAccuracyMm: 0.0008,
                isValid: true
              }
            }
          },
          binding: {
            designAuthorityId: 'DA-SECP-AERO-01',
            canonicalDocumentId: 'DOC-CAD-HOUSING-01',
            revisionId: 'REV-A',
            geometryPersistentId: 'TOPOLOGY-CYL-99',
            pmiId: 'PMI-DIM-50H7',
            qualityCharacteristicId: 'CHAR-DIA-01',
            measurementFeatureId: 'FEAT-BORE-01',
            qifResultId: 'RES-001',
            traceabilityHash: 'sha256:8877665544332211'
          }
        }
      ]
    };

    const rawXml = QifXmlEngine.exportToXml(doc);
    expect(rawXml).toContain('<QIFDocument xmlns="http://qifstandards.org/xsd/qif3"');
    expect(rawXml).toContain('<QPId>QIF-DOC-HOUSING-001</QPId>');
    expect(rawXml).toContain('version="3.0.0"');

    const schemaAudit = Qif30XsdSchemaValidator.validateQif30ExchangeXml(rawXml);
    expect(schemaAudit.isQif30Compliant).toBe(true);
    expect(schemaAudit.targetNamespace).toBe('http://qifstandards.org/xsd/qif3');
    expect(schemaAudit.elementsValidated.qpIdFound).toBe(true);
    expect(schemaAudit.elementsValidated.headerFound).toBe(true);
    expect(schemaAudit.elementsValidated.fileUnitsFound).toBe(true);
    expect(schemaAudit.elementsValidated.featuresFound).toBe(true);
    expect(schemaAudit.elementsValidated.characteristicsFound).toBe(true);
    expect(schemaAudit.elementsValidated.planFound).toBe(true);
    expect(schemaAudit.elementsValidated.resultsFound).toBe(true);
    expect(schemaAudit.validationErrors).toHaveLength(0);
  });
});
