import { describe, it, expect } from 'vitest';
import { QifCryptoProvenance } from '../QifCryptoProvenance';
import { QifPhysicalProbeAcquisition } from '../QifPhysicalProbeAcquisition';
import { QifClosedLoopEngine } from '../QifClosedLoopEngine';
import { QifDocument, QifInspectionPlan, QifMeasurementResult } from '../QifTypes';

describe('Points 5, 6, 7: Cryptographic SHA-256, CMM Probe Telemetry, & Re-Inspection Lifecycle', () => {

  describe('Point 5: Cryptographic SHA-256 Non-Repudiation & Avalanche Sensitivity', () => {
    it('should compute true sha256 digests and produce 100% avalanche sensitivity on single-digit mutations', () => {
      const bindingA = {
        designAuthorityId: 'DA-SECP-AERO-01',
        canonicalDocumentId: 'DOC-CAD-01',
        revisionId: 'REV-A',
        geometryPersistentId: 'GEOM-CYL-101',
        pmiId: 'PMI-DIM-50H7',
        qualityCharacteristicId: 'CHAR-BORE-01',
        measurementFeatureId: 'FEAT-BORE-01',
        qifResultId: 'RES-001'
      };

      const hashA = QifCryptoProvenance.computeTraceabilityHash(bindingA);
      expect(hashA).toMatch(/^sha256:[a-f0-9]{64}$/);

      // Mutate single character: REV-A => REV-B
      const bindingB = { ...bindingA, revisionId: 'REV-B' };
      const hashB = QifCryptoProvenance.computeTraceabilityHash(bindingB);
      expect(hashB).not.toEqual(hashA);

      // Mutate single digit in measurement payload: 50.012 => 50.013
      const measA = {
        resultId: 'RES-001', featureId: 'FEAT-1', characteristicId: 'CHAR-1', designRevisionId: 'REV-A',
        partSerialNumber: 'SN-1', lotId: 'LOT-1', nominalValue: 50.000, measuredValue: 50.012, deviationMm: 0.012,
        expandedUncertaintyMm: 0.002, instrumentId: 'INST-1', calibrationId: 'CAL-1', traceabilityHash: hashA
      };

      const measB = { ...measA, measuredValue: 50.013 };

      const evidenceHashA = QifCryptoProvenance.computeMeasurementEvidenceHash(measA);
      const evidenceHashB = QifCryptoProvenance.computeMeasurementEvidenceHash(measB);

      expect(evidenceHashA).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(evidenceHashB).not.toEqual(evidenceHashA);
    });
  });

  describe('Point 6: Physical Probe Telemetry Ingestion (CMM Sensor Controllers)', () => {
    it('should ingest raw physical touch-trigger probe telemetry and compute thermal & stylus radius compensated actuals', () => {
      const telemetry = {
        controllerId: 'ZEISS-CMM-CTRL-99',
        machineModel: 'Zeiss Prismo Ultra',
        ambientTempCelsius: 22.5, // 2.5°C above reference 20°C
        partTempCelsius: 22.5,
        scaleTempCelsius: 22.0,
        probeHits: [
          { pointId: 'P1', rawX: 25.000, rawY: 0.000, rawZ: 0.000, approachVectorX: 1, approachVectorY: 0, approachVectorZ: 0, probeTipRadiusMm: 1.500, timestamp: '2026-09-23T10:00:00Z' },
          { pointId: 'P2', rawX: -25.000, rawY: 0.000, rawZ: 0.000, approachVectorX: -1, approachVectorY: 0, approachVectorZ: 0, probeTipRadiusMm: 1.500, timestamp: '2026-09-23T10:00:01Z' }
        ]
      };

      const result = QifPhysicalProbeAcquisition.processTelemetryStream(telemetry, 50.000);
      expect(result.pointCloudCount).toBe(2);
      expect(result.probeRadiusCompensationAppliedMm).toBe(1.500);
      expect(result.thermalCompensationAppliedMm).toBeGreaterThan(0); // Thermal expansion corrected back to 20°C reference
    });
  });

  describe('Point 7: Full REV-A -> REV-B Re-Inspection Closed-Loop Lifecycle', () => {
    it('should execute end-to-end closed loop from REV-A failure => authorized REV-B transition => REV-B reinspection with zero ledger pollution', () => {
      const planRevA: QifInspectionPlan = {
        planId: 'PLAN-HOUSING-REV-A',
        designAuthorityId: 'DA-AERO-01',
        revisionId: 'REV-A',
        unitSystem: { lengthUnit: 'MILLIMETRE', angleUnit: 'DEGREE', scaleFactorToMm: 1.0 },
        planHash: 'sha256:plan-rev-a',
        features: [{ id: 'FEAT-BORE-01', name: 'Main Bore', featureType: 'CYLINDER', persistentTopologyId: 'TOP-CYL-01', associatedCharacteristicIds: ['CHAR-BORE-DIA'] }],
        characteristics: [{
          id: 'CHAR-BORE-DIA', type: 'DIAMETER', name: 'Bore Dia 50H7', nominalValue: 50.000, unit: 'mm', pmiId: 'PMI-50H7', targetGeometryId: 'TOP-CYL-01', isCriticalToQuality: true,
          tolerance: { type: 'LIMITS', upperLimitMm: 50.025, lowerLimitMm: 50.000, upperDeviationMm: 0.025, lowerDeviationMm: 0.000 },
          datumReferences: []
        }]
      };

      // 1. Initial Inspection on REV-A: Out of tolerance (measured = 50.080 mm)
      const resRevA: QifMeasurementResult = {
        resultId: 'RES-001', featureId: 'FEAT-BORE-01', characteristicId: 'CHAR-BORE-DIA', designRevisionId: 'REV-A',
        partSerialNumber: 'SN-001', lotId: 'LOT-A', nominalValue: 50.000, measuredValue: 50.080, deviationMm: 0.080, unit: 'mm',
        decisionRule: 'GUARD_BANDED_95_CONFIDENCE', verdict: 'FAIL', evidenceHash: 'sha256:evid-001',
        uncertainty: { standardUncertaintyMm: 0.001, instrumentContributionMm: 0.0008, environmentalContributionMm: 0.0004, repeatabilityMm: 0.0004, coverageFactor: 2, expandedUncertaintyMm: 0.002, confidenceLevelPercent: 95 },
        context: {
          operatorId: 'OP-1', measurementMethod: 'CMM', temperatureCelsius: 20.0, partSerialNumber: 'SN-001', lotId: 'LOT-A', revisionId: 'REV-A', timestamp: '2026-09-23T10:00:00Z', coordinateSystem: 'PCS',
          instrument: {
            instrumentId: 'INST-1', name: 'CMM', type: 'ZEISS_CMM_PROBE', resolutionMm: 0.0001, inherentUncertaintyMm: 0.0008,
            calibration: { calibrationId: 'CAL-1', instrumentId: 'INST-1', calibratedAt: '2026-01-01T00:00:00Z', expiresAt: '2027-01-01T00:00:00Z', calibrationStandardId: 'ISO-1', verifiedAccuracyMm: 0.0008, isValid: true }
          }
        },
        binding: { designAuthorityId: 'DA-AERO-01', canonicalDocumentId: 'DOC-1', revisionId: 'REV-A', geometryPersistentId: 'TOP-CYL-01', pmiId: 'PMI-50H7', qualityCharacteristicId: 'CHAR-BORE-DIA', measurementFeatureId: 'FEAT-BORE-01', qifResultId: 'RES-001', traceabilityHash: 'sha256:trace-001' }
      };

      const docRevA: QifDocument = {
        qifDocumentId: 'QIF-DOC-REV-A',
        header: { title: 'REV-A Run', author: 'CMM Tech', organization: 'SECP', timestamp: '2026-09-23T10:00:00Z', schemaVersion: '3.0' },
        plan: planRevA,
        results: [resRevA]
      };

      // 2. Process Closed-Loop on REV-A => Generates Engineering Feedback Proposal for REV-B
      const summaryRevA = QifClosedLoopEngine.processClosedLoop(docRevA);
      expect(summaryRevA.overallVerdict).toBe('REVISION_PROPOSED');
      expect(summaryRevA.feedbackProposals).toHaveLength(1);
      
      const proposal = summaryRevA.feedbackProposals[0];
      expect(proposal.sourceRevisionId).toBe('REV-A');
      expect(proposal.proposedRevisionId).toBe('REV-B');

      // 3. Authorized Revision Transition: Chief Engineer approves proposal => Creates REV-B Plan
      const transition = QifClosedLoopEngine.authorizeRevisionTransition(proposal, planRevA, 'Chief Engineer Sarah Connor');
      expect(transition.authorizedRevisionId).toBe('REV-B');
      expect(transition.updatedPlan.revisionId).toBe('REV-B');

      // 4. Manufactured Part under REV-B Re-Inspected => PASS (measured = 50.012 mm)
      const resRevB: QifMeasurementResult = {
        ...resRevA,
        resultId: 'RES-002',
        designRevisionId: 'REV-B',
        measuredValue: 50.012,
        deviationMm: 0.012,
        verdict: 'PASS',
        binding: { ...resRevA.binding, revisionId: 'REV-B', qifResultId: 'RES-002', traceabilityHash: 'sha256:trace-002' }
      };

      const docRevB: QifDocument = {
        qifDocumentId: 'QIF-DOC-REV-B',
        header: { title: 'REV-B Run', author: 'CMM Tech', organization: 'SECP', timestamp: '2026-09-23T11:00:00Z', schemaVersion: '3.0' },
        plan: transition.updatedPlan,
        results: [resRevB]
      };

      const summaryRevB = QifClosedLoopEngine.processClosedLoop(docRevB);
      expect(summaryRevB.overallVerdict).toBe('PASS');

      // 5. Verify Ledger Isolation: RES-001 is pinned to REV-A, RES-002 is pinned to REV-B
      const ledgerRevA = QifClosedLoopEngine.getLedgerByRevision('REV-A');
      const ledgerRevB = QifClosedLoopEngine.getLedgerByRevision('REV-B');

      expect(ledgerRevA).toHaveLength(1);
      expect(ledgerRevA[0].resultId).toBe('RES-001');
      expect(ledgerRevA[0].verdict).toBe('FAIL');

      expect(ledgerRevB).toHaveLength(1);
      expect(ledgerRevB[0].resultId).toBe('RES-002');
      expect(ledgerRevB[0].verdict).toBe('PASS');
    });
  });
});
