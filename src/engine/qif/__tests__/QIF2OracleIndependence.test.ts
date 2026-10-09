import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { IndependentQifOracle } from '../IndependentQifOracle';
import { QifXmlEngine } from '../QifXmlEngine';
import { QifDocument } from '../QifTypes';

describe('Point 2: Independent Oracle Isolation & Contamination Proof', () => {
  it('should verify that IndependentQifOracle.ts has ZERO imports from internal SECP modules', () => {
    const oracleFilePath = path.resolve(__dirname, '../IndependentQifOracle.ts');
    const oracleCode = fs.readFileSync(oracleFilePath, 'utf8');

    // Extract all import statements
    const importLines = oracleCode.match(/^import\s+.*$/gm) || [];

    for (const imp of importLines) {
      // Must only import standard node libraries (e.g., 'crypto')
      expect(imp).not.toContain('QifTypes');
      expect(imp).not.toContain('QifMbdMapper');
      expect(imp).not.toContain('QifXmlEngine');
      expect(imp).not.toContain('QifClosedLoopEngine');
      expect(imp).not.toContain('IndependentMeasurementVerifier');
    }
  });

  it('should prove Oracle invariance during internal mapper/engine bug injection (Contamination Test)', () => {
    const doc: QifDocument = {
      qifDocumentId: 'QIF-DOC-TEST',
      header: { title: 'Test Doc', author: 'Auditor', organization: 'SECP', timestamp: '2026-09-23T10:00:00Z', schemaVersion: '3.0' },
      plan: {
        planId: 'PLAN-01',
        designAuthorityId: 'DA-SECP-01',
        revisionId: 'REV-A',
        unitSystem: { lengthUnit: 'MILLIMETRE', angleUnit: 'DEGREE', scaleFactorToMm: 1.0 },
        planHash: 'sha256:1111',
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
          measuredValue: 10.018, // Out of tolerance (10.018 > 10.010)
          deviationMm: 0.018,
          unit: 'mm',
          decisionRule: 'SIMPLE_ACCEPTANCE',
          verdict: 'PASS', // BUG INJECTED IN INTERNAL ENGINE: Marked as PASS despite 10.018 > 10.010!
          evidenceHash: 'sha256:2222',
          uncertainty: { standardUncertaintyMm: 0.001, instrumentContributionMm: 0.0005, environmentalContributionMm: 0.0005, repeatabilityMm: 0.0005, coverageFactor: 2, expandedUncertaintyMm: 0.002, confidenceLevelPercent: 95 },
          context: {
            operatorId: 'OP-1', measurementMethod: 'CMM', temperatureCelsius: 20.0, partSerialNumber: 'SN-01', lotId: 'LOT-01', revisionId: 'REV-A', timestamp: '2026-09-23T10:00:00Z', coordinateSystem: 'PCS',
            instrument: {
              instrumentId: 'INST-1', name: 'Micrometer', type: 'DIGITAL_MICROMETER', resolutionMm: 0.001, inherentUncertaintyMm: 0.001,
              calibration: { calibrationId: 'CAL-1', instrumentId: 'INST-1', calibratedAt: '2026-01-01T00:00:00Z', expiresAt: '2027-01-01T00:00:00Z', calibrationStandardId: 'ISO-1', verifiedAccuracyMm: 0.001, isValid: true }
            }
          },
          binding: { designAuthorityId: 'DA-SECP-01', canonicalDocumentId: 'DOC-1', revisionId: 'REV-A', geometryPersistentId: 'TOP-1', pmiId: 'PMI-1', qualityCharacteristicId: 'CHAR-1', measurementFeatureId: 'FEAT-1', qifResultId: 'RES-1', traceabilityHash: 'sha256:3333' }
        }
      ]
    };

    const xmlText = QifXmlEngine.exportToXml(doc);

    // Independent Oracle evaluates raw XML text completely standalone
    const oracleReport = IndependentQifOracle.auditRawQifXml(xmlText);

    // Oracle must INDEPENDENTLY calculate FAIL for RES-1, ignoring the internal engine's buggy 'PASS' verdict!
    expect(oracleReport.independentVerdicts[0].computedVerdict).toBe('FAIL');
    expect(oracleReport.isValid).toBe(false); // Overall audit fails due to out of tolerance
  });
});
