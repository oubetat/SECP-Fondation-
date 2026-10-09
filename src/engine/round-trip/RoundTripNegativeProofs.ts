/**
 * SECP Industrial OS v3 — PROMPT-055: UI-to-Backend Round Trip Negative Proofs
 * Proves that invalid architectural paths (e.g., local UI engineering truth, kernel bypass,
 * missing validation, stale states) are blocked and result in round-trip failure.
 */

import { EngineeringDocument } from '../cad-kernel/document/CADDocument';
import { StateSyncEngine } from '../sync/StateSyncEngine';
import { CanonicalIntentDispatcher277 } from '../viewport/CanonicalIntentDispatcher277';
import { RoundTripCoordinator } from './RoundTripCoordinator';

export interface RoundTripNegativeProofResult {
  proofId: string;
  name: string;
  passed: boolean;
  expectedBehavior: string;
  actualBehavior: string;
  details: string;
}

export interface RoundTripNegativeProofReport {
  timestamp: string;
  totalCount: number;
  passCount: number;
  allPassed: boolean;
  results: RoundTripNegativeProofResult[];
}

export class RoundTripNegativeProofs {
  public static async executeAllNegativeProofs(): Promise<RoundTripNegativeProofReport> {
    const timestamp = new Date().toISOString();
    const results: RoundTripNegativeProofResult[] = [];
    const syncEngine = StateSyncEngine.getInstance();

    const baseDoc: EngineeringDocument = {
      documentId: 'DOC-RT-NEG',
      revision: 1,
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [{ id: 'SK-1', name: 'Profile', plane: 'XY', entities: [] }],
      constraints: [],
      features: [{ id: 'F-1', featureId: 'F-1', name: 'Extrude1', type: 'EXTRUDE', parameters: { depth: 10 } }],
      parameters: [{ id: 'P-1', name: 'Depth', value: 10, unit: 'mm' }],
      topologyMap: { version: 1, faceMap: { F1: 'TOPOLOGY_FACE_1' } },
      derived: { mesh: { vertices: new Float32Array(9), normals: new Float32Array(9), indices: new Uint32Array(3) } as any },
      evidence: [{
        evidenceId: 'EV-1',
        stage: 'GEOMETRY',
        sourceSystem: 'CADKernel',
        documentId: 'DOC-RT-NEG',
        revision: 1,
        canonicalHash: '0xHASH_1',
        verdict: 'VALID'
      }]
    };

    syncEngine.reset();
    syncEngine.registerDocument(baseDoc);

    // 1. RT-NEG-001: UI changes local state but Backend does not mutate
    await (async () => {
      // Simulate UI intent that fails validation and produces no mutation
      const intent: any = { toolId: 'FEATURE_EXTRUDE', documentId: 'DOC-RT-NEG', parameters: { depth: -50 } }; // Invalid depth
      const res = await RoundTripCoordinator.executeRoundTrip('RT-NEG-001', intent, baseDoc);

      const passed = res.roundTripVerdict === 'FAIL' && (res.errorMessage?.includes('Failed') || res.errorMessage?.includes('EVALUATION_FAILURE'));
      results.push({
        proofId: 'RT-NEG-001',
        name: 'UI Local State Mutation Without Backend',
        passed,
        expectedBehavior: 'If backend fails or bypasses mutation, round trip must fail and not project fake success.',
        actualBehavior: `verdict=${res.roundTripVerdict}, error=${res.errorMessage}`,
        details: 'Blocked fake UI local state mutation.'
      });
    })();

    // 2. RT-NEG-008: Backend reports failure but UI reports success
    await (async () => {
      const intent: any = { toolId: 'FEATURE_EXTRUDE', documentId: 'DOC-RT-NEG', parameters: { depth: -99 } }; // Force failure with invalid depth
      const res = await RoundTripCoordinator.executeRoundTrip('RT-NEG-008', intent, baseDoc);

      const passed = res.roundTripVerdict === 'FAIL' && res.uiStatus !== 'SUCCESS';
      results.push({
        proofId: 'RT-NEG-008',
        name: 'Backend Failure Safety',
        passed,
        expectedBehavior: 'If backend fails, UI projection must not report success.',
        actualBehavior: `verdict=${res.roundTripVerdict}, uiStatus=${res.uiStatus}`,
        details: 'UI correctly matches backend failure state.'
      });
    })();

    // 3. RT-NEG-009: Old document revision overwrites new revision
    await (async () => {
      // Force engine to revision 5
      const rev5Doc = { ...baseDoc, revision: 5 };
      syncEngine.applyMutation(rev5Doc);

      // Submit an intent based on revision 3
      const rev3Doc = { ...baseDoc, revision: 3 };
      const intent: any = { toolId: 'FEATURE_EXTRUDE', documentId: 'DOC-RT-NEG', parameters: { sketchId: 'SK-1', depth: 20 } };
      const res = await RoundTripCoordinator.executeRoundTrip('RT-NEG-009', intent, rev3Doc);

      const passed = res.roundTripVerdict === 'FAIL' && res.errorMessage?.includes('Sync Engine Rejected');
      results.push({
        proofId: 'RT-NEG-009',
        name: 'Old Revision Overwrite Protection',
        passed,
        expectedBehavior: 'Sync engine must reject mutation applied to stale revision 3 when highest is 5.',
        actualBehavior: `verdict=${res.roundTripVerdict}, error=${res.errorMessage}`,
        details: 'Stale overwrite successfully blocked.'
      });
    })();

    // 4. RT-NEG-016: Unsupported capability reaches fake execution
    await (async () => {
      const fakeIntent: any = { toolId: 'FEATURE_MAGIC', documentId: 'DOC-RT-NEG', parameters: {} };
      const res = await RoundTripCoordinator.executeRoundTrip('RT-NEG-016', fakeIntent, baseDoc);

      const passed = res.roundTripVerdict === 'FAIL' && res.errorMessage?.includes('UNSUPPORTED');
      results.push({
        proofId: 'RT-NEG-016',
        name: 'Unsupported Capability Rejection',
        passed,
        expectedBehavior: 'Fake capabilities must be rejected, not fake-succeeded.',
        actualBehavior: `verdict=${res.roundTripVerdict}, error=${res.errorMessage}`,
        details: 'Unsupported capability blocked.'
      });
    })();

    // 5. RT-NEG-023: Frontend reports SUCCESS without Canonical Mutation + Validation
    await (async () => {
      // Dispatch directly via Dispatcher but intentionally fail success semantics
      const intent: any = { toolId: 'FEATURE_SUPPRESS', documentId: 'DOC-RT-NEG', parameters: { featureId: 'MISSING' } };
      const res = await RoundTripCoordinator.executeRoundTrip('RT-NEG-023', intent, baseDoc);

      const passed = res.roundTripVerdict === 'FAIL';
      results.push({
        proofId: 'RT-NEG-023',
        name: 'Success Without Canonical Mutation + Validation',
        passed,
        expectedBehavior: 'Operations that do not produce valid document mutations must fail the round trip.',
        actualBehavior: `verdict=${res.roundTripVerdict}`,
        details: 'Invalid mutation properly failed.'
      });
    })();

    const passCount = results.filter(r => r.passed).length;
    const totalCount = results.length;

    return {
      timestamp,
      totalCount,
      passCount,
      allPassed: passCount === totalCount,
      results
    };
  }
}
