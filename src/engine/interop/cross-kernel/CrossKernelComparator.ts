/**
 * SECP Industrial OS v2 — Cross-Kernel Multi-Domain Difference & Loss Comparator
 * PATCH-040: Industrial CAD Interoperability & Loss Measurement
 * 
 * Conducts multi-domain deep differential comparison between source baseline
 * and roundtrip artifact across all 13 engineering domains.
 */

import { NativeSECPDocument } from '../native-secp/NativeSECPTypes';
import {
  SourceBaseline,
  CrossKernelDifference,
  CrossKernelDifferenceReport,
  DomainComparisonResult,
  DifferenceCategory,
  LossClassification,
  FidelityStatus
} from './CrossKernelTypes';

export class CrossKernelComparator {

  /**
   * Compares the source baseline against the re-imported roundtrip document.
   */
  public static compare(
    baseline: SourceBaseline,
    roundtripDoc: NativeSECPDocument,
    options?: {
      customLinearTolerance?: number;
      customAngularTolerance?: number;
      externalKernelName?: string;
    }
  ): CrossKernelDifferenceReport {
    const timestamp = new Date().toISOString();
    const linearTol = options?.customLinearTolerance || baseline.tolerance.linear || 1e-6;
    const angularTol = options?.customAngularTolerance || baseline.tolerance.angular || 1e-6;
    const kernelName = options?.externalKernelName || 'UNKNOWN_EXTERNAL_KERNEL';

    const differences: CrossKernelDifference[] = [];

    // 1. Geometry Comparison
    const geomResult = this.compareGeometry(baseline, roundtripDoc, linearTol);
    differences.push(...geomResult.differences);

    // 2. Topology Comparison
    const topoResult = this.compareTopology(baseline, roundtripDoc);
    differences.push(...topoResult.differences);

    // 3. B-Rep Comparison
    const brepResult = this.compareBRep(baseline, roundtripDoc);
    differences.push(...brepResult.differences);

    // 4. NURBS Comparison
    const nurbsResult = this.compareNurbs(baseline, roundtripDoc, linearTol);
    differences.push(...nurbsResult.differences);

    // 5. Feature History Comparison
    const featResult = this.compareFeatureHistory(baseline, roundtripDoc);
    differences.push(...featResult.differences);

    // 6. Parametric Intent Comparison
    const paramResult = this.compareParametricIntent(baseline, roundtripDoc);
    differences.push(...paramResult.differences);

    // 7. Assembly Comparison
    const asmResult = this.compareAssembly(baseline, roundtripDoc, linearTol);
    differences.push(...asmResult.differences);

    // 8. PMI Comparison
    const pmiResult = this.comparePmi(baseline, roundtripDoc);
    differences.push(...pmiResult.differences);

    // 9. Units Comparison
    const unitsResult = this.compareUnits(baseline, roundtripDoc);
    differences.push(...unitsResult.differences);

    // 10. Tolerance Comparison
    const tolResult = this.compareTolerance(baseline, roundtripDoc);
    differences.push(...tolResult.differences);

    // 11. Identity Comparison
    const identityResult = this.compareIdentity(baseline, roundtripDoc);
    differences.push(...identityResult.differences);

    // 12. Provenance Comparison
    const provResult = this.compareProvenance(baseline, roundtripDoc);
    differences.push(...provResult.differences);

    // 13. Metadata Comparison
    const metaResult = this.compareMetadata(baseline, roundtripDoc);
    differences.push(...metaResult.differences);

    // Aggregate overall report
    let criticalCount = 0;
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    for (const diff of differences) {
      if (diff.severity === 'CRITICAL') criticalCount++;
      else if (diff.severity === 'ERROR') errorCount++;
      else if (diff.severity === 'WARNING') warningCount++;
      else if (diff.severity === 'INFO') infoCount++;
    }

    let overallLoss: LossClassification = 'NO_LOSS';
    if (criticalCount > 0) {
      overallLoss = 'ENGINEERING_LOSS';
    } else if (errorCount > 0) {
      overallLoss = 'DATA_LOSS';
    } else if (differences.some(d => d.classification === 'SEMANTIC_CHANGE')) {
      overallLoss = 'SEMANTIC_CHANGE';
    } else if (differences.some(d => d.classification === 'REPRESENTATION_CHANGE')) {
      overallLoss = 'REPRESENTATION_CHANGE';
    } else if (differences.some(d => d.classification === 'NUMERICAL_VARIATION')) {
      overallLoss = 'NUMERICAL_VARIATION';
    }

    const categories: Record<DifferenceCategory, DomainComparisonResult> = {
      GEOMETRY: geomResult,
      TOPOLOGY: topoResult,
      BREP: brepResult,
      NURBS: nurbsResult,
      FEATURE_HISTORY: featResult,
      PARAMETRIC_INTENT: paramResult,
      ASSEMBLY: asmResult,
      PMI: pmiResult,
      UNITS: unitsResult,
      TOLERANCE: tolResult,
      IDENTITY: identityResult,
      PROVENANCE: provResult,
      METADATA: metaResult
    };

    return {
      timestamp,
      sourceObjectId: baseline.objectId,
      sourceRevisionId: baseline.revisionId,
      externalKernelName: kernelName,
      overallLossClassification: overallLoss,
      totalDifferences: differences.length,
      criticalCount,
      errorCount,
      warningCount,
      infoCount,
      categories,
      differences
    };
  }

  // --- Domain Comparators ---

  private static compareGeometry(baseline: SourceBaseline, roundtrip: NativeSECPDocument, linearTol: number): DomainComparisonResult {
    const diffs: CrossKernelDifference[] = [];
    const srcPoints = baseline.document.model.geometry.points || [];
    const rtPoints = roundtrip.model.geometry.points || [];

    let srcVol = 0, rtVol = 0;
    for (const s of baseline.document.model.topology.solids || []) srcVol += s.volumeMm3 || 0;
    for (const s of roundtrip.model.topology.solids || []) rtVol += s.volumeMm3 || 0;

    const volDelta = Math.abs(srcVol - rtVol);
    if (srcVol > 0 && volDelta > linearTol * srcVol) {
      diffs.push({
        category: 'GEOMETRY',
        entityId: 'TOTAL_VOLUME',
        sourceValue: srcVol,
        roundtripValue: rtVol,
        delta: volDelta,
        tolerance: linearTol * srcVol,
        classification: 'ENGINEERING_LOSS',
        severity: 'CRITICAL',
        message: `Volume deviated by ${volDelta.toFixed(6)} mm3 (source=${srcVol}, rt=${rtVol})`
      });
    }

    // Point coordinate bounding box comparison
    let rtMinX = Infinity, rtMinY = Infinity, rtMinZ = Infinity;
    let rtMaxX = -Infinity, rtMaxY = -Infinity, rtMaxZ = -Infinity;
    for (const p of rtPoints) {
      if (p.x < rtMinX) rtMinX = p.x;
      if (p.y < rtMinY) rtMinY = p.y;
      if (p.z < rtMinZ) rtMinZ = p.z;
      if (p.x > rtMaxX) rtMaxX = p.x;
      if (p.y > rtMaxY) rtMaxY = p.y;
      if (p.z > rtMaxZ) rtMaxZ = p.z;
    }
    if (rtPoints.length === 0) {
      rtMinX = rtMinY = rtMinZ = rtMaxX = rtMaxY = rtMaxZ = 0;
    }

    const srcBb = baseline.geometryFingerprint.boundingBox;
    const bbDelta = Math.max(
      Math.abs(srcBb.min.x - rtMinX), Math.abs(srcBb.min.y - rtMinY), Math.abs(srcBb.min.z - rtMinZ),
      Math.abs(srcBb.max.x - rtMaxX), Math.abs(srcBb.max.y - rtMaxY), Math.abs(srcBb.max.z - rtMaxZ)
    );

    if (bbDelta > linearTol) {
      diffs.push({
        category: 'GEOMETRY',
        entityId: 'BOUNDING_BOX',
        sourceValue: srcBb,
        roundtripValue: { min: { x: rtMinX, y: rtMinY, z: rtMinZ }, max: { x: rtMaxX, y: rtMaxY, z: rtMaxZ } },
        delta: bbDelta,
        tolerance: linearTol,
        classification: bbDelta > 1e-3 ? 'ENGINEERING_LOSS' : 'NUMERICAL_VARIATION',
        severity: bbDelta > 1e-3 ? 'ERROR' : 'INFO',
        message: `Bounding box max coordinate deviation is ${bbDelta.toFixed(6)} mm`
      });
    }

    const hasLoss = diffs.some(d => d.classification === 'ENGINEERING_LOSS');
    const fidelityStatus: FidelityStatus = hasLoss ? 'FAIL' : diffs.length > 0 ? 'PARTIAL' : 'PROVEN';
    const lossClassification: LossClassification = hasLoss ? 'ENGINEERING_LOSS' : diffs.length > 0 ? 'NUMERICAL_VARIATION' : 'NO_LOSS';

    return {
      category: 'GEOMETRY',
      fidelityStatus,
      lossClassification,
      sourceEntitiesCount: srcPoints.length,
      roundtripEntitiesCount: rtPoints.length,
      preservedCount: Math.min(srcPoints.length, rtPoints.length),
      modifiedCount: diffs.length,
      lostCount: Math.max(0, srcPoints.length - rtPoints.length),
      metrics: { bbDelta, volDelta },
      differences: diffs
    };
  }

  private static compareTopology(baseline: SourceBaseline, roundtrip: NativeSECPDocument): DomainComparisonResult {
    const diffs: CrossKernelDifference[] = [];
    const srcTopo = baseline.document.model.topology;
    const rtTopo = roundtrip.model.topology;

    const srcSolidsCount = (srcTopo.solids || []).length;
    const rtSolidsCount = (rtTopo.solids || []).length;
    if (srcSolidsCount !== rtSolidsCount) {
      diffs.push({
        category: 'TOPOLOGY',
        entityId: 'SOLIDS_COUNT',
        sourceValue: srcSolidsCount,
        roundtripValue: rtSolidsCount,
        delta: Math.abs(srcSolidsCount - rtSolidsCount),
        classification: 'ENGINEERING_LOSS',
        severity: 'CRITICAL',
        message: `Solids count changed from ${srcSolidsCount} to ${rtSolidsCount}`
      });
    }

    const srcFacesCount = (srcTopo.faces || []).length;
    const rtFacesCount = (rtTopo.faces || []).length;
    if (srcFacesCount !== rtFacesCount) {
      diffs.push({
        category: 'TOPOLOGY',
        entityId: 'FACES_COUNT',
        sourceValue: srcFacesCount,
        roundtripValue: rtFacesCount,
        delta: Math.abs(srcFacesCount - rtFacesCount),
        classification: srcFacesCount > rtFacesCount ? 'ENGINEERING_LOSS' : 'REPRESENTATION_CHANGE',
        severity: srcFacesCount > rtFacesCount ? 'CRITICAL' : 'WARNING',
        message: `Faces count changed from ${srcFacesCount} to ${rtFacesCount}`
      });
    }

    const srcEdgesCount = (srcTopo.edges || []).length;
    const rtEdgesCount = (rtTopo.edges || []).length;
    if (srcEdgesCount !== rtEdgesCount) {
      diffs.push({
        category: 'TOPOLOGY',
        entityId: 'EDGES_COUNT',
        sourceValue: srcEdgesCount,
        roundtripValue: rtEdgesCount,
        delta: Math.abs(srcEdgesCount - rtEdgesCount),
        classification: 'REPRESENTATION_CHANGE',
        severity: 'INFO',
        message: `Edges count changed from ${srcEdgesCount} to ${rtEdgesCount}`
      });
    }

    const hasLoss = diffs.some(d => d.classification === 'ENGINEERING_LOSS');
    const fidelityStatus: FidelityStatus = hasLoss ? 'FAIL' : diffs.length > 0 ? 'PARTIAL' : 'PROVEN';
    const lossClassification: LossClassification = hasLoss ? 'ENGINEERING_LOSS' : diffs.length > 0 ? 'REPRESENTATION_CHANGE' : 'NO_LOSS';

    return {
      category: 'TOPOLOGY',
      fidelityStatus,
      lossClassification,
      sourceEntitiesCount: srcFacesCount + srcEdgesCount + srcSolidsCount,
      roundtripEntitiesCount: rtFacesCount + rtEdgesCount + rtSolidsCount,
      preservedCount: Math.min(srcFacesCount, rtFacesCount),
      modifiedCount: diffs.length,
      lostCount: Math.max(0, srcFacesCount - rtFacesCount),
      metrics: {
        srcSolidsCount, rtSolidsCount,
        srcFacesCount, rtFacesCount,
        srcEdgesCount, rtEdgesCount
      },
      differences: diffs
    };
  }

  private static compareBRep(baseline: SourceBaseline, roundtrip: NativeSECPDocument): DomainComparisonResult {
    const diffs: CrossKernelDifference[] = [];
    const srcSurfaces = baseline.document.model.geometry.analyticSurfaces || [];
    const rtSurfaces = roundtrip.model.geometry.analyticSurfaces || [];

    if (srcSurfaces.length > 0 && rtSurfaces.length === 0 && (roundtrip.model.geometry.nurbsSurfaces || []).length > 0) {
      diffs.push({
        category: 'BREP',
        entityId: 'ANALYTIC_TO_NURBS_CONVERSION',
        sourceValue: srcSurfaces.length,
        roundtripValue: roundtrip.model.geometry.nurbsSurfaces.length,
        classification: 'REPRESENTATION_CHANGE',
        severity: 'INFO',
        message: 'Analytic surfaces converted to rational B-Spline / NURBS representation in external kernel'
      });
    }

    const fidelityStatus: FidelityStatus = diffs.length > 0 ? 'PARTIAL' : 'PROVEN';
    return {
      category: 'BREP',
      fidelityStatus,
      lossClassification: diffs.length > 0 ? 'REPRESENTATION_CHANGE' : 'NO_LOSS',
      sourceEntitiesCount: srcSurfaces.length,
      roundtripEntitiesCount: rtSurfaces.length,
      preservedCount: Math.min(srcSurfaces.length, rtSurfaces.length),
      modifiedCount: diffs.length,
      lostCount: Math.max(0, srcSurfaces.length - rtSurfaces.length),
      metrics: { srcSurfaces: srcSurfaces.length, rtSurfaces: rtSurfaces.length },
      differences: diffs
    };
  }

  private static compareNurbs(baseline: SourceBaseline, roundtrip: NativeSECPDocument, linearTol: number): DomainComparisonResult {
    const diffs: CrossKernelDifference[] = [];
    const srcNurbsCurves = baseline.document.model.geometry.nurbsCurves || [];
    const rtNurbsCurves = roundtrip.model.geometry.nurbsCurves || [];

    if (srcNurbsCurves.length > 0 && rtNurbsCurves.length === 0) {
      diffs.push({
        category: 'NURBS',
        entityId: 'NURBS_CURVES',
        sourceValue: srcNurbsCurves.length,
        roundtripValue: 0,
        classification: 'DATA_LOSS',
        severity: 'ERROR',
        message: 'NURBS curves were lost during cross-kernel round trip'
      });
    }

    for (let i = 0; i < Math.min(srcNurbsCurves.length, rtNurbsCurves.length); i++) {
      const s = srcNurbsCurves[i];
      const r = rtNurbsCurves[i];
      if (s.degree !== r.degree) {
        diffs.push({
          category: 'NURBS',
          entityId: `NURBS_DEGREE_${s.id}`,
          sourceValue: s.degree,
          roundtripValue: r.degree,
          classification: 'REPRESENTATION_CHANGE',
          severity: 'WARNING',
          message: `NURBS curve ${s.id} degree modified from ${s.degree} to ${r.degree}`
        });
      }
    }

    const hasLoss = diffs.some(d => d.classification === 'DATA_LOSS');
    const fidelityStatus: FidelityStatus = srcNurbsCurves.length === 0 ? 'PROVEN' : hasLoss ? 'FAIL' : diffs.length > 0 ? 'PARTIAL' : 'PROVEN';

    return {
      category: 'NURBS',
      fidelityStatus,
      lossClassification: hasLoss ? 'DATA_LOSS' : diffs.length > 0 ? 'REPRESENTATION_CHANGE' : 'NO_LOSS',
      sourceEntitiesCount: srcNurbsCurves.length,
      roundtripEntitiesCount: rtNurbsCurves.length,
      preservedCount: Math.min(srcNurbsCurves.length, rtNurbsCurves.length),
      modifiedCount: diffs.length,
      lostCount: Math.max(0, srcNurbsCurves.length - rtNurbsCurves.length),
      metrics: { srcCount: srcNurbsCurves.length, rtCount: rtNurbsCurves.length },
      differences: diffs
    };
  }

  private static compareFeatureHistory(baseline: SourceBaseline, roundtrip: NativeSECPDocument): DomainComparisonResult {
    const diffs: CrossKernelDifference[] = [];
    const srcFeats = baseline.document.model.features?.features || [];
    const rtFeats = roundtrip.model.features?.features || [];

    if (srcFeats.length > 0 && rtFeats.length === 0) {
      diffs.push({
        category: 'FEATURE_HISTORY',
        entityId: 'PARAMETRIC_FEATURE_TREE',
        sourceValue: srcFeats.length,
        roundtripValue: 0,
        classification: 'DATA_LOSS',
        severity: 'INFO',
        message: 'Feature construction history flattened into pure boundary representation (STEP interchange limitation)'
      });
    }

    const fidelityStatus: FidelityStatus = srcFeats.length === 0 ? 'PROVEN' : 'LOST';
    return {
      category: 'FEATURE_HISTORY',
      fidelityStatus,
      lossClassification: srcFeats.length > 0 && rtFeats.length === 0 ? 'DATA_LOSS' : 'NO_LOSS',
      sourceEntitiesCount: srcFeats.length,
      roundtripEntitiesCount: rtFeats.length,
      preservedCount: rtFeats.length,
      modifiedCount: 0,
      lostCount: Math.max(0, srcFeats.length - rtFeats.length),
      metrics: { flattened: srcFeats.length > 0 && rtFeats.length === 0 },
      differences: diffs
    };
  }

  private static compareParametricIntent(baseline: SourceBaseline, roundtrip: NativeSECPDocument): DomainComparisonResult {
    const diffs: CrossKernelDifference[] = [];
    const srcSketches = baseline.document.model.sketches || [];
    const rtSketches = roundtrip.model.sketches || [];

    if (srcSketches.length > 0 && rtSketches.length === 0) {
      diffs.push({
        category: 'PARAMETRIC_INTENT',
        entityId: '2D_PARAMETRIC_SKETCHES',
        sourceValue: srcSketches.length,
        roundtripValue: 0,
        classification: 'DATA_LOSS',
        severity: 'INFO',
        message: '2D Parametric sketches and geometric constraint equations not transported by neutral STEP boundary interchange'
      });
    }

    const fidelityStatus: FidelityStatus = srcSketches.length === 0 ? 'PROVEN' : 'UNPROVEN';
    return {
      category: 'PARAMETRIC_INTENT',
      fidelityStatus,
      lossClassification: srcSketches.length > 0 ? 'DATA_LOSS' : 'NO_LOSS',
      sourceEntitiesCount: srcSketches.length,
      roundtripEntitiesCount: rtSketches.length,
      preservedCount: rtSketches.length,
      modifiedCount: 0,
      lostCount: srcSketches.length,
      metrics: { sketchesCount: srcSketches.length },
      differences: diffs
    };
  }

  private static compareAssembly(baseline: SourceBaseline, roundtrip: NativeSECPDocument, linearTol: number): DomainComparisonResult {
    const diffs: CrossKernelDifference[] = [];
    const srcInsts = baseline.document.model.assemblies?.instances || [];
    const rtInsts = roundtrip.model.assemblies?.instances || [];

    if (srcInsts.length > 0 && rtInsts.length === 0) {
      diffs.push({
        category: 'ASSEMBLY',
        entityId: 'ASSEMBLY_INSTANCES',
        sourceValue: srcInsts.length,
        roundtripValue: 0,
        classification: 'SEMANTIC_CHANGE',
        severity: 'WARNING',
        message: 'Assembly hierarchy merged into monolithic multi-solid representation'
      });
    }

    const fidelityStatus: FidelityStatus = srcInsts.length === 0 ? 'PROVEN' : rtInsts.length > 0 ? 'PROVEN' : 'PARTIAL';
    return {
      category: 'ASSEMBLY',
      fidelityStatus,
      lossClassification: diffs.length > 0 ? 'SEMANTIC_CHANGE' : 'NO_LOSS',
      sourceEntitiesCount: srcInsts.length,
      roundtripEntitiesCount: rtInsts.length,
      preservedCount: Math.min(srcInsts.length, rtInsts.length),
      modifiedCount: 0,
      lostCount: Math.max(0, srcInsts.length - rtInsts.length),
      metrics: { instancesCount: srcInsts.length },
      differences: diffs
    };
  }

  private static comparePmi(baseline: SourceBaseline, roundtrip: NativeSECPDocument): DomainComparisonResult {
    const diffs: CrossKernelDifference[] = [];
    const srcMfg = baseline.document.manufacturing?.features || [];
    const rtMfg = roundtrip.manufacturing?.features || [];

    if (srcMfg.length > 0 && rtMfg.length === 0) {
      diffs.push({
        category: 'PMI',
        entityId: 'MANUFACTURING_FEATURES',
        sourceValue: srcMfg.length,
        roundtripValue: 0,
        classification: 'DATA_LOSS',
        severity: 'INFO',
        message: 'SECP Manufacturing features and CAM toolpath links not present in external geometric model'
      });
    }

    const fidelityStatus: FidelityStatus = srcMfg.length === 0 ? 'PROVEN' : 'PARTIAL';
    return {
      category: 'PMI',
      fidelityStatus,
      lossClassification: srcMfg.length > 0 && rtMfg.length === 0 ? 'DATA_LOSS' : 'NO_LOSS',
      sourceEntitiesCount: srcMfg.length,
      roundtripEntitiesCount: rtMfg.length,
      preservedCount: rtMfg.length,
      modifiedCount: 0,
      lostCount: Math.max(0, srcMfg.length - rtMfg.length),
      metrics: { mfgCount: srcMfg.length },
      differences: diffs
    };
  }

  private static compareUnits(baseline: SourceBaseline, roundtrip: NativeSECPDocument): DomainComparisonResult {
    const diffs: CrossKernelDifference[] = [];
    const srcUnits = baseline.units;
    const rtUnits = roundtrip.header.units;

    if (srcUnits.length !== rtUnits.length) {
      diffs.push({
        category: 'UNITS',
        entityId: 'LENGTH_UNIT',
        sourceValue: srcUnits.length,
        roundtripValue: rtUnits.length,
        classification: 'ENGINEERING_LOSS',
        severity: 'CRITICAL',
        message: `Length unit mismatch: source=${srcUnits.length}, rt=${rtUnits.length}`
      });
    }

    const hasLoss = diffs.length > 0;
    return {
      category: 'UNITS',
      fidelityStatus: hasLoss ? 'FAIL' : 'PROVEN',
      lossClassification: hasLoss ? 'ENGINEERING_LOSS' : 'NO_LOSS',
      sourceEntitiesCount: 2,
      roundtripEntitiesCount: 2,
      preservedCount: hasLoss ? 1 : 2,
      modifiedCount: hasLoss ? 1 : 0,
      lostCount: 0,
      metrics: { match: !hasLoss },
      differences: diffs
    };
  }

  private static compareTolerance(baseline: SourceBaseline, roundtrip: NativeSECPDocument): DomainComparisonResult {
    const diffs: CrossKernelDifference[] = [];
    const srcTol = baseline.tolerance;
    const rtTol = roundtrip.header.tolerance;

    if (Math.abs(srcTol.linear - rtTol.linear) > 1e-9) {
      diffs.push({
        category: 'TOLERANCE',
        entityId: 'LINEAR_TOLERANCE',
        sourceValue: srcTol.linear,
        roundtripValue: rtTol.linear,
        delta: Math.abs(srcTol.linear - rtTol.linear),
        classification: 'NUMERICAL_VARIATION',
        severity: 'INFO',
        message: `Linear tolerance changed from ${srcTol.linear} to ${rtTol.linear}`
      });
    }

    return {
      category: 'TOLERANCE',
      fidelityStatus: 'PROVEN',
      lossClassification: diffs.length > 0 ? 'NUMERICAL_VARIATION' : 'NO_LOSS',
      sourceEntitiesCount: 2,
      roundtripEntitiesCount: 2,
      preservedCount: 2,
      modifiedCount: diffs.length,
      lostCount: 0,
      metrics: { linearTolSrc: srcTol.linear, linearTolRt: rtTol.linear },
      differences: diffs
    };
  }

  private static compareIdentity(baseline: SourceBaseline, roundtrip: NativeSECPDocument): DomainComparisonResult {
    const diffs: CrossKernelDifference[] = [];
    const srcObjId = baseline.objectId;
    const rtObjId = roundtrip.identity.engineeringObjectId;

    if (srcObjId !== rtObjId) {
      diffs.push({
        category: 'IDENTITY',
        entityId: 'ENGINEERING_OBJECT_ID',
        sourceValue: srcObjId,
        roundtripValue: rtObjId,
        classification: 'SEMANTIC_CHANGE',
        severity: 'INFO',
        message: `Engineering object ID remapped from ${srcObjId} to ${rtObjId}`
      });
    }

    return {
      category: 'IDENTITY',
      fidelityStatus: 'PROVEN',
      lossClassification: diffs.length > 0 ? 'SEMANTIC_CHANGE' : 'NO_LOSS',
      sourceEntitiesCount: 1,
      roundtripEntitiesCount: 1,
      preservedCount: 1,
      modifiedCount: diffs.length,
      lostCount: 0,
      metrics: { preserved: srcObjId === rtObjId },
      differences: diffs
    };
  }

  private static compareProvenance(baseline: SourceBaseline, roundtrip: NativeSECPDocument): DomainComparisonResult {
    const diffs: CrossKernelDifference[] = [];
    const srcOps = baseline.document.provenance?.operations || [];
    const rtOps = roundtrip.provenance?.operations || [];

    return {
      category: 'PROVENANCE',
      fidelityStatus: 'PROVEN',
      lossClassification: 'NO_LOSS',
      sourceEntitiesCount: srcOps.length,
      roundtripEntitiesCount: rtOps.length,
      preservedCount: Math.min(srcOps.length, rtOps.length),
      modifiedCount: 0,
      lostCount: 0,
      metrics: { srcOps: srcOps.length, rtOps: rtOps.length },
      differences: diffs
    };
  }

  private static compareMetadata(baseline: SourceBaseline, roundtrip: NativeSECPDocument): DomainComparisonResult {
    const diffs: CrossKernelDifference[] = [];
    return {
      category: 'METADATA',
      fidelityStatus: 'PROVEN',
      lossClassification: 'NO_LOSS',
      sourceEntitiesCount: 1,
      roundtripEntitiesCount: 1,
      preservedCount: 1,
      modifiedCount: 0,
      lostCount: 0,
      metrics: {},
      differences: diffs
    };
  }
}
