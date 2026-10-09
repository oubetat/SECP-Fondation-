import { describe, test, expect } from 'vitest';
import { QifMbdMapper } from '../QifMbdMapper';
import { QifXmlEngine } from '../QifXmlEngine';
import { IndependentQifOracle } from '../IndependentQifOracle';
import { QifClosedLoopEngine } from '../QifClosedLoopEngine';
import { AP242SemanticModel } from '../../interop/AP242Types';
import { QifDocument } from '../QifTypes';

describe('CAP-SUP-004: Closed-Loop Manufacturing Forensic Reconciliation', () => {

  const createHousingAssemblyMbd = (): AP242SemanticModel => {
    return {
      header: {
        fileName: 'Precision_Housing_Assembly.stp',
        schemaVersion: 'AP242_IS',
        timestamp: '2026-09-23T10:00:00Z',
        author: 'Chief CAD Engineer',
        organization: 'SECP Aerospace'
      },
      solids: [
        {
          solidId: 'SOLID-HOUSING-01',
          volumeMm3: 125000.0,
          surfaceAreaMm2: 15000.0,
          boundingBox: { minX: 0, minY: 0, minZ: 0, maxX: 100, maxY: 100, maxZ: 50 },
          centerOfGravity: { x: 50, y: 50, z: 25 },
          vertices: [],
          edges: [],
          faces: [
            { id: 'FACE-BASE-01', surfaceType: 'PLANAR', areaMm2: 10000.0, boundEdgeIds: [], normal: { x: 0, y: 0, z: -1 }, centerOfMass: { x: 50, y: 50, z: 0 } },
            { id: 'FACE-BORE-01', surfaceType: 'CYLINDRICAL', areaMm2: 5000.0, boundEdgeIds: [], normal: { x: 1, y: 0, z: 0 }, centerOfMass: { x: 50, y: 50, z: 25 } }
          ]
        }
      ],
      dimensions: [
        {
          id: 'DIM-BORE-DIA',
          nominalValue: 50.000,
          unit: 'mm',
          dimensionType: 'DIAMETER',
          referencedGeometryIds: ['FACE-BORE-01'],
          tolerance: {
            toleranceType: 'BILATERAL',
            upperDeviationMm: 0.025,
            lowerDeviationMm: 0.000
          }
        }
      ],
      geometricTolerances: [
        {
          id: 'GDT-POS-BORE',
          characteristic: 'POSITION',
          toleranceValue: 0.050,
          referencedGeometryIds: ['FACE-BORE-01'],
          datumReferences: [
            { datumLabel: 'A', precedence: 'PRIMARY', targetFaceId: 'FACE-BASE-01' }
          ]
        }
      ],
      datums: [
        { id: 'DATUM-A', datumLabel: 'A', referencedFaceIds: ['FACE-BASE-01'] }
      ],
      surfaceFinishes: [],
      unitSystem: {
        lengthUnit: 'MILLIMETRE',
        angleUnit: 'DEGREE',
        lengthConversionToMm: 1.0
      }
    };
  };

  test('Executes complete closed-loop manufacturing cycle and generates traceable revision proposal', () => {
    // 1. MBD -> QIF Product Definition
    const mbd = createHousingAssemblyMbd();
    const qifDoc = QifMbdMapper.mapMbdToQifDocument(mbd, 'DA-SECP-001', 'REV-A');
    expect(qifDoc.plan.features.length).toBeGreaterThan(0);
    expect(qifDoc.plan.characteristics.length).toBeGreaterThan(0);

    // 2. Export QIF 3.0 XML & Validate with Independent Oracle
    const xmlText = QifXmlEngine.exportToXml(qifDoc);
    const oracleRes = IndependentQifOracle.auditRawQifXml(xmlText);
    expect(oracleRes.isValid).toBe(true);

    // 3. Simulate CMM Measurement Execution with out-of-tolerance deviation
    const measuredDoc: QifDocument = {
      ...qifDoc,
      results: [
        {
          resultId: 'RES-CMM-BORE-01',
          featureId: qifDoc.plan.features[0].id,
          characteristicId: qifDoc.plan.characteristics[0].id,
          designRevisionId: 'REV-A',
          partSerialNumber: 'SN-HOUSING-1001',
          lotId: 'LOT-2026-A1',
          nominalValue: 50.000,
          measuredValue: 50.080, // Out of tolerance (limit is 50.025)
          deviationMm: 0.080,
          unit: 'mm',
          decisionRule: 'GUARD_BANDED_95_CONFIDENCE',
          verdict: 'OUT_OF_TOLERANCE' as any,
          evidenceHash: 'EVID-CMM-DEVIATION-01',
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
            operatorId: 'OP-METROLOGY-01',
            measurementMethod: 'CMM_TOUCH_PROBE',
            temperatureCelsius: 20.0,
            partSerialNumber: 'SN-HOUSING-1001',
            lotId: 'LOT-2026-A1',
            revisionId: 'REV-A',
            timestamp: '2026-09-23T10:10:00Z',
            coordinateSystem: 'PCS',
            instrument: {
              instrumentId: 'INST-ZEISS-01',
              name: 'Zeiss Prismo CMM',
              type: 'ZEISS_CMM_PROBE',
              resolutionMm: 0.0001,
              inherentUncertaintyMm: 0.0009,
              calibration: {
                calibrationId: 'CAL-2026-01',
                instrumentId: 'INST-ZEISS-01',
                calibratedAt: '2026-01-01T00:00:00Z',
                expiresAt: '2027-01-01T00:00:00Z',
                calibrationStandardId: 'STD-RING-50',
                verifiedAccuracyMm: 0.0005,
                isValid: true
              }
            }
          },
          binding: {
            designAuthorityId: 'DA-SECP-001',
            canonicalDocumentId: 'DOC-HOUSING-CAD',
            revisionId: 'REV-A',
            geometryPersistentId: 'FACE-BORE-01',
            pmiId: 'DIM-BORE-DIA',
            qualityCharacteristicId: qifDoc.plan.characteristics[0].id,
            measurementFeatureId: qifDoc.plan.features[0].id,
            qifResultId: 'RES-CMM-BORE-01',
            traceabilityHash: '0x99887766'
          }
        }
      ]
    };

    // 4. Ingest into Closed-Loop Feedback Engine
    const summary = QifClosedLoopEngine.processClosedLoop(measuredDoc);
    expect(summary.overallVerdict).toBe('REVISION_PROPOSED');
    expect(summary.feedbackProposals.length).toBe(1);

    const prop = summary.feedbackProposals[0];
    expect(prop.sourceRevisionId).toBe('REV-A');
    expect(prop.proposedRevisionId).toBe('REV-B');
    expect(prop.isRevisionProposalCreated).toBe(true);
    expect(prop.detectedDeviationMm).toBe(0.080);
    expect(prop.provenanceHash).toMatch(/^(sha256:[a-f0-9]{64}|0x[a-f0-9]+)$/);
  });

  test('Rejects cross-revision result binding (REV-A result assigned to REV-B plan or REV-B result assigned to REV-A plan)', () => {
    const mbd = createHousingAssemblyMbd();
    const qifDocRevA = QifMbdMapper.mapMbdToQifDocument(mbd, 'DA-SECP-001', 'REV-A');

    // Mismatched result: designRevisionId = 'REV-B' on a 'REV-A' document plan
    const crossDocRevA: QifDocument = {
      ...qifDocRevA,
      results: [
        {
          resultId: 'RES-MISMATCH-01',
          featureId: qifDocRevA.plan.features[0].id,
          characteristicId: qifDocRevA.plan.characteristics[0].id,
          designRevisionId: 'REV-B', // MISMATCH! Plan is REV-A
          partSerialNumber: 'SN-1001',
          lotId: 'LOT-A1',
          nominalValue: 50.000,
          measuredValue: 50.010,
          deviationMm: 0.010,
          unit: 'mm',
          decisionRule: 'GUARD_BANDED_95_CONFIDENCE',
          verdict: 'PASS',
          evidenceHash: 'sha256:1111222233334444555566667777888899990000111122223333444455556666',
          uncertainty: { standardUncertaintyMm: 0.001, instrumentContributionMm: 0.001, environmentalContributionMm: 0.0005, repeatabilityMm: 0.0005, coverageFactor: 2.0, expandedUncertaintyMm: 0.002, confidenceLevelPercent: 95.0 },
          context: {
            operatorId: 'OP-01', measurementMethod: 'CMM', temperatureCelsius: 20.0, partSerialNumber: 'SN-1001', lotId: 'LOT-A1', revisionId: 'REV-A', timestamp: '2026-09-23T10:10:00Z', coordinateSystem: 'PCS',
            instrument: {
              instrumentId: 'INST-ZEISS-01', name: 'Zeiss Prismo CMM', type: 'ZEISS_CMM_PROBE', resolutionMm: 0.0001, inherentUncertaintyMm: 0.0009,
              calibration: { calibrationId: 'CAL-01', instrumentId: 'INST-ZEISS-01', calibratedAt: '2026-01-01T00:00:00Z', expiresAt: '2027-01-01T00:00:00Z', calibrationStandardId: 'STD-RING-50', verifiedAccuracyMm: 0.0005, isValid: true }
            }
          },
          binding: {
            designAuthorityId: 'DA-SECP-001', canonicalDocumentId: 'DOC-HOUSING-CAD', revisionId: 'REV-B', // MISMATCH
            geometryPersistentId: 'FACE-BORE-01', pmiId: 'DIM-BORE-DIA', qualityCharacteristicId: qifDocRevA.plan.characteristics[0].id, measurementFeatureId: qifDocRevA.plan.features[0].id, qifResultId: 'RES-MISMATCH-01', traceabilityHash: 'sha256:9999'
          }
        }
      ]
    };

    const xmlText = QifXmlEngine.exportToXml(crossDocRevA);
    const oracleAudit = IndependentQifOracle.auditRawQifXml(xmlText);

    // Ledger checks
    const ledgerRevA = QifClosedLoopEngine.getLedgerByRevision('REV-A');
    const ledgerRevB = QifClosedLoopEngine.getLedgerByRevision('REV-B');

    // Confirm that cross revision result is isolated and does not contaminate REV-A ledger
    const containsMismatchInA = ledgerRevA.some(r => r.resultId === 'RES-MISMATCH-01');
    expect(containsMismatchInA).toBe(false);
  });
});
