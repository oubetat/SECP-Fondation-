/**
 * SECP-POST-TOPOLOGY-002: Production Consumer Enforcement Proof Suite
 * 
 * Tests the real production-reachable consumption boundaries for:
 * 1. Topology Resolution & Dependent Feature Execution (PersistentTopologyNaming, TopologyLineageProofEngine)
 * 2. Manufacturing DFM Assessment & Process Planning (ProductionDFMDecisionEngine, ProductionProcessPlanningEngine)
 * 3. CAM Toolpath Verification & CL Packaging (ToolpathVerificationEngine, CutterLocationDataEngine, CAMProvenanceEngine)
 * 
 * Verifies that derived artifacts without valid bindings matching the target CAD revision
 * are unconditionally rejected (Fail-Closed Enforcement).
 */

import { PersistentTopologyNaming } from '../../cad-kernel/topology/PersistentTopologyNaming';
import { TopologyLineageProofEngine, CanonicalTopologyReference } from '../TopologyLineageProofEngine';
import { ProductionDFMDecisionEngine } from '../../manufacturing/ProductionDFMDecisionEngine';
import { ProductionProcessPlanningEngine } from '../../manufacturing/ProductionProcessPlanningEngine';
import { ProductionManufacturingFeature } from '../../manufacturing/ProductionManufacturingTypes';
import { ToolpathVerificationEngine } from '../../cam/ToolpathVerificationEngine';
import { CutterLocationDataEngine } from '../../cam/CutterLocationDataEngine';
import { CAMProvenanceEngine } from '../../cam/CAMProvenanceEngine';
import { CanonicalDerivedArtifactBinding, DerivedArtifactBindingResult } from '../CanonicalDerivedArtifactBinding';
import { Solid, Face, Edge, Vertex, TopoShapeEnum } from '../../cad-kernel/topology/TopologyContracts';
import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { CandidateToolpathTrajectory, StockModel, VerifiedToolpathTrajectory } from '../../cam/ToolpathTypes';

export interface ProductionEnforcementSuiteResult {
  totalTests: number;
  passedCount: number;
  failedCount: number;
  details: Array<{ testId: string; description: string; passed: boolean; details?: string }>;
}

export class ProductionConsumerEnforcementSuite {
  public static async runSuite(): Promise<ProductionEnforcementSuiteResult> {
    const details: Array<{ testId: string; description: string; passed: boolean; details?: string }> = [];

    const REV_A_HASH = 'cad_rev_hash_aaaa1111222233334444555566667777888899990000aaaa1111222233334444';
    const REV_B_HASH = 'cad_rev_hash_bbbb1111222233334444555566667777888899990000bbbb1111222233334444';
    const GEOM_1_HASH = 'geom_hash_1111222233334444555566667777888899990000111122223333444455556666';
    const GEOM_2_HASH = 'geom_hash_2222333344445555666677778888999900001111222233334444555566667777';

    // Helper to create synthetic solid
    const createSyntheticSolid = (tag: string, faceId: string): Solid => {
      const face: Face = {
        id: faceId,
        type: TopoShapeEnum.FACE,
        persistentId: tag,
        geometry: { normal: { x: 0, y: 0, z: 1 } },
        outerLoop: {
          id: `loop_${faceId}`,
          type: TopoShapeEnum.WIRE,
          orientedEdges: []
        }
      };
      return {
        id: `solid_${tag}`,
        type: TopoShapeEnum.SOLID,
        outerShell: {
          id: `shell_${tag}`,
          type: TopoShapeEnum.SHELL,
          orientedFaces: [{ face, orientation: 1 }]
        }
      };
    };

    // Helper to create synthetic feature
    const createSyntheticFeature = (
      featureId: string,
      cadRevHash: string,
      geomHash: string
    ): ProductionManufacturingFeature => {
      const binding = CanonicalDerivedArtifactBinding.createBinding({
        cadRevisionHash: cadRevHash,
        canonicalGeometryHash: geomHash,
        artifactKind: 'MANUFACTURING_FEATURE',
        derivationIdentity: 'testSyntheticFeature',
        artifactContentHash: `content_${featureId}`,
        featureId
      });
      return {
        featureId,
        type: 'POCKET',
        sourceFeatureIds: [featureId],
        persistentTopologyIds: [`${featureId}:FACE:CapEnd`],
        geometry: { depth: 10, width: 20 },
        dimensions: { cornerRadiusMm: 2, wallThicknessMm: 3 },
        tolerances: { dimensionalToleranceMm: 0.05, surfaceFinishRaUm: 1.6 },
        accessibility: {
          isAccessible3Axis: true,
          isAccessible5Axis: true,
          minimumToolReachMm: 20,
          primaryAccessVector: { x: 0, y: 0, z: 1 }
        },
        toolRequirements: {
          toolType: 'END_MILL',
          minToolDiameterMm: 8,
          maxToolDiameterMm: 12,
          minToolReachMm: 20
        },
        processCandidates: ['MILLING_3AXIS'],
        provenance: `prov_${featureId}`,
        cadRevisionHash: cadRevHash,
        canonicalGeometryHash: geomHash,
        derivedArtifactBinding: binding
      };
    };

    // Helper to create synthetic candidate toolpath
    const createSyntheticToolpath = async (
      opId: string,
      cadRevHash: string,
      geomHash: string
    ): Promise<CandidateToolpathTrajectory> => {
      const points = [
        { pointIndex: 0, position: { x: 0, y: 0, z: 10 }, feedRateMmMin: 1000, spindleRpm: 8000, moveType: 'RAPID_APPROACH' as const },
        { pointIndex: 1, position: { x: 10, y: 10, z: 0 }, feedRateMmMin: 500, spindleRpm: 8000, moveType: 'CUTTING' as const }
      ];
      const prov = await CAMProvenanceEngine.generateNCProvenanceChain(
        { operationId: opId },
        points,
        { machineId: 'HAAS_VF2' },
        { simulation: 'PASS' },
        cadRevHash,
        geomHash
      );
      return {
        operationId: opId,
        strategy: 'POCKET_ROUGHING',
        points,
        totalLengthMm: 20,
        estimatedTimeSec: 2.5,
        generatedAt: new Date().toISOString(),
        provenance: prov
      };
    };

    // =========================================================================
    // 1. TOPOLOGY PRODUCTION CONSUMER ENFORCEMENT (T-TOPO-01 -> T-TOPO-10)
    // =========================================================================

    // CASE T-TOPO-01: Revision A artifact supplied to Revision A -> ACCEPT
    try {
      const solidA = createSyntheticSolid('EXTRUDE_1:FACE:CapEnd', 'face_a');
      const bindingA = CanonicalDerivedArtifactBinding.createBinding({
        cadRevisionHash: REV_A_HASH,
        canonicalGeometryHash: GEOM_1_HASH,
        artifactKind: 'TOPOLOGY',
        derivationIdentity: 'createFaceReference',
        artifactContentHash: 'face_geom_sig_1',
        featureId: 'EXTRUDE_1',
        topologyId: 'EXTRUDE_1:FACE:CapEnd'
      });
      const refA = {
        persistentId: 'EXTRUDE_1:FACE:CapEnd',
        entityId: 'face_a',
        derivedArtifactBinding: bindingA
      };
      const res = PersistentTopologyNaming.resolveTopologyReference(refA, solidA, {
        targetCadRevisionHash: REV_A_HASH,
        targetGeometryHash: GEOM_1_HASH
      });
      details.push({
        testId: 'T-TOPO-01',
        description: 'Revision A topology reference resolved against Revision A context is accepted',
        passed: res !== undefined && res.id === 'face_a'
      });
    } catch (e: any) {
      details.push({ testId: 'T-TOPO-01', description: 'Revision A topology reference in Rev A', passed: false, details: e.message });
    }

    // CASE T-TOPO-02: Revision A artifact supplied to Revision B -> REJECT
    try {
      const solidB = createSyntheticSolid('EXTRUDE_1:FACE:CapEnd', 'face_b');
      const bindingA = CanonicalDerivedArtifactBinding.createBinding({
        cadRevisionHash: REV_A_HASH,
        canonicalGeometryHash: GEOM_1_HASH,
        artifactKind: 'TOPOLOGY',
        derivationIdentity: 'createFaceReference',
        artifactContentHash: 'face_geom_sig_1',
        featureId: 'EXTRUDE_1',
        topologyId: 'EXTRUDE_1:FACE:CapEnd'
      });
      const refA = {
        persistentId: 'EXTRUDE_1:FACE:CapEnd',
        entityId: 'face_a',
        derivedArtifactBinding: bindingA
      };
      const res = PersistentTopologyNaming.resolveTopologyReference(refA, solidB, {
        targetCadRevisionHash: REV_B_HASH,
        targetGeometryHash: GEOM_1_HASH
      });
      details.push({
        testId: 'T-TOPO-02',
        description: 'Revision A topology reference presented to Revision B context is rejected',
        passed: res === undefined
      });
    } catch (e: any) {
      details.push({ testId: 'T-TOPO-02', description: 'Cross-revision topology reference', passed: false, details: e.message });
    }

    // CASE T-TOPO-03: Revision A artifact with forged cadRevisionHash -> REJECT
    try {
      const solidB = createSyntheticSolid('EXTRUDE_1:FACE:CapEnd', 'face_b');
      const bindingA = CanonicalDerivedArtifactBinding.createBinding({
        cadRevisionHash: REV_A_HASH,
        canonicalGeometryHash: GEOM_1_HASH,
        artifactKind: 'TOPOLOGY',
        derivationIdentity: 'createFaceReference',
        artifactContentHash: 'face_geom_sig_1',
        featureId: 'EXTRUDE_1',
        topologyId: 'EXTRUDE_1:FACE:CapEnd'
      });
      // Attack: mutate payload without recomputing digest
      const forgedBinding: DerivedArtifactBindingResult = {
        ...bindingA,
        payload: { ...bindingA.payload, cadRevisionHash: REV_B_HASH }
      };
      const refForged = {
        persistentId: 'EXTRUDE_1:FACE:CapEnd',
        derivedArtifactBinding: forgedBinding
      };
      const res = PersistentTopologyNaming.resolveTopologyReference(refForged, solidB, {
        targetCadRevisionHash: REV_B_HASH,
        targetGeometryHash: GEOM_1_HASH
      });
      details.push({
        testId: 'T-TOPO-03',
        description: 'Topology reference with forged cadRevisionHash is rejected',
        passed: res === undefined
      });
    } catch (e: any) {
      details.push({ testId: 'T-TOPO-03', description: 'Forged cadRevisionHash', passed: false, details: e.message });
    }

    // CASE T-TOPO-04: Topology ID mutation -> REJECT
    try {
      const solidA = createSyntheticSolid('EXTRUDE_1:FACE:CapEnd', 'face_a');
      const bindingA = CanonicalDerivedArtifactBinding.createBinding({
        cadRevisionHash: REV_A_HASH,
        canonicalGeometryHash: GEOM_1_HASH,
        artifactKind: 'TOPOLOGY',
        derivationIdentity: 'createFaceReference',
        artifactContentHash: 'face_geom_sig_1',
        featureId: 'EXTRUDE_1',
        topologyId: 'EXTRUDE_1:FACE:CapEnd'
      });
      const tamperedBinding: DerivedArtifactBindingResult = {
        ...bindingA,
        payload: { ...bindingA.payload, topologyId: 'MUTATED_TOPOLOGY_ID' }
      };
      const refTampered = {
        persistentId: 'MUTATED_TOPOLOGY_ID',
        derivedArtifactBinding: tamperedBinding
      };
      const res = PersistentTopologyNaming.resolveTopologyReference(refTampered, solidA, {
        targetCadRevisionHash: REV_A_HASH,
        targetGeometryHash: GEOM_1_HASH
      });
      details.push({
        testId: 'T-TOPO-04',
        description: 'Topology reference with mutated topology ID is rejected',
        passed: res === undefined
      });
    } catch (e: any) {
      details.push({ testId: 'T-TOPO-04', description: 'Topology ID mutation', passed: false, details: e.message });
    }

    // CASE T-TOPO-05: Content change while binding unchanged -> REJECT
    try {
      const solidA = createSyntheticSolid('EXTRUDE_1:FACE:CapEnd', 'face_a');
      const bindingA = CanonicalDerivedArtifactBinding.createBinding({
        cadRevisionHash: REV_A_HASH,
        canonicalGeometryHash: GEOM_1_HASH,
        artifactKind: 'TOPOLOGY',
        derivationIdentity: 'createFaceReference',
        artifactContentHash: 'face_geom_sig_1',
        featureId: 'EXTRUDE_1',
        topologyId: 'EXTRUDE_1:FACE:CapEnd'
      });
      // Geometry hash changes from GEOM_1_HASH to GEOM_2_HASH
      const refA = {
        persistentId: 'EXTRUDE_1:FACE:CapEnd',
        derivedArtifactBinding: bindingA
      };
      const res = PersistentTopologyNaming.resolveTopologyReference(refA, solidA, {
        targetCadRevisionHash: REV_A_HASH,
        targetGeometryHash: GEOM_2_HASH // Mismatched geometry hash
      });
      details.push({
        testId: 'T-TOPO-05',
        description: 'Geometry mismatch against binding is rejected',
        passed: res === undefined
      });
    } catch (e: any) {
      details.push({ testId: 'T-TOPO-05', description: 'Geometry hash mismatch', passed: false, details: e.message });
    }

    // CASE T-TOPO-06: Binding removed -> REJECT
    try {
      const solidA = createSyntheticSolid('EXTRUDE_1:FACE:CapEnd', 'face_a');
      const refUnbound = {
        persistentId: 'EXTRUDE_1:FACE:CapEnd',
        entityId: 'face_a'
        // Missing derivedArtifactBinding
      };
      const res = PersistentTopologyNaming.resolveTopologyReference(refUnbound, solidA, {
        targetCadRevisionHash: REV_A_HASH,
        targetGeometryHash: GEOM_1_HASH
      });
      details.push({
        testId: 'T-TOPO-06',
        description: 'Unbound topology reference is rejected when target revision context is enforced',
        passed: res === undefined
      });
    } catch (e: any) {
      details.push({ testId: 'T-TOPO-06', description: 'Missing binding', passed: false, details: e.message });
    }

    // CASE T-TOPO-07: Fabricated invalid binding -> REJECT
    try {
      const solidA = createSyntheticSolid('EXTRUDE_1:FACE:CapEnd', 'face_a');
      const fabricatedBinding: DerivedArtifactBindingResult = {
        artifactDigest: '0000000000000000000000000000000000000000000000000000000000000000',
        cadRevisionHash: REV_A_HASH,
        canonicalGeometryHash: GEOM_1_HASH,
        artifactKind: 'TOPOLOGY',
        derivationIdentity: 'forgedIdentity',
        payload: {
          cadRevisionHash: REV_A_HASH,
          canonicalGeometryHash: GEOM_1_HASH,
          artifactKind: 'TOPOLOGY',
          derivationIdentity: 'forgedIdentity',
          artifactContentHash: 'fake_content'
        },
        bindingTimestamp: new Date().toISOString()
      };
      const refFabricated = {
        persistentId: 'EXTRUDE_1:FACE:CapEnd',
        derivedArtifactBinding: fabricatedBinding
      };
      const res = PersistentTopologyNaming.resolveTopologyReference(refFabricated, solidA, {
        targetCadRevisionHash: REV_A_HASH,
        targetGeometryHash: GEOM_1_HASH
      });
      details.push({
        testId: 'T-TOPO-07',
        description: 'Fabricated digest binding is rejected',
        passed: res === undefined
      });
    } catch (e: any) {
      details.push({ testId: 'T-TOPO-07', description: 'Fabricated binding', passed: false, details: e.message });
    }

    // CASE T-TOPO-08: Dependent feature execution on invalid binding -> REJECT
    try {
      const doc: EngineeringDocument = {
        documentId: 'DOC_SECP_1',
        revision: 2,
        name: 'Part 1',
        features: [],
        derived: { bRepHash: REV_B_HASH, geometryHash: GEOM_1_HASH }
      };
      const bindingA = CanonicalDerivedArtifactBinding.createBinding({
        cadRevisionHash: REV_A_HASH,
        canonicalGeometryHash: GEOM_1_HASH,
        artifactKind: 'TOPOLOGY',
        derivationIdentity: 'createFaceReference',
        artifactContentHash: 'sig_1',
        featureId: 'EXTRUDE_1',
        topologyId: 'EXTRUDE_1:FACE:CapEnd'
      });
      const canonicalRefA: CanonicalTopologyReference = {
        referenceId: 'REF_1',
        documentId: 'DOC_SECP_1',
        documentRevision: 1,
        cadRevisionHash: REV_A_HASH,
        canonicalGeometryHash: GEOM_1_HASH,
        derivedArtifactBinding: bindingA,
        featureId: 'EXTRUDE_1',
        bodyId: 'MAIN_BODY',
        topologyEntityType: 'FACE',
        topologyEntityIdentifier: 'EXTRUDE_1:FACE:CapEnd',
        sourceRevision: 1,
        lineage: { createdByFeature: 'EXTRUDE_1', sourceEntities: [], geometricSignature: 'sig_1' },
        referenceContext: { documentId: 'DOC_SECP_1', featureId: 'EXTRUDE_1', bodyId: 'MAIN_BODY' },
        resolutionState: 'VALID',
        geometricSignature: 'sig_1',
        reboundEntityId: 'face_1',
        semanticDescriptor: { role: 'CapEnd' }
      };

      // Executing dependent feature on doc with REV_B_HASH when reference is bound to REV_A_HASH
      const execRes = TopologyLineageProofEngine.executeDependentFeature(doc, 'POCKET_1', canonicalRefA, REV_B_HASH);
      details.push({
        testId: 'T-TOPO-08',
        description: 'Dependent feature consumption blocks invalid cross-revision topology reference',
        passed: !execRes.success && execRes.diagnostics.some(d => d.includes('blocked by fail-closed enforcement'))
      });
    } catch (e: any) {
      details.push({ testId: 'T-TOPO-08', description: 'Dependent feature enforcement', passed: false, details: e.message });
    }

    // CASE T-TOPO-09: Identical geometry across distinct revisions
    try {
      const bindingA = CanonicalDerivedArtifactBinding.createBinding({
        cadRevisionHash: REV_A_HASH,
        canonicalGeometryHash: GEOM_1_HASH,
        artifactKind: 'TOPOLOGY',
        derivationIdentity: 'createFaceReference',
        artifactContentHash: 'identical_box_sig',
        featureId: 'BASE_BOX'
      });
      const bindingB = CanonicalDerivedArtifactBinding.createBinding({
        cadRevisionHash: REV_B_HASH,
        canonicalGeometryHash: GEOM_1_HASH, // Identical geometry
        artifactKind: 'TOPOLOGY',
        derivationIdentity: 'createFaceReference',
        artifactContentHash: 'identical_box_sig',
        featureId: 'BASE_BOX'
      });
      const vA_in_A = CanonicalDerivedArtifactBinding.verifyBinding(bindingA, REV_A_HASH, GEOM_1_HASH);
      const vA_in_B = CanonicalDerivedArtifactBinding.verifyBinding(bindingA, REV_B_HASH, GEOM_1_HASH);
      const vB_in_B = CanonicalDerivedArtifactBinding.verifyBinding(bindingB, REV_B_HASH, GEOM_1_HASH);

      details.push({
        testId: 'T-TOPO-09',
        description: 'Identical geometry retains strict revision separation (digest A != digest B)',
        passed: vA_in_A.isValid && !vA_in_B.isValid && vB_in_B.isValid && bindingA.artifactDigest !== bindingB.artifactDigest
      });
    } catch (e: any) {
      details.push({ testId: 'T-TOPO-09', description: 'Identical geometry separation', passed: false, details: e.message });
    }

    // CASE T-TOPO-10: Semantic Rebinding produces valid B binding
    try {
      const bindingA = CanonicalDerivedArtifactBinding.createBinding({
        cadRevisionHash: REV_A_HASH,
        canonicalGeometryHash: GEOM_1_HASH,
        artifactKind: 'TOPOLOGY',
        derivationIdentity: 'createFaceReference',
        artifactContentHash: 'face_sig_1',
        featureId: 'EXTRUDE_1'
      });
      const reboundBindingB = CanonicalDerivedArtifactBinding.rebindArtifact(
        bindingA,
        REV_B_HASH,
        GEOM_2_HASH,
        'face_sig_2'
      );
      const verifyRebound = CanonicalDerivedArtifactBinding.verifyBinding(reboundBindingB, REV_B_HASH, GEOM_2_HASH);
      details.push({
        testId: 'T-TOPO-10',
        description: 'Legitimate semantic rebind produces cryptographically valid target binding',
        passed: verifyRebound.isValid && reboundBindingB.payload.parentArtifactIdentity === bindingA.artifactDigest
      });
    } catch (e: any) {
      details.push({ testId: 'T-TOPO-10', description: 'Semantic rebinding', passed: false, details: e.message });
    }

    // =========================================================================
    // 2. MANUFACTURING PRODUCTION CONSUMER ENFORCEMENT (DFM & PROCESS PLANNING)
    // =========================================================================

    // CASE M-MFG-01: Feature A in Revision A -> ACCEPT DFM
    try {
      const featA = createSyntheticFeature('feat_pocket_1', REV_A_HASH, GEOM_1_HASH);
      const assessmentA = ProductionDFMDecisionEngine.evaluateManufacturingAssessment(
        [featA],
        true,
        true,
        undefined,
        REV_A_HASH,
        GEOM_1_HASH
      );
      details.push({
        testId: 'M-MFG-01',
        description: 'Valid Revision A manufacturing feature accepted by DFM engine in Rev A',
        passed: assessmentA.status === 'PRODUCTION_READY' || assessmentA.status === 'MANUFACTURABLE'
      });
    } catch (e: any) {
      details.push({ testId: 'M-MFG-01', description: 'DFM Rev A', passed: false, details: e.message });
    }

    // CASE M-MFG-02: Feature A in Revision B -> REJECT DFM
    try {
      const featA = createSyntheticFeature('feat_pocket_1', REV_A_HASH, GEOM_1_HASH);
      const assessmentB = ProductionDFMDecisionEngine.evaluateManufacturingAssessment(
        [featA],
        true,
        true,
        undefined,
        REV_B_HASH,
        GEOM_1_HASH
      );
      details.push({
        testId: 'M-MFG-02',
        description: 'Cross-revision manufacturing feature rejected as UNMANUFACTURABLE by DFM engine in Rev B',
        passed: assessmentB.status === 'UNMANUFACTURABLE' && assessmentB.violations.some(v => v.ruleId === 'DFM-SEC-002-INVALID-BINDING')
      });
    } catch (e: any) {
      details.push({ testId: 'M-MFG-02', description: 'Cross-revision DFM', passed: false, details: e.message });
    }

    // CASE M-MFG-03: Missing binding in Feature -> REJECT DFM
    try {
      const featUnbound = { ...createSyntheticFeature('feat_pocket_1', REV_A_HASH, GEOM_1_HASH), derivedArtifactBinding: undefined };
      const assessmentUnbound = ProductionDFMDecisionEngine.evaluateManufacturingAssessment(
        [featUnbound],
        true,
        true,
        undefined,
        REV_A_HASH,
        GEOM_1_HASH
      );
      details.push({
        testId: 'M-MFG-03',
        description: 'Manufacturing feature lacking binding rejected by DFM engine',
        passed: assessmentUnbound.status === 'UNMANUFACTURABLE' && assessmentUnbound.violations.some(v => v.ruleId === 'DFM-SEC-001-MISSING-BINDING')
      });
    } catch (e: any) {
      details.push({ testId: 'M-MFG-03', description: 'Missing binding DFM', passed: false, details: e.message });
    }

    // CASE M-MFG-04: Process Planning Setup Plan Generation Enforcement
    try {
      const featA = createSyntheticFeature('feat_pocket_1', REV_A_HASH, GEOM_1_HASH);
      let rejected = false;
      try {
        ProductionProcessPlanningEngine.generateSetupPlan([featA], REV_B_HASH, GEOM_1_HASH);
      } catch (err: any) {
        rejected = err.message.includes('binding verification failed');
      }
      details.push({
        testId: 'M-MFG-04',
        description: 'Process planning setup plan generation rejects cross-revision feature',
        passed: rejected
      });
    } catch (e: any) {
      details.push({ testId: 'M-MFG-04', description: 'Process planning enforcement', passed: false, details: e.message });
    }

    // =========================================================================
    // 3. CAM / TOOLPATH PRODUCTION CONSUMER ENFORCEMENT (VERIFIER, CL PACKAGE, CERTIFICATE)
    // =========================================================================

    const stock: StockModel = {
      stockId: 'STOCK_1',
      material: 'ALUMINUM_6061',
      bounds: { xMin: -50, xMax: 100, yMin: -50, yMax: 100, zMin: -20, zMax: 50 },
      initialVolumeMm3: 100000,
      fingerprint: 'fp_stock_1'
    };

    // CASE C-CAM-01: Toolpath A verified in Revision A -> ACCEPT & CERTIFICATE ISSUED
    try {
      const toolpathA = await createSyntheticToolpath('OP_ROUGH_1', REV_A_HASH, GEOM_1_HASH);
      const verifiedA = await ToolpathVerificationEngine.verifyToolpathAsync(
        toolpathA,
        0,
        stock,
        REV_A_HASH,
        GEOM_1_HASH
      );
      details.push({
        testId: 'C-CAM-01',
        description: 'Toolpath trajectory in matching Revision A accepted with truth certificate',
        passed: verifiedA.verificationReport?.isValid === true
      });
    } catch (e: any) {
      details.push({ testId: 'C-CAM-01', description: 'Toolpath Rev A', passed: false, details: e.message });
    }

    // CASE C-CAM-02: Toolpath A verified in Revision B -> REJECT & NO CERTIFICATE
    try {
      const toolpathA = await createSyntheticToolpath('OP_ROUGH_1', REV_A_HASH, GEOM_1_HASH);
      const verifiedB = await ToolpathVerificationEngine.verifyToolpathAsync(
        toolpathA,
        0,
        stock,
        REV_B_HASH,
        GEOM_1_HASH
      );
      details.push({
        testId: 'C-CAM-02',
        description: 'Toolpath trajectory from Revision A rejected when verified for Revision B',
        passed: verifiedB.verificationReport?.isValid === false &&
                verifiedB.verificationReport.issues.some(i => i.issueType === 'INVALID_DERIVED_BINDING')
      });
    } catch (e: any) {
      details.push({ testId: 'C-CAM-02', description: 'Cross-revision toolpath', passed: false, details: e.message });
    }

    // CASE C-CAM-03: Toolpath missing derived artifact binding -> REJECT
    try {
      const toolpathUnbound: CandidateToolpathTrajectory = {
        operationId: 'OP_UNBOUND',
        strategy: 'ROUGHING',
        points: [{ pointIndex: 0, position: { x: 0, y: 0, z: 10 }, feedRateMmMin: 1000, spindleRpm: 8000, moveType: 'RAPID_APPROACH' }],
        totalLengthMm: 10,
        estimatedTimeSec: 1,
        generatedAt: new Date().toISOString(),
        provenance: { trajectoryHash: 'traj_123' } // Lacks derivedArtifactBinding
      };
      const verifiedUnbound = await ToolpathVerificationEngine.verifyToolpathAsync(
        toolpathUnbound,
        0,
        stock,
        REV_A_HASH,
        GEOM_1_HASH
      );
      details.push({
        testId: 'C-CAM-03',
        description: 'Toolpath lacking derived artifact binding rejected as CRITICAL violation',
        passed: verifiedUnbound.verificationReport?.isValid === false &&
                verifiedUnbound.verificationReport.issues.some(i => i.issueType === 'MISSING_DERIVED_BINDING')
      });
    } catch (e: any) {
      details.push({ testId: 'C-CAM-03', description: 'Missing toolpath binding', passed: false, details: e.message });
    }

    // CASE C-CAM-04: CutterLocationDataEngine CL Package creation enforcement
    try {
      const toolpathA = await createSyntheticToolpath('OP_ROUGH_1', REV_A_HASH, GEOM_1_HASH);
      const verifiedTrajectoryA: VerifiedToolpathTrajectory = {
        ...toolpathA,
        verificationReport: {
          operationId: toolpathA.operationId,
          isValid: true,
          metrics: {
            totalLengthMm: 20,
            segmentCount: 2,
            minSegmentLengthMm: 10,
            zeroLengthSegments: 0,
            continuityGaps: 0,
            maxCoordinateDeviationMm: 0,
            stockViolations: 0,
            invalidSegments: 0
          },
          issues: [],
          verifiedAt: new Date().toISOString(),
          provenanceHash: 'prov_hash_1'
        }
      };

      let clRejected = false;
      try {
        await CutterLocationDataEngine.createCLPackage(
          'PART_001',
          [{ name: 'Op 1', operationId: 'OP_ROUGH_1' }],
          [verifiedTrajectoryA],
          [],
          REV_B_HASH, // Mismatched target revision
          GEOM_1_HASH
        );
      } catch (err: any) {
        clRejected = err.message.includes('binding rejected');
      }

      details.push({
        testId: 'C-CAM-04',
        description: 'CL package creation fails closed when trajectory does not match target revision',
        passed: clRejected
      });
    } catch (e: any) {
      details.push({ testId: 'C-CAM-04', description: 'CL package creation enforcement', passed: false, details: e.message });
    }

    // Summary calculation
    const passedCount = details.filter(d => d.passed).length;
    const failedCount = details.length - passedCount;

    return {
      totalTests: details.length,
      passedCount,
      failedCount,
      details
    };
  }
}
