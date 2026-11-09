/**
 * SECP-CAD-TRUTH-PATCH-005 — Full Integration & Adversarial Verification Battery
 *
 * Matrix of mandatory test cases:
 * P005-T01: Unchanged CAD -> geometryHash stable across non-geometric metadata edits.
 * P005-T02: Dimension mutation -> geometryHash changes deterministically.
 * P005-T03: Same CAD ID & Revision ID + changed geometry -> Downstream Mesh status marked STALE.
 * P005-T04: Attempt to run CFD solver with STALE Mesh -> Solver DENIED with [CFD_SOLVER_PRECONDITION_FAILURE], solverInvocationCount == 0.
 * P005-T05: Attempt to verify evidence using old CFD result -> Evidence verification DENIED (isValid == false).
 * P005-T06: Attempt to publish/release with STALE dependency -> Release DENIED with [ENGINEERING_RELEASE_DENIED], releaseInvocationCount == 0.
 * P005-T07: Forged geometry hash -> Mesh/CFD/Release DENIED.
 * P005-T08: Missing geometry provenance -> Fail-closed denial.
 * P005-T09: Regenerate Mesh from new mutated geometry -> Mesh status becomes CURRENT, modelRevisionHash matches CAD.
 * P005-T10: Recompute CFD with valid Mesh + regenerate evidence -> Valid downstream chain accepted & Engineering Release published (releaseInvocationCount == 1).
 * P005-T11: Persist & reload thread -> Invalidation / staleness survives serialization & reload.
 * P005-T12: Attempted rollback / reuse of old evidence without recomputation -> Old evidence NOT silently revalidated, release DENIED.
 */

import { CadGeometryKernel, computeCanonicalGeometryHash } from '../engine/cadKernel';
import { CfdEngine } from '../engine/cfdEngine';
import { MeshValidator } from '../engine/physics/mesh/MeshValidator';
import { EvidenceValidator } from '../services/ai/EvidenceValidator';
import { EngineeringReleaseEngine } from '../engine/release/EngineeringReleaseEngine';
import { DigitalThreadEngine, DigitalThreadState } from '../engine/thread/DigitalThreadEngine';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

export async function runTestMatrix(): Promise<void> {
  console.log('================================================================');
  console.log('SECP-CAD-TRUTH-PATCH-005: INTEGRATION & ADVERSARIAL VERIFICATION');
  console.log('================================================================\n');

  // SETUP: Create Baseline CAD (Box 100x50x25 mm)
  const cadBaseline = CadGeometryKernel.createBox(100, 50, 25, 'Actuator_Bracket_Base');
  cadBaseline.id = 'CAD-ACTUATOR-BRACKET-001';

  // ----------------------------------------------------------------
  // P005-T01: Unchanged CAD -> geometryHash stable
  // ----------------------------------------------------------------
  console.log('[P005-T01] Unchanged CAD -> geometryHash stability verification');
  const hashOriginal = cadBaseline.geometryHash!;
  assert(typeof hashOriginal === 'string' && hashOriginal.length > 0, 'Original geometryHash generated');

  const hashMetaRenamed = computeCanonicalGeometryHash('BOX', {
    dx: cadBaseline.dimensions.dx,
    dy: cadBaseline.dimensions.dy,
    dz: cadBaseline.dimensions.dz,
    volumeM3: cadBaseline.volumeM3,
    surfaceAreaM2: cadBaseline.surfaceAreaM2,
    cog: cadBaseline.centerOfGravity,
    name: 'Renamed_Display_Title_Only',
    author: 'Auditor_John_Doe',
    timestamp: '2026-11-03T12:00:00Z'
  });

  assert(hashMetaRenamed === hashOriginal, `Non-geometric metadata changes DO NOT alter geometryHash (${hashOriginal.substring(0, 12)}...)`);

  // ----------------------------------------------------------------
  // P005-T02: Dimension mutation -> geometryHash changes
  // ----------------------------------------------------------------
  console.log('\n[P005-T02] Dimension mutation -> geometryHash change verification');
  const cadMutated = CadGeometryKernel.createBox(120, 50, 25, 'Actuator_Bracket_Base'); // 100mm -> 120mm
  cadMutated.id = 'CAD-ACTUATOR-BRACKET-001'; // Same CAD ID
  const hashMutated = cadMutated.geometryHash!;

  assert(hashMutated !== hashOriginal, `Dimension mutation changes geometryHash deterministically (${hashOriginal.substring(0, 8)} -> ${hashMutated.substring(0, 8)})`);

  // ----------------------------------------------------------------
  // SETUP INITIAL DIGITAL THREAD
  // ----------------------------------------------------------------
  const initialMesh = {
    meshId: 'MESH-001',
    modelId: cadBaseline.id,
    modelRevisionId: 'v1.0.0',
    modelRevisionHash: hashOriginal,
    meshVersion: '1.0.0',
    dimension: '3D' as const,
    topologyType: 'UNSTRUCTURED' as const,
    elementFamily: 'HEXAHEDRON',
    nodes: [
      { nodeId: 'n1', coordinates: [0, 0, 0] as [number, number, number] },
      { nodeId: 'n2', coordinates: [0.1, 0, 0] as [number, number, number] },
      { nodeId: 'n3', coordinates: [0.1, 0.05, 0] as [number, number, number] },
      { nodeId: 'n4', coordinates: [0, 0.05, 0] as [number, number, number] },
      { nodeId: 'n5', coordinates: [0, 0, 0.025] as [number, number, number] },
      { nodeId: 'n6', coordinates: [0.1, 0, 0.025] as [number, number, number] },
      { nodeId: 'n7', coordinates: [0.1, 0.05, 0.025] as [number, number, number] },
      { nodeId: 'n8', coordinates: [0, 0.05, 0.025] as [number, number, number] }
    ],
    elements: [
      { elementId: 'e1', type: 'HEXAHEDRON' as const, nodeIds: ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8'], dimension: 3 as const }
    ],
    regions: [],
    revision: 'v1.0.0',
    status: 'CURRENT' as any,
    canonicalHash: 'MESH-HASH-REV1-100'
  };

  CfdEngine.resetInvocations();
  const initialCfdResult = CfdEngine.runSimulation(initialMesh, 10, 1.225, 0.0000181, 100, hashOriginal);
  const initialCfdInvocations = CfdEngine.getSolverInvocations();
  assert(initialCfdInvocations === 1, `Initial baseline CFD solver executed cleanly (Invocations = ${initialCfdInvocations})`);

  const initialState: DigitalThreadState = {
    cadId: cadBaseline.id,
    revisionId: 'v1.0.0',
    cadEntity: cadBaseline,
    meshSet: initialMesh,
    cfdResult: {
      ...initialCfdResult,
      status: 'CURRENT',
      cadGeometryHash: hashOriginal,
      meshHash: initialMesh.canonicalHash
    },
    digitalThreadStatus: 'CURRENT',
    evidenceChain: [
      {
        id: 'EVID-REV1-CFD',
        cadGeometryHash: hashOriginal,
        status: 'CURRENT',
        authority: 'SYSTEM_SOLVER',
        context: { cadGeometryHash: hashOriginal, meshHash: initialMesh.canonicalHash }
      }
    ]
  };

  const thread = new DigitalThreadEngine(initialState);

  // ----------------------------------------------------------------
  // P005-T03: Same CAD ID & Revision ID + changed geometry -> Mesh STALE
  // ----------------------------------------------------------------
  console.log('\n[P005-T03] Same CAD & Revision ID + Geometry Mutation -> Downstream Invalidation');
  thread.mutateGeometry({ dxMm: 120 }); // Dimension change 100mm -> 120mm

  const mutatedState = thread.getState();
  assert(mutatedState.cadEntity.id === 'CAD-ACTUATOR-BRACKET-001', 'CAD ID remains identical (CAD-ACTUATOR-BRACKET-001)');
  assert(mutatedState.cadEntity.geometryHash === hashMutated, 'CAD geometryHash updated to mutated hash');
  assert(mutatedState.meshSet.status === 'STALE', 'Downstream Mesh is automatically marked STALE');
  assert(mutatedState.digitalThreadStatus === 'STALE', 'Digital Thread status is marked STALE');

  // ----------------------------------------------------------------
  // P005-T04: Reuse stale mesh -> CFD Solver DENIED (0 solver invocations)
  // ----------------------------------------------------------------
  console.log('\n[P005-T04] Reuse Stale Mesh -> CFD Solver Execution Denial');
  CfdEngine.resetInvocations();
  let cfdDenied = false;
  try {
    CfdEngine.runSimulation(mutatedState.meshSet, 10, 1.225, 0.0000181, 100, hashMutated);
  } catch (err: any) {
    cfdDenied = true;
    assert(err.message.includes('[CFD_SOLVER_PRECONDITION_FAILURE]'), 'CFD Engine threw precondition error [CFD_SOLVER_PRECONDITION_FAILURE]');
    assert(err.message.includes('[MESH_STALE_ERROR]'), 'CFD Engine reported [MESH_STALE_ERROR]');
  }
  assert(cfdDenied, 'CFD Solver execution was strictly DENIED on stale mesh');
  assert(CfdEngine.getSolverInvocations() === 0, `CFD Solver Invocation Counter MUST BE 0 on denial (Actual: ${CfdEngine.getSolverInvocations()})`);

  // ----------------------------------------------------------------
  // P005-T05: Reuse old CFD result -> Evidence verification DENIED
  // ----------------------------------------------------------------
  console.log('\n[P005-T05] Reuse Old CFD Result -> Evidence Verification Denial');
  const oldEvidence = initialState.evidenceChain[0];
  const evValidation = EvidenceValidator.validateIntegrity(oldEvidence, hashMutated);
  assert(evValidation.valid === false, 'Evidence validation returned valid === false when tested against mutated geometryHash');
  assert(evValidation.reason === 'GEOMETRY_HASH_MISMATCH' || evValidation.reason === 'EVIDENCE_STALE', `Evidence validation failed with reason: ${evValidation.reason}`);

  // ----------------------------------------------------------------
  // P005-T06: Publish with stale dependency -> Release DENIED (0 release invocations)
  // ----------------------------------------------------------------
  console.log('\n[P005-T06] Publish with STALE dependency -> Release DENIED');
  EngineeringReleaseEngine.resetInvocations();
  const staleReleaseRequest = {
    releaseId: 'REL-001',
    projectName: 'Actuator Bracket Assembly',
    cadEntity: mutatedState.cadEntity,
    meshSet: mutatedState.meshSet,
    cfdResult: mutatedState.cfdResult,
    digitalThreadStatus: mutatedState.digitalThreadStatus,
    evidenceChain: mutatedState.evidenceChain,
    geometryHash: (mutatedState.cadEntity.geometryHash || 'NA') as string
  } as any;

  const releaseDeniedResult = EngineeringReleaseEngine.publishRelease(staleReleaseRequest);
  assert(releaseDeniedResult.success === false, 'Engineering Release DENIED on stale dependencies');
  assert(releaseDeniedResult.reasonCode === 'ENGINEERING_RELEASE_DENIED', `Release reason code: ${releaseDeniedResult.reasonCode}`);
  assert(releaseDeniedResult.errors!.length > 0, `Denial errors list contains ${releaseDeniedResult.errors!.length} explicit reasons`);
  assert(EngineeringReleaseEngine.getReleaseInvocations() === 0, `Release Invocation Counter MUST BE 0 on denial (Actual: ${EngineeringReleaseEngine.getReleaseInvocations()})`);

  // ----------------------------------------------------------------
  // P005-T07: Forged geometry hash -> Denied
  // ----------------------------------------------------------------
  console.log('\n[P005-T07] Forged Geometry Hash -> Precondition Failure');
  EngineeringReleaseEngine.resetInvocations();
  const forgedReleaseRequest = {
    ...staleReleaseRequest,
    cadEntity: { ...mutatedState.cadEntity, geometryHash: 'FORGED_HASH_999999999' },
    geometryHash: 'FORGED_HASH_999999999'
  } as any;
  const forgedResult = EngineeringReleaseEngine.publishRelease(forgedReleaseRequest);
  assert(forgedResult.success === false, 'Forged geometryHash release DENIED');
  assert(EngineeringReleaseEngine.getReleaseInvocations() === 0, `Release Invocation Counter MUST BE 0 on forged hash (Actual: ${EngineeringReleaseEngine.getReleaseInvocations()})`);

  // ----------------------------------------------------------------
  // P005-T08: Missing geometry provenance -> Fail-closed
  // ----------------------------------------------------------------
  console.log('\n[P005-T08] Missing Geometry Provenance -> Fail-Closed');
  EngineeringReleaseEngine.resetInvocations();
  const missingProvRequest = {
    ...staleReleaseRequest,
    cadEntity: { ...mutatedState.cadEntity, geometryHash: '' },
    geometryHash: ''
  } as any;
  const missingProvResult = EngineeringReleaseEngine.publishRelease(missingProvRequest);
  assert(missingProvResult.success === false, 'Missing geometryHash release DENIED fail-closed');
  assert(EngineeringReleaseEngine.getReleaseInvocations() === 0, `Release Invocation Counter MUST BE 0 on missing provenance (Actual: ${EngineeringReleaseEngine.getReleaseInvocations()})`);

  // ----------------------------------------------------------------
  // P005-T09: Regenerate Mesh from new geometry -> Mesh accepted
  // ----------------------------------------------------------------
  console.log('\n[P005-T09] Regenerate Mesh from new mutated geometry');
  thread.regenerateMesh();
  const stateWithNewMesh = thread.getState();
  assert(stateWithNewMesh.meshSet.status === 'CURRENT', 'Regenerated Mesh status is CURRENT');
  assert(stateWithNewMesh.meshSet.modelRevisionHash === hashMutated, `Regenerated Mesh modelRevisionHash matches CAD (${hashMutated.substring(0, 8)})`);

  // ----------------------------------------------------------------
  // P005-T10: Recompute CFD + regenerate evidence -> Valid release accepted
  // ----------------------------------------------------------------
  console.log('\n[P005-T10] Recompute CFD + Regenerate Evidence -> Valid Release Sign-Off');
  CfdEngine.resetInvocations();
  EngineeringReleaseEngine.resetInvocations();

  thread.recomputeCfd(10, 1.225, 0.0000181, 100);
  assert(CfdEngine.getSolverInvocations() === 1, `CFD Solver executed 1 time for valid recomputation (Actual: ${CfdEngine.getSolverInvocations()})`);

  const validRecomputedState = thread.getState();
  assert(validRecomputedState.digitalThreadStatus === 'CURRENT', 'Digital Thread status restored to CURRENT');

  const validReleaseRequest = {
    releaseId: 'REL-002-VALID',
    projectName: 'Actuator Bracket Assembly',
    cadEntity: validRecomputedState.cadEntity,
    meshSet: validRecomputedState.meshSet,
    cfdResult: validRecomputedState.cfdResult,
    digitalThreadStatus: validRecomputedState.digitalThreadStatus,
    evidenceChain: validRecomputedState.evidenceChain,
    geometryHash: (validRecomputedState.cadEntity.geometryHash || 'NA') as string
  } as any;

  const validReleaseResult = EngineeringReleaseEngine.publishRelease(validReleaseRequest);
  assert(validReleaseResult.success === true, 'Engineering Release PUBLISHED successfully after valid recomputation');
  assert(typeof validReleaseResult.certificateId === 'string' && validReleaseResult.certificateId.startsWith('RELEASE-CERT-'), 'Cryptographic release certificate generated');
  assert(EngineeringReleaseEngine.getReleaseInvocations() === 1, `Release Invocation Counter MUST BE 1 on valid publication (Actual: ${EngineeringReleaseEngine.getReleaseInvocations()})`);

  // ----------------------------------------------------------------
  // P005-T11: Persist & reload thread -> Staleness survives serialization
  // ----------------------------------------------------------------
  console.log('\n[P005-T11] Persist & Reload Thread -> Staleness Survival');
  // Trigger new mutation
  thread.mutateGeometry({ dxMm: 150 });
  const preSerializeState = thread.getState();
  assert(preSerializeState.meshSet.status === 'STALE', 'Thread mutated prior to serialization, Mesh is STALE');

  const serializedJson = thread.serialize();
  assert(typeof serializedJson === 'string' && serializedJson.length > 0, 'Thread state serialized to JSON');

  const reloadedThread = DigitalThreadEngine.deserialize(serializedJson);
  const reloadedState = reloadedThread.getState();
  assert(reloadedState.meshSet.status === 'STALE', 'Reloaded thread state preserved Mesh STALE status');
  assert(reloadedState.digitalThreadStatus === 'STALE', 'Reloaded thread state preserved Digital Thread STALE status');

  EngineeringReleaseEngine.resetInvocations();
  const reloadedReleaseResult = EngineeringReleaseEngine.publishRelease({
    releaseId: 'REL-RELOADED-STALE',
    projectName: 'Actuator Bracket Assembly',
    cadEntity: reloadedState.cadEntity,
    meshSet: reloadedState.meshSet,
    cfdResult: reloadedState.cfdResult,
    digitalThreadStatus: reloadedState.digitalThreadStatus,
    evidenceChain: reloadedState.evidenceChain,
    geometryHash: (reloadedState.cadEntity.geometryHash || 'NA') as string
  } as any);

  assert(reloadedReleaseResult.success === false, 'Engineering Release DENIED on reloaded stale thread');
  assert(EngineeringReleaseEngine.getReleaseInvocations() === 0, `Release Invocation Counter MUST BE 0 on reloaded stale thread (Actual: ${EngineeringReleaseEngine.getReleaseInvocations()})`);

  // ----------------------------------------------------------------
  // P005-T12: Attempted rollback / reuse of old evidence -> Denied
  // ----------------------------------------------------------------
  console.log('\n[P005-T12] Attempted Rollback / Reuse of Old Evidence -> Denial');
  EngineeringReleaseEngine.resetInvocations();
  const rollbackAttemptRequest = {
    releaseId: 'REL-ROLLBACK-ATTEMPT',
    projectName: 'Actuator Bracket Assembly',
    cadEntity: reloadedState.cadEntity, // 150mm geometry
    meshSet: initialMesh, // Old 100mm mesh
    cfdResult: initialCfdResult, // Old 100mm CFD result
    digitalThreadStatus: 'CURRENT' as const, // Forged thread status
    evidenceChain: initialState.evidenceChain, // Old evidence
    geometryHash: (reloadedState.cadEntity.geometryHash || 'NA') as string
  } as any;

  const rollbackResult = EngineeringReleaseEngine.publishRelease(rollbackAttemptRequest);
  assert(rollbackResult.success === false, 'Rollback attempt using old un-recomputed evidence strictly DENIED');
  assert(EngineeringReleaseEngine.getReleaseInvocations() === 0, `Release Invocation Counter MUST BE 0 on rollback attempt (Actual: ${EngineeringReleaseEngine.getReleaseInvocations()})`);

  console.log('\n================================================================');
  console.log('ALL 12 TEST CASES IN SECP-CAD-TRUTH-PATCH-005 PASSED SUCCESSFULLY');
  console.log('================================================================');
}

// Execute test suite if run directly
if (import.meta.url.endsWith('test_secp_patch_005_truth_chain.ts') || process.argv[1]?.includes('test_secp_patch_005_truth_chain')) {
  runTestMatrix().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}
