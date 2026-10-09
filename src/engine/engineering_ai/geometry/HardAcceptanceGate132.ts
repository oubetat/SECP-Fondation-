import {
  GeometryContext,
  GeometryEntityDescriptor,
  GeometryToleranceProfile,
  GeometryFeatureEvidence
} from './types';
import { CanonicalGeometrySerializer } from './CanonicalGeometrySerializer';
import { SpatialReasoningEngine } from './SpatialReasoningEngine';
import { AIGeometryFeatureRecognizer } from './AIGeometryFeatureRecognizer';
import { GeometryHallucinationDetector } from './GeometryHallucinationDetector';
import { GeometryReasoningQueryEngine } from './GeometryReasoningQueryEngine';
import { GeometryRevisionDiffEngine } from './GeometryRevisionDiffEngine';
import { GeometryDependencyReasoner } from './GeometryDependencyReasoner';
import { GeometryAnomalyDetector } from './GeometryAnomalyDetector';
import { GeometrySimilarityEngine } from './GeometrySimilarityEngine';
import { EngineeringGeometryReasoner } from './EngineeringGeometryReasoner';
import { TwinEvidenceGraphEngine } from '../../twin_evidence/TwinEvidenceGraphEngine';

export interface Gate132CheckResult {
  gateId: string;
  description: string;
  passed: boolean;
  score: number;
  details: string;
}

export interface Gate132Summary {
  totalChecks: number;
  passedChecks: number;
  overallScore: number;
  verdict: 'PASS' | 'FAIL';
  checks: Gate132CheckResult[];
}

export class HardAcceptanceGate132 {
  public static evaluateGate(): Gate132Summary {
    const checks: Gate132CheckResult[] = [];

    const defaultTol: GeometryToleranceProfile = {
      linearTolerance: 0.001,
      angularTolerance: 0.01, // 0.01 degrees
      topologyTolerance: 1e-6,
      intersectionTolerance: 1e-5,
      classificationTolerance: 0.01
    };

    const ctxA: GeometryContext = {
      modelId: 'BRACKET-2026-A',
      geometryRevision: 'REV-A',
      kernelVersion: 'OpenCASCADE-7.6.0',
      topologyVersion: 'B-REP-v2',
      coordinateSystem: 'CARTESIAN_GLOBAL',
      units: 'mm',
      toleranceProfile: defaultTol,
      geometryHash: ''
    };

    // Sample Entities for Rev A
    const entHole1: GeometryEntityDescriptor = {
      entityId: 'FACE-CYL-01',
      entityType: 'FACE',
      geometryType: 'CYLINDER',
      dimension: 2,
      boundingBox: { min: [-6, -6, 0], max: [6, 6, 20] },
      parameters: { diameter: 12, depth: 20, isInternal: true },
      kernelReference: 'CAD-REF-001',
      hash: ''
    };
    entHole1.hash = CanonicalGeometrySerializer.computeEntityHash(entHole1);

    const entHole2: GeometryEntityDescriptor = {
      entityId: 'FACE-CYL-02',
      entityType: 'FACE',
      geometryType: 'CYLINDER',
      dimension: 2,
      boundingBox: { min: [44, -6, 0], max: [56, 6, 20] },
      parameters: { diameter: 12, depth: 20, isInternal: true },
      kernelReference: 'CAD-REF-002',
      hash: ''
    };
    entHole2.hash = CanonicalGeometrySerializer.computeEntityHash(entHole2);

    const entHole3: GeometryEntityDescriptor = {
      entityId: 'FACE-CYL-03',
      entityType: 'FACE',
      geometryType: 'CYLINDER',
      dimension: 2,
      boundingBox: { min: [94, -6, 0], max: [106, 6, 20] },
      parameters: { diameter: 15, depth: 20, isInternal: true },
      kernelReference: 'CAD-REF-003',
      hash: ''
    };
    entHole3.hash = CanonicalGeometrySerializer.computeEntityHash(entHole3);

    const entPocket1: GeometryEntityDescriptor = {
      entityId: 'FACE-PLN-POCKET1',
      entityType: 'FACE',
      geometryType: 'PLANE',
      dimension: 2,
      boundingBox: { min: [10, 10, 5], max: [40, 30, 5] },
      parameters: { depth: 15, isPocketFloor: true },
      kernelReference: 'CAD-REF-004',
      hash: ''
    };
    entPocket1.hash = CanonicalGeometrySerializer.computeEntityHash(entPocket1);

    const entPocket2: GeometryEntityDescriptor = {
      entityId: 'FACE-PLN-POCKET2',
      entityType: 'FACE',
      geometryType: 'PLANE',
      dimension: 2,
      boundingBox: { min: [50, 10, 5], max: [80, 30, 5] },
      parameters: { depth: 15, isPocketFloor: true },
      kernelReference: 'CAD-REF-005',
      hash: ''
    };
    entPocket2.hash = CanonicalGeometrySerializer.computeEntityHash(entPocket2);

    const entFillet1: GeometryEntityDescriptor = {
      entityId: 'FACE-BLEND-01',
      entityType: 'FACE',
      geometryType: 'ROUND_SURFACE',
      dimension: 2,
      boundingBox: { min: [0, 0, 0], max: [2, 2, 20] },
      parameters: { radius: 2.5, isFillet: true },
      kernelReference: 'CAD-REF-006',
      hash: ''
    };
    entFillet1.hash = CanonicalGeometrySerializer.computeEntityHash(entFillet1);

    const sampleEntitiesRevA = [entHole1, entHole2, entHole3, entPocket1, entPocket2, entFillet1];
    ctxA.geometryHash = CanonicalGeometrySerializer.computeGeometryHash(
      ctxA.modelId,
      ctxA.geometryRevision,
      sampleEntitiesRevA,
      ctxA.topologyVersion,
      ctxA.units
    );

    // 1. GATE-132-01: Feature Recognition & Verification (Test #51)
    const reasonerA = new EngineeringGeometryReasoner(ctxA, sampleEntitiesRevA);
    const verifiedFeats = reasonerA.recognizeAndVerifyFeatures();

    const holes = verifiedFeats.filter((f) => f.featureType === 'HOLE' && f.kernelVerification === 'PASS');
    const pockets = verifiedFeats.filter((f) => f.featureType === 'POCKET' && f.kernelVerification === 'PASS');
    const fillets = verifiedFeats.filter((f) => f.featureType === 'FILLET' && f.kernelVerification === 'PASS');

    const g01Passed = holes.length === 3 && pockets.length === 2 && fillets.length === 1;
    checks.push({
      gateId: 'GATE-132-01',
      description: 'Feature Recognition & CAD Kernel Verification (3 Holes, 2 Pockets, 1 Fillet)',
      passed: g01Passed,
      score: g01Passed ? 100 : 0,
      details: g01Passed
        ? `Recognized and kernel-verified 3 Holes, 2 Pockets, 1 Fillet correctly.`
        : `Feature recognition failed: Holes=${holes.length}, Pockets=${pockets.length}, Fillets=${fillets.length}`
    });

    // 2. GATE-132-02: False Feature Rejection (Test #52)
    const falseHoleEntity: GeometryEntityDescriptor = {
      entityId: 'FACE-PLN-FLAT',
      entityType: 'FACE',
      geometryType: 'PLANE',
      dimension: 2,
      boundingBox: { min: [0, 0, 0], max: [100, 100, 0] },
      parameters: { isNonHole: true },
      kernelReference: 'CAD-REF-FLAT',
      hash: ''
    };
    falseHoleEntity.hash = CanonicalGeometrySerializer.computeEntityHash(falseHoleEntity);

    const falseHypothesis = {
      hypothesisId: 'HYP-FALSE-HOLE',
      featureType: 'HOLE' as const,
      entityIds: ['FACE-PLN-FLAT'],
      proposedParameters: { diameter: 12 },
      recognitionConfidence: 0.997,
      reasoningNotes: 'Hallucinated hole on flat plane'
    };

    const falseEvidence = AIGeometryFeatureRecognizer.verifyFeatureHypothesis(
      falseHypothesis,
      ctxA,
      [falseHoleEntity]
    );

    const g02Passed = falseEvidence.kernelVerification === 'CONTRADICTED_BY_KERNEL';
    checks.push({
      gateId: 'GATE-132-02',
      description: 'False Feature Rejection (High AI confidence hole hypothesis rejected by kernel)',
      passed: g02Passed,
      score: g02Passed ? 100 : 0,
      details: g02Passed
        ? `Kernel correctly rejected false hole hypothesis with CONTRADICTED_BY_KERNEL`
        : `False feature rejection check failed`
    });

    // 3. GATE-132-03: Parallel Faces Spatial Reasoning (Test #53)
    const face1 = { ...entPocket1, entityId: 'FACE-PLN-1' };
    const face2 = { ...entPocket2, entityId: 'FACE-PLN-2' };
    const parallelRes = SpatialReasoningEngine.evaluateParallel(face1, face2, 0.002, defaultTol); // 0.002 <= 0.01 tol
    const g03Passed = parallelRes.relation === 'PARALLEL' && parallelRes.kernelVerification;
    checks.push({
      gateId: 'GATE-132-03',
      description: 'Tolerance-Aware Parallel Faces Reasoning',
      passed: g03Passed,
      score: g03Passed ? 100 : 0,
      details: g03Passed
        ? `Faces evaluated as PARALLEL within tolerance angular limit (0.002 deg <= 0.01 deg)`
        : `Parallel faces check failed`
    });

    // 4. GATE-132-04: Near Parallel Faces Rejection (Test #54)
    const nearParallelRes = SpatialReasoningEngine.evaluateParallel(face1, face2, 0.5, defaultTol); // 0.5 > 0.01 tol
    const g04Passed = nearParallelRes.relation === 'NONE';
    checks.push({
      gateId: 'GATE-132-04',
      description: 'Near Parallel Faces Rejection (Refuted when angle > tolerance)',
      passed: g04Passed,
      score: g04Passed ? 100 : 0,
      details: g04Passed
        ? `Near-parallel face (0.5 deg off) correctly REFUTED from being classified PARALLEL`
        : `Near parallel rejection check failed`
    });

    // 5. GATE-132-05: Revision Diff & Feature Change Reasoning (Test #55)
    const ctxB: GeometryContext = {
      ...ctxA,
      geometryRevision: 'REV-B',
      geometryHash: ''
    };

    const entHoleAdded: GeometryEntityDescriptor = {
      entityId: 'FACE-CYL-04',
      entityType: 'FACE',
      geometryType: 'CYLINDER',
      dimension: 2,
      boundingBox: { min: [144, -6, 0], max: [156, 6, 20] },
      parameters: { diameter: 10, depth: 20, isInternal: true },
      kernelReference: 'CAD-REF-007',
      hash: ''
    };
    entHoleAdded.hash = CanonicalGeometrySerializer.computeEntityHash(entHoleAdded);

    const entHole3Modified: GeometryEntityDescriptor = {
      ...entHole3,
      parameters: { diameter: 18, depth: 20, isInternal: true } // Diameter changed 15 -> 18
    };
    entHole3Modified.hash = CanonicalGeometrySerializer.computeEntityHash(entHole3Modified);

    const sampleEntitiesRevB = [entHole1, entHole2, entHole3Modified, entPocket1, entPocket2, entFillet1, entHoleAdded];
    ctxB.geometryHash = CanonicalGeometrySerializer.computeGeometryHash(
      ctxB.modelId,
      ctxB.geometryRevision,
      sampleEntitiesRevB,
      ctxB.topologyVersion,
      ctxB.units
    );

    const diff = GeometryRevisionDiffEngine.compareRevisions(ctxA, sampleEntitiesRevA, ctxB, sampleEntitiesRevB);

    const hasAdded = diff.changedEntities.some((c) => c.changeType === 'ADDED_FEATURE' && c.entityId === 'FACE-CYL-04');
    const hasParam = diff.changedEntities.some((c) => c.changeType === 'PARAMETRIC' && c.entityId === 'FACE-CYL-03');
    const g05Passed = hasAdded && hasParam && diff.kernelComparison === 'MODIFIED';
    checks.push({
      gateId: 'GATE-132-05',
      description: 'Revision Reasoning & Change Classification (ADDED_FEATURE + PARAMETRIC)',
      passed: g05Passed,
      score: g05Passed ? 100 : 0,
      details: g05Passed
        ? `Revision B correctly detected ADDED_FEATURE (FACE-CYL-04) and PARAMETRIC change (FACE-CYL-03)`
        : `Revision diff check failed`
    });

    // 6. GATE-132-06: Hallucination Detection & Grounding (Test #56)
    const hallucinatedClaim = {
      claimText: 'The bracket contains a non-existent center thread M20 on face FACE-NONEXISTENT',
      mentionedEntityIds: ['FACE-NONEXISTENT']
    };
    const hallRes = GeometryHallucinationDetector.verifyClaimGrounding(
      hallucinatedClaim,
      sampleEntitiesRevA,
      verifiedFeats,
      ctxA
    );
    const g06Passed = hallRes.verdict === 'UNGROUNDED';
    checks.push({
      gateId: 'GATE-132-06',
      description: 'Geometry Hallucination Detection (Non-existent entity claim flagged as UNGROUNDED)',
      passed: g06Passed,
      score: g06Passed ? 100 : 0,
      details: g06Passed
        ? `Hallucinated claim referencing FACE-NONEXISTENT correctly flagged UNGROUNDED`
        : `Hallucination check failed`
    });

    // 7. GATE-132-07: Unit Safety & Query Compilation (Test #57)
    const inchCtx: GeometryContext = {
      ...ctxA,
      units: 'inch'
    };
    const entInchHole: GeometryEntityDescriptor = {
      ...entHole1,
      parameters: { diameter: 0.5 } // 0.5 inch = 12.7 mm
    };

    const inchGraph = new EngineeringGeometryReasoner(inchCtx, [entInchHole]);
    const queryRes = inchGraph.queryGeometry('Find all holes larger than 10 mm');

    const g07Passed = queryRes.unitConverted && queryRes.matchedEntities.length === 1;
    checks.push({
      gateId: 'GATE-132-07',
      description: 'Unit Safety & Automatic Unit Conversion (0.5 inch converted to 12.7 mm > 10 mm)',
      passed: g07Passed,
      score: g07Passed ? 100 : 0,
      details: g07Passed
        ? `Query correctly converted units from inch to mm and matched 0.5 inch hole (12.7 mm > 10 mm)`
        : `Unit safety query check failed`
    });

    // 8. GATE-132-08: Invalid Topology B-Rep Kernel Rejection (Test #58)
    const invalidTopEntity: GeometryEntityDescriptor = {
      entityId: 'FACE-OPEN-SHELL',
      entityType: 'FACE',
      geometryType: 'B-SPLINE',
      dimension: 2,
      boundingBox: { min: [0, 0, 0], max: [10, 10, 10] },
      parameters: { isOpenShell: true },
      kernelReference: 'CAD-INVALID-01',
      hash: ''
    };
    invalidTopEntity.hash = CanonicalGeometrySerializer.computeEntityHash(invalidTopEntity);

    const anomalies = GeometryAnomalyDetector.detectAnomalies([invalidTopEntity], ctxA);
    const hasKernelRejected = anomalies.some((a) => a.verdict === 'KERNEL_REJECTED');
    const g08Passed = hasKernelRejected;
    checks.push({
      gateId: 'GATE-132-08',
      description: 'Topology Reasoning & B-Rep Kernel Anomaly Rejection',
      passed: g08Passed,
      score: g08Passed ? 100 : 0,
      details: g08Passed
        ? `Invalid B-Rep topology correctly flagged as KERNEL_REJECTED`
        : `Topology anomaly check failed`
    });

    // 9. GATE-132-09: Similarity vs Equality Rule (Test #59)
    const simRes = GeometrySimilarityEngine.compareSimilarity(
      ctxA,
      sampleEntitiesRevA,
      ctxB,
      sampleEntitiesRevB
    );
    const g09Passed = simRes.verdict === 'SIMILAR' && simRes.overallSimilarity > 0.8;
    checks.push({
      gateId: 'GATE-132-09',
      description: 'Geometry Similarity Engine (Similarity 95% = SIMILAR, refusing silent IDENTICAL claim)',
      passed: g09Passed,
      score: g09Passed ? 100 : 0,
      details: g09Passed
        ? `Near-matching geometries correctly classified SIMILAR, preserving strict equality boundaries`
        : `Similarity engine check failed`
    });

    // 10. GATE-132-10: Downstream Impact & Dependency Reasoning (Test #60)
    const depReasoner = new GeometryDependencyReasoner();
    depReasoner.addNode({ nodeId: 'N-GEO-FACE-01', nodeType: 'GEOMETRY', refId: 'FACE-CYL-01', dependsOn: [] });
    depReasoner.addNode({ nodeId: 'N-FEAT-HOLE-01', nodeType: 'FEATURE', refId: 'HOLE-01', dependsOn: ['FACE-CYL-01'] });
    depReasoner.addNode({ nodeId: 'N-SIM-FEM-01', nodeType: 'SIMULATION', refId: 'FEM-MESH-01', dependsOn: ['HOLE-01'] });
    depReasoner.addNode({ nodeId: 'N-CAM-TOOL-01', nodeType: 'CAM', refId: 'CAM-DRILL-12MM', dependsOn: ['HOLE-01'] });
    depReasoner.addNode({ nodeId: 'N-INSP-CMM-01', nodeType: 'INSPECTION', refId: 'CMM-PLAN-01', dependsOn: ['HOLE-01'] });

    const impact = depReasoner.getImpactedNodes('FACE-CYL-01');
    const g10Passed =
      impact.affectedSimulations.includes('FEM-MESH-01') &&
      impact.affectedCAM.includes('CAM-DRILL-12MM') &&
      impact.affectedInspections.includes('CMM-PLAN-01');

    checks.push({
      gateId: 'GATE-132-10',
      description: 'Geometry Impact & Downstream Engineering Dependency Reasoning',
      passed: g10Passed,
      score: g10Passed ? 100 : 0,
      details: g10Passed
        ? `Traced full downstream impact graph: Geometry -> Feature -> Simulation, CAM & Inspection`
        : `Dependency reasoning check failed`
    });

    const passedCount = checks.filter((c) => c.passed).length;
    const overallScore = (passedCount / checks.length) * 100;

    return {
      totalChecks: checks.length,
      passedChecks: passedCount,
      overallScore,
      verdict: passedCount === checks.length ? 'PASS' : 'FAIL',
      checks
    };
  }
}
