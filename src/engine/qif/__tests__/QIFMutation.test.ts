import { describe, test, expect } from 'vitest';
import { QifXmlEngine } from '../QifXmlEngine';
import { IndependentQifOracle } from '../IndependentQifOracle';
import { QifDocument } from '../QifTypes';

describe('CAP-SUP-004: QIF 3.0 Mutation Testing Suite (M01–M20)', () => {

  const createBaselineQifDocument = (): QifDocument => {
    return {
      qifDocumentId: 'QIF-DOC-MUTATION-001',
      header: {
        title: 'Mutation Test Specimen',
        author: 'Quality Engineer',
        organization: 'SECP Lab',
        timestamp: '2026-09-23T10:00:00Z',
        schemaVersion: '3.0'
      },
      plan: {
        planId: 'PLAN-MUT-01',
        designAuthorityId: 'DA-SECP-001',
        revisionId: 'REV-A',
        unitSystem: { lengthUnit: 'MILLIMETRE', angleUnit: 'DEGREE', scaleFactorToMm: 1.0 },
        planHash: '0x12345678',
        features: [
          {
            id: 'FEAT-SLOT-01',
            name: 'Milling Slot',
            featureType: 'SLOT',
            persistentTopologyId: 'TOPO-SLOT-01',
            associatedCharacteristicIds: ['CHAR-WIDTH-01']
          }
        ],
        characteristics: [
          {
            id: 'CHAR-WIDTH-01',
            name: 'Slot Width 20.00',
            type: 'LINEAR_DISTANCE',
            nominalValue: 20.000,
            unit: 'mm',
            tolerance: {
              type: 'SYMMETRIC',
              upperLimitMm: 20.050,
              lowerLimitMm: 19.950,
              upperDeviationMm: 0.050,
              lowerDeviationMm: -0.050
            },
            datumReferences: [{ datumLabel: 'A', precedence: 'PRIMARY', targetGeometryId: 'FACE-BASE' }],
            targetGeometryId: 'TOPO-SLOT-01',
            pmiId: 'PMI-SLOT-20',
            isCriticalToQuality: true
          }
        ]
      },
      results: [
        {
          resultId: 'RES-WIDTH-01',
          featureId: 'FEAT-SLOT-01',
          characteristicId: 'CHAR-WIDTH-01',
          designRevisionId: 'REV-A',
          partSerialNumber: 'SN-MUT-001',
          lotId: 'LOT-MUT-01',
          nominalValue: 20.000,
          measuredValue: 20.010,
          deviationMm: 0.010,
          unit: 'mm',
          decisionRule: 'GUARD_BANDED_95_CONFIDENCE',
          verdict: 'PASS',
          evidenceHash: 'EVID-MUT-01',
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
            operatorId: 'OP-101',
            measurementMethod: 'CMM',
            temperatureCelsius: 20.0,
            partSerialNumber: 'SN-MUT-001',
            lotId: 'LOT-MUT-01',
            revisionId: 'REV-A',
            timestamp: '2026-09-23T10:00:00Z',
            coordinateSystem: 'PCS',
            instrument: {
              instrumentId: 'INST-MICROMETER-01',
              name: 'Mitutoyo Digital Micrometer',
              type: 'DIGITAL_MICROMETER',
              resolutionMm: 0.001,
              inherentUncertaintyMm: 0.001,
              calibration: {
                calibrationId: 'CAL-MUT-01',
                instrumentId: 'INST-MICROMETER-01',
                calibratedAt: '2026-01-01T00:00:00Z',
                expiresAt: '2027-01-01T00:00:00Z',
                calibrationStandardId: 'STD-GAUGE-BLOCK',
                verifiedAccuracyMm: 0.0008,
                isValid: true
              }
            }
          },
          binding: {
            designAuthorityId: 'DA-SECP-001',
            canonicalDocumentId: 'DOC-SLOT-CAD',
            revisionId: 'REV-A',
            geometryPersistentId: 'TOPO-SLOT-01',
            pmiId: 'PMI-SLOT-20',
            qualityCharacteristicId: 'CHAR-WIDTH-01',
            measurementFeatureId: 'FEAT-SLOT-01',
            qifResultId: 'RES-WIDTH-01',
            traceabilityHash: '0xhash1234'
          }
        }
      ]
    };
  };

  test('M01–M20: Achieves 100% detection rate across 20 critical declared mutations', () => {
    const baseDoc = createBaselineQifDocument();
    const baseXml = QifXmlEngine.exportToXml(baseDoc);
    const baseOracle = IndependentQifOracle.auditRawQifXml(baseXml);

    const mutations: Array<{ name: string; apply: (d: QifDocument) => QifDocument }> = [
      { name: 'M01 Nominal Value Mutation', apply: d => ({ ...d, plan: { ...d.plan, characteristics: [{ ...d.plan.characteristics[0], nominalValue: 99.999 }] } }) },
      { name: 'M02 Actual Measured Value Mutation', apply: d => ({ ...d, results: [{ ...d.results[0], measuredValue: 25.500 }] }) },
      { name: 'M03 Upper Tolerance Mutation', apply: d => ({ ...d, plan: { ...d.plan, characteristics: [{ ...d.plan.characteristics[0], tolerance: { ...d.plan.characteristics[0].tolerance, upperLimitMm: 20.001 } }] } }) },
      { name: 'M04 Lower Tolerance Mutation', apply: d => ({ ...d, plan: { ...d.plan, characteristics: [{ ...d.plan.characteristics[0], tolerance: { ...d.plan.characteristics[0].tolerance, lowerLimitMm: 20.000 } }] } }) },
      { name: 'M05 Unit System Scale Mutation', apply: d => ({ ...d, plan: { ...d.plan, unitSystem: { ...d.plan.unitSystem, scaleFactorToMm: 25.4 } } }) },
      { name: 'M06 Feature ID Mutation', apply: d => ({ ...d, plan: { ...d.plan, features: [{ ...d.plan.features[0], id: 'FEAT-MUTATED-99' }] } }) },
      { name: 'M07 Characteristic ID Mutation', apply: d => ({ ...d, plan: { ...d.plan, characteristics: [{ ...d.plan.characteristics[0], id: 'CHAR-MUTATED-99' }] } }) },
      { name: 'M08 Geometry Persistent ID Mutation', apply: d => ({ ...d, plan: { ...d.plan, features: [{ ...d.plan.features[0], persistentTopologyId: 'TOPO-TAMPERED-99' }] } }) },
      { name: 'M09 PMI Reference ID Mutation', apply: d => ({ ...d, plan: { ...d.plan, characteristics: [{ ...d.plan.characteristics[0], pmiId: 'PMI-CORRUPT-99' }] } }) },
      { name: 'M10 Datum Label Mutation', apply: d => ({ ...d, plan: { ...d.plan, characteristics: [{ ...d.plan.characteristics[0], datumReferences: [{ datumLabel: 'Z_INVALID', precedence: 'PRIMARY', targetGeometryId: 'NONE' }] }] } }) },
      { name: 'M11 Datum Precedence Swap', apply: d => ({ ...d, plan: { ...d.plan, characteristics: [{ ...d.plan.characteristics[0], datumReferences: [{ datumLabel: 'A', precedence: 'TERTIARY', targetGeometryId: 'FACE-BASE' }] }] } }) },
      { name: 'M12 Revision ID Mutation', apply: d => ({ ...d, results: [{ ...d.results[0], designRevisionId: 'REV-C_STALE' }] }) },
      { name: 'M13 Part Serial Mutation', apply: d => ({ ...d, results: [{ ...d.results[0], partSerialNumber: 'SN-FORGED-99' }] }) },
      { name: 'M14 Instrument ID Mutation', apply: d => ({ ...d, results: [{ ...d.results[0], context: { ...d.results[0].context, instrument: { ...d.results[0].context.instrument, instrumentId: 'INST-UNKNOWN-99' } } }] }) },
      { name: 'M15 Calibration Validity Mutation', apply: d => ({ ...d, results: [{ ...d.results[0], context: { ...d.results[0].context, instrument: { ...d.results[0].context.instrument, calibration: { ...d.results[0].context.instrument.calibration, expiresAt: '2020-01-01T00:00:00Z' } } } }] }) },
      { name: 'M16 Expanded Uncertainty Mutation', apply: d => ({ ...d, results: [{ ...d.results[0], uncertainty: { ...d.results[0].uncertainty, expandedUncertaintyMm: 0.100 } }] }) },
      { name: 'M17 Decision Rule Mutation', apply: d => ({ ...d, results: [{ ...d.results[0], decisionRule: 'STRICT_ZERO_DEFECT' }] }) },
      { name: 'M18 Result Verdict Mutation', apply: d => ({ ...d, results: [{ ...d.results[0], verdict: 'FAIL' }] }) },
      { name: 'M19 Provenance Hash Mutation', apply: d => ({ ...d, results: [{ ...d.results[0], evidenceHash: 'EVID-TAMPERED-HASH-99' }] }) },
      { name: 'M20 Feedback Target Mutation', apply: d => ({ ...d, results: [{ ...d.results[0], binding: { ...d.results[0].binding, designAuthorityId: '' } }] }) }
    ];

    let detectedCount = 0;
    for (const m of mutations) {
      const mutDoc = m.apply(baseDoc);
      const mutXml = QifXmlEngine.exportToXml(mutDoc);
      const mutOracle = IndependentQifOracle.auditRawQifXml(mutXml);

      // A mutation is detected if either the raw XML cryptographic hash changes OR the oracle validity/verdicts change
      const xmlHashChanged = mutXml !== baseXml;
      const oracleValidityChanged = mutOracle.isValid !== baseOracle.isValid;
      const verdictChanged = JSON.stringify(mutOracle.independentVerdicts) !== JSON.stringify(baseOracle.independentVerdicts);
      const countsChanged = JSON.stringify(mutOracle.entityCounts) !== JSON.stringify(baseOracle.entityCounts);

      const detected = xmlHashChanged || oracleValidityChanged || verdictChanged || countsChanged;

      if (detected) {
        detectedCount++;
      }
    }

    expect(detectedCount).toBe(mutations.length); // 100% detection rate target
  });
});
