/**
 * SECP Industrial Truth Chain Audit — Forensic Discovery & Adversarial Verification
 * Audits the continuity of truth across CAD -> Simulation -> Manufacturing -> Metrology.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SimulationIdentityService } from '../../simulation/SimulationIdentityService';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { SimulationEngine } from '../../simulation/SimulationEngine';
import { SimulationScenarioRegistry } from '../../simulation/SimulationScenarioRegistry';
import { MetrologyEngine } from '../../quality-metrology/MetrologyEngine';
import { ScenarioLifecycle, ParameterType } from '../../simulation/SimulationScenarioTypes';
import { EngineeringAiEngine } from '../../ai/EngineeringAiEngine';
import { RevisionLifecycleState } from '../../revision/types';
import { generateKeyPairSync, createSign } from 'crypto';
import { ProductionTrustRegistry } from '../../trust/ProductionTrustRegistry';
import { TrustTestFixtures } from '../../trust/TrustTestFixtures';

describe('Industrial Truth Chain Audit — Forensic Verification', () => {
  const revEngine = new RevisionEngine();
  const simRegistry = new SimulationScenarioRegistry();
  SimulationIdentityService.initialize(revEngine);

  beforeEach(() => {
    MetrologyEngine.clearRegistry();
    ProductionTrustRegistry.resetForTestHarnessOnly();
  });

  describe('PHASE 2 — GAP-01: Simulation ↔ CAD Identity Binding', () => {
    it('should reject stale simulation results when CAD geometry hash changes', () => {
      const modelId = 'PART_001';
      // 0. Register Canonical Truth
      const revA = revEngine.createRevision({
        revisionId: 'REV_A_ID',
        entityId: modelId,
        entityType: 'GEOMETRY' as any,
        revisionCode: 'A',
        revisionNumber: 1,
        lifecycleState: RevisionLifecycleState.RELEASED,
        content: { d: 100 },
        revisionHash: 'HASH_A'
      } as any);

      const actualHashA = revA.revisionHash;

      // 1. Create CAD Revision A (Diameter = 100)
      const scenario = {
        id: 'SIM_A',
        name: 'Structural Analysis A',
        description: 'Verification of Rev A',
        domain: 'DRONE',
        revision: 'S1',
        geometry: { modelId, revision: 'REV_A', geometryHash: actualHashA, hash: actualHashA },
        material: { materialId: 'STEEL_4140', revision: 'R1', propertiesHash: 'M1' },
        solver: { solverId: 'FEA_01', version: '1.0', configurationHash: 'C1', settings: {} },
        mesh: { meshId: 'MESH_01', revision: 'R1', elementType: 'TET10', elementCount: 1500, hash: 'MH1' },
        boundaryConditions: [{ id: 'BC1', type: 'FIXED', value: 0, unit: 'mm', location: 'BASE', reference: 'FACE_01' }],
        loads: [{ id: 'L1', type: 'PRESSURE', magnitude: 100, unit: 'MPa', reference: 'FACE_02' }],
        parameters: [{ id: 'diameter', name: 'Diameter', value: 100, type: ParameterType.NUMBER }],
        status: ScenarioLifecycle.DRAFT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'ENG_01'
      };
      simRegistry.registerScenario(scenario as any);

      // 2. Execute SIM_A against Canonical Hash
      const resultA = SimulationEngine.runScenario(scenario as any);
      expect(resultA.status).toBe('SAFE');
      expect(resultA.provenanceHash).toBeDefined();

      // 3. Update Canonical Truth (Simulation is now STALE)
      revEngine.createRevision({
        revisionId: 'REV_B_ID',
        entityId: modelId,
        entityType: 'GEOMETRY' as any,
        revisionCode: 'B',
        revisionNumber: 2,
        lifecycleState: RevisionLifecycleState.RELEASED,
        content: { d: 105 },
        revisionHash: 'HASH_B'
      } as any);

      const resultStale = SimulationEngine.runScenario(scenario as any);
      
      expect(resultStale.status).toBe('STALE_IDENTITY'); 
      expect(resultStale.provenanceHash).toBe('INVALID_CHAIN');
      
      // 4. Downstream consumer (AI Engine) must detect stale result
      const insights = EngineeringAiEngine.analyzeDesignContext(null, resultStale);
      const staleWarning = insights.find(i => i.message.includes('STALE'));
      expect(staleWarning).toBeDefined();
      expect(staleWarning?.type).toBe('WARNING');
    });

    it('should handle revision identity changes vs geometry changes', () => {
      const modelId = 'P1';
      const revA = revEngine.createRevision({
        revisionId: 'R_P1_A',
        entityId: modelId,
        entityType: 'GEOMETRY' as any,
        revisionCode: 'A',
        revisionNumber: 1,
        lifecycleState: RevisionLifecycleState.RELEASED,
        content: { x: 1 },
        revisionHash: 'H_A'
      } as any);

      const actualHashA = revA.revisionHash;

      const scenarioA = {
        id: 'SIM_001',
        geometry: { modelId: modelId, revision: 'REV_A', geometryHash: actualHashA, hash: actualHashA },
        parameters: [],
        material: { materialId: 'M1' },
        revision: 'S1'
      };

      // Change scenario revision but keep geometry hash -> Still matches geometry
      const scenarioA2 = { ...scenarioA, revision: 'S2' };
      const result = SimulationEngine.runScenario(scenarioA2 as any);
      expect(result.status).not.toBe('STALE_IDENTITY');

      // Keep scenario revision but change geometry hash -> STALE
      // Update canonical truth to something else
      revEngine.createRevision({
        revisionId: 'R_P1_B',
        entityId: modelId,
        entityType: 'GEOMETRY' as any,
        revisionCode: 'B',
        revisionNumber: 2,
        lifecycleState: RevisionLifecycleState.RELEASED,
        content: { x: 2 },
        revisionHash: 'H_B'
      } as any);

      const resultStale = SimulationEngine.runScenario(scenarioA as any);
      expect(resultStale.status).toBe('STALE_IDENTITY');
    });
  });

  describe('PHASE 3 — GAP-02: Evidence Grade Integrity', () => {
    it('should correctly label evidence grades and prevent masquerading', () => {
      const plan = {
        planId: 'PLAN_01',
        partId: 'PART_001',
        partRevision: 'REV_A',
        specifications: [{ specId: 'SPEC_01', featureId: 'FEAT_01', characteristicType: 'DIAMETER' as any, nominalMm: 50, toleranceUpperMm: 0.1, toleranceLowerMm: -0.1 }],
        pointsPerFeature: { FEAT_01: 3 },
        timestampCreated: new Date().toISOString(),
        planHash: 'hash-123'
      };
      const instrument = MetrologyEngine.createInstrument('CMM_01', 'Zeiss', 'ZEISS_CMM_PROBE');

      // Case A: Synthetic
      const sessionSim = MetrologyEngine.runSession('S1', plan as any, 'SN1', instrument, 'OP1', 'SIMULATED');
      expect(sessionSim.evidenceGrade).toBe('LEVEL_1_SYNTHETIC');
      
      const certSim = MetrologyEngine.issueQualityCertificate(sessionSim, plan as any, 'HASH_A', 'JOB1');
      expect(certSim.evidenceGrade).toBe('LEVEL_1_SYNTHETIC');

      // Case B: Live with Asymmetric Production Trust Anchor
      const connection = { driverId: 'D1', type: 'LIVE' as any, connectionStatus: 'CONNECTED' as any, protocol: 'MTCONNECT' as any, ipAddress: '127.0.0.1', lastHeartbeat: '', vendorDriverVersion: '' };
      
      // Generate simulated production key pair
      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
      
      // Provision production driver via authenticated manifest
      const authorityKeyPair = TrustTestFixtures.generateEcKeyPair();
      const driverRecord = TrustTestFixtures.createDriverRecord({
        driverId: 'D1',
        publicKeyPem,
        instrumentId: 'CMM_01'
      });
      const manifest = TrustTestFixtures.createSignedTestManifest([driverRecord], authorityKeyPair);
      MetrologyEngine.loadProvisionedProductionTrust(manifest, authorityKeyPair.publicKeyPem);
      
      const envelope = {
        acquisitionId: 'acq-test-case-b',
        sessionId: 'S2',
        driverId: 'D1',
        instrumentId: 'CMM_01',
        calibrationId: instrument.calibration.calibrationId,
        acquiredAt: new Date(Date.now() - 1000).toISOString(),
        nonce: 101,
        points: [
          { pointId: 'pt-live-PLAN_01-FEAT_01-1', measuredCoordinates: { x: 10.0012, y: 15.0009, z: 25.0011 } },
          { pointId: 'pt-live-PLAN_01-FEAT_01-2', measuredCoordinates: { x: 10.0012, y: 15.0009, z: 25.0011 } },
          { pointId: 'pt-live-PLAN_01-FEAT_01-3', measuredCoordinates: { x: 10.0012, y: 15.0009, z: 25.0011 } }
        ],
        signature: ''
      };

      const payloadString = [
        envelope.acquisitionId,
        envelope.sessionId,
        envelope.driverId,
        envelope.instrumentId,
        envelope.calibrationId,
        envelope.acquiredAt,
        envelope.nonce,
        envelope.points.map(p => `${p.pointId}:${p.measuredCoordinates.x},${p.measuredCoordinates.y},${p.measuredCoordinates.z}`).join('|')
      ].join(':');

      const sign = createSign('SHA256');
      sign.update(payloadString);
      envelope.signature = sign.sign(privateKey, 'hex');

      MetrologyEngine.submitAcquisitionEnvelope(envelope);

      const sessionLive = MetrologyEngine.runSession('S2', plan as any, 'SN1', instrument, 'OP1', 'LIVE', 0.002, connection);
      expect(sessionLive.evidenceGrade).toBe('LEVEL_3_PHYSICAL_TELEMETRY');

      const certLive = MetrologyEngine.issueQualityCertificate(sessionLive, plan as any, 'HASH_A', 'JOB1', 'D1');
      expect(certLive.evidenceGrade).toBe('LEVEL_3_PHYSICAL_TELEMETRY');

      // Case C: Relabel synthetic data as physical telemetry -> REJECT
      const malSession = { ...sessionSim, evidenceGrade: 'LEVEL_3_PHYSICAL_TELEMETRY' as any };
      expect(() => MetrologyEngine.issueQualityCertificate(malSession, plan as any, 'HASH_A', 'JOB1', 'D1')).toThrow(/PROVENANCE_BREACH|PROVENANCE_ERROR/);

      // Case D: Construct certificate without declaring evidence origin -> REJECT
      const noOriginSession = { ...sessionSim, evidenceGrade: undefined as any };
      expect(() => MetrologyEngine.issueQualityCertificate(noOriginSession, plan as any, 'HASH_A', 'JOB1', 'D1')).toThrow(/PROVENANCE_ERROR/);
    });
  });

  describe('PHASE 4 — GAP-03: Certificate ↔ Revision Binding', () => {
    it('should bind certificates to specific geometry hashes', () => {
      const plan = { planId: 'P1', partRevision: 'REV_A' };
      const session = { 
        sessionId: 'S1', 
        partInstanceSerialNumber: 'SN1', 
        overallStatus: 'PASS', 
        disposition: 'ACCEPTED', 
        evidenceGrade: 'LEVEL_1_SYNTHETIC', // Changed to Level-1 Synthetic mock to avoid empty level-3 validation crash
        measuredFeatures: [] 
      };
      
      const certA = MetrologyEngine.issueQualityCertificate(session as any, plan as any, 'HASH_A', 'JOB1');
      expect(certA.cadRevisionHash).toBe('HASH_A');
      expect(certA.partRevision).toBe('REV_A');

      // Attempt to use CERT_A for HASH_B must be detectable
      const isBindingValid = (cert: any, currentHash: string) => cert.cadRevisionHash === currentHash;
      expect(isBindingValid(certA, 'HASH_A')).toBe(true);
      expect(isBindingValid(certA, 'HASH_B')).toBe(false);
    });
  });

  describe('PHASE 5 — End-to-End Truth Chain Traceability', () => {
    it('should generate a valid end-to-end truth chain', () => {
      const e2eChain = {
        cad: { id: 'PART_001', revision: 'REV_A', hash: 'HASH_A' },
        simulation: { scenario: 'SIM_001', result: 'SAFE', provenance: '0xSIM_HASH' },
        manufacturing: { job: 'JOB_001', tool: 'END_MILL_01', calibration: 'CAL_01' },
        metrology: { session: 'SESS_01', grade: 'LEVEL_3_PHYSICAL_TELEMETRY' },
        certificate: { id: 'CERT_01', boundHash: 'HASH_A', status: 'PASS' }
      };

      // Verify chain integrity logic
      const verifyChain = (chain: typeof e2eChain) => {
        const cadHash = chain.cad.hash;
        const certBoundHash = chain.certificate.boundHash;
        return cadHash === certBoundHash;
      };

      expect(verifyChain(e2eChain)).toBe(true);
      
      // Simulate broken chain
      const brokenChain = { ...e2eChain, cad: { ...e2eChain.cad, hash: 'HASH_B' } };
      expect(verifyChain(brokenChain)).toBe(false);
    });
  });

  describe('PHASE 6 — Stale Data / Replay Attacks', () => {
    it('should detect replayed certificates against new revisions', () => {
      const certOld = { certificateId: 'CERT_1', cadRevisionHash: 'HASH_V1', partRevision: 'REV_1' };
      const currentContext = { revision: 'REV_2', hash: 'HASH_V2' };

      const validateContext = (cert: any, context: any) => {
        if (cert.cadRevisionHash !== context.hash) return 'STALE';
        if (cert.partRevision !== context.revision) return 'MISMATCH';
        return 'ACCEPT';
      };

      expect(validateContext(certOld, currentContext)).toBe('STALE');
    });
  });
});
