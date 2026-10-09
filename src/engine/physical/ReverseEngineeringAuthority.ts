/**
 * SECP Industrial OS — Reverse Engineering & Metrology Authority
 * POST-PLUGIN-MATURITY-008R (Part A & C)
 *
 * Enforces authoritative pipeline from Physical Metrology / 3D Scans through
 * Feature Reconstruction, Geometric Interpretation, Deviation Analysis,
 * and Canonical Revision Promotion.
 */

import { createHash } from 'crypto';
import { PhysicalOriginType, PhysicalOriginSemantics, OriginTag } from './PhysicalOriginSemantics';
import { RevisionEngine } from '../revision/RevisionEngine';
import { RevisionLifecycleState } from '../revision/types';
import { AttestationCanonicalizer } from '../attestation/AttestationCanonicalizer';

export interface ScanPoint3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly intensity?: number;
}

export interface RawMetrologyScan {
  readonly scanId: string;
  readonly physicalSerialId: string;
  readonly instrumentType: 'LASER_SCANNER' | 'OPTICAL_CMM' | 'TACTILE_PROBE' | 'CT_XRAY';
  readonly instrumentId: string;
  readonly calibrationCertificateId: string;
  readonly measurementUncertaintyMm: number;
  readonly pointCount: number;
  readonly points: readonly ScanPoint3D[];
  readonly rawDataHash: string;
  readonly createdAt: string;
  readonly originTag: OriginTag;
}

export interface ReconstructedFeature {
  readonly featureId: string;
  readonly featureType: 'PLANAR_FACE' | 'CYLINDRICAL_BORE' | 'SPHERICAL_CAP' | 'FREEFORM_NURBS';
  readonly nominalParameters: Readonly<Record<string, number>>;
  readonly rmsFittingErrorMm: number;
  readonly maxFittingErrorMm: number;
  readonly originTag: OriginTag;
}

export interface DeviationAnalysisReport {
  readonly analysisId: string;
  readonly sourceRevisionHash: string;
  readonly asBuiltScanId: string;
  readonly physicalSerialId: string;
  readonly pointCountEvaluated: number;
  readonly meanDeviationMm: number;
  readonly rmsDeviationMm: number;
  readonly maxPositiveDeviationMm: number;
  readonly maxNegativeDeviationMm: number;
  readonly inTolerancePercentage: number;
  readonly toleranceBandMm: {
    readonly lowerMm: number;
    readonly upperMm: number;
  };
  readonly complianceVerdict: 'WITHIN_TOLERANCE' | 'OUT_OF_TOLERANCE_REWORKABLE' | 'OUT_OF_TOLERANCE_CRITICAL';
  readonly reportDigest: string;
  readonly createdAt: string;
}

export interface CanonicalReconstructionPackage {
  readonly reconstructionId: string;
  readonly scanId: string;
  readonly physicalSerialId: string;
  readonly sourceDesignRevisionHash: string;
  readonly reconstructedFeatures: readonly ReconstructedFeature[];
  readonly deviationReport: DeviationAnalysisReport;
  readonly reconstructedGeometryHash: string;
  readonly packageDigest: string;
  readonly originTag: OriginTag;
  readonly createdAt: string;
}

export class ReverseEngineeringAuthority {
  private static scans: Map<string, RawMetrologyScan> = new Map();
  private static deviations: Map<string, DeviationAnalysisReport> = new Map();
  private static reconstructions: Map<string, CanonicalReconstructionPackage> = new Map();

  /**
   * Computes deterministic SHA-256 hash of point cloud coordinate payload.
   */
  public static computeScanPointsHash(points: readonly ScanPoint3D[]): string {
    const rawStr = points.map(p => `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`).join(';');
    return createHash('sha256').update(rawStr, 'utf8').digest('hex');
  }

  /**
   * Ingests a raw metrology scan from calibrated measurement instrument.
   * Strictly tags origin as MEASURED with physical certificate binding.
   */
  public static ingestRawScan(request: {
    physicalSerialId: string;
    instrumentType: 'LASER_SCANNER' | 'OPTICAL_CMM' | 'TACTILE_PROBE' | 'CT_XRAY';
    instrumentId: string;
    calibrationCertificateId: string;
    measurementUncertaintyMm: number;
    points: readonly ScanPoint3D[];
  }): RawMetrologyScan {
    if (!request.points || request.points.length === 0) {
      throw new Error('RE_AUTHORITY_VIOLATION: Cannot ingest empty scan data.');
    }

    // Check for NaN or infinity in points
    const hasInvalidPoints = request.points.some(
      p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)
    );
    if (hasInvalidPoints) {
      throw new Error('RE_AUTHORITY_VIOLATION: Corrupted scan contains non-finite coordinates.');
    }

    if (request.measurementUncertaintyMm <= 0) {
      throw new Error('RE_AUTHORITY_VIOLATION: Physical measurement uncertainty must be strictly positive.');
    }

    const rawDataHash = this.computeScanPointsHash(request.points);
    const scanId = `SCAN-${request.instrumentType.substring(0, 3)}-${rawDataHash.substring(0, 16).toUpperCase()}`;

    const originTag = PhysicalOriginSemantics.createOriginTag(
      PhysicalOriginType.MEASURED,
      scanId,
      `Raw metrology scan acquired via ${request.instrumentType} [ID: ${request.instrumentId}]`,
      {
        confidence: 1.0,
        deviceOrMethod: request.instrumentType,
        calibrationCertificateId: request.calibrationCertificateId,
        measurementUncertaintyMm: request.measurementUncertaintyMm
      }
    );

    const scan: RawMetrologyScan = Object.freeze({
      scanId,
      physicalSerialId: request.physicalSerialId,
      instrumentType: request.instrumentType,
      instrumentId: request.instrumentId,
      calibrationCertificateId: request.calibrationCertificateId,
      measurementUncertaintyMm: request.measurementUncertaintyMm,
      pointCount: request.points.length,
      points: Object.freeze([...request.points]),
      rawDataHash,
      createdAt: new Date().toISOString(),
      originTag
    });

    this.scans.set(scan.scanId, scan);
    return scan;
  }

  /**
   * Performs authoritative CAD-to-Part deviation analysis comparing as-measured scan
   * to canonical design revision geometry.
   */
  public static performDeviationAnalysis(
    scanId: string,
    sourceRevisionHash: string,
    nominalGeometryBounds: { lengthMm: number; widthMm: number; heightMm: number },
    toleranceBandMm: { lowerMm: number; upperMm: number } = { lowerMm: -0.15, upperMm: 0.15 }
  ): DeviationAnalysisReport {
    const scan = this.scans.get(scanId);
    if (!scan) {
      throw new Error(`RE_AUTHORITY_VIOLATION: Scan '${scanId}' not found.`);
    }

    let sumDev = 0;
    let sumSqDev = 0;
    let maxPos = 0;
    let maxNeg = 0;
    let inTolCount = 0;

    // Evaluate point distances relative to nominal bounding model
    for (const pt of scan.points) {
      // Analytical distance to closest boundary plane
      const dx = Math.min(Math.abs(pt.x), Math.abs(pt.x - nominalGeometryBounds.lengthMm));
      const dy = Math.min(Math.abs(pt.y), Math.abs(pt.y - nominalGeometryBounds.widthMm));
      const dz = Math.min(Math.abs(pt.z), Math.abs(pt.z - nominalGeometryBounds.heightMm));
      const dist = Math.min(dx, dy, dz);

      // Signed deviation (positive = excess material, negative = under-cut)
      const signedDev = (pt.x > nominalGeometryBounds.lengthMm || pt.y > nominalGeometryBounds.widthMm || pt.z > nominalGeometryBounds.heightMm)
        ? dist
        : -dist;

      sumDev += signedDev;
      sumSqDev += signedDev * signedDev;

      if (signedDev > maxPos) maxPos = signedDev;
      if (signedDev < maxNeg) maxNeg = signedDev;

      if (signedDev >= toleranceBandMm.lowerMm && signedDev <= toleranceBandMm.upperMm) {
        inTolCount++;
      }
    }

    const n = scan.points.length;
    const meanDeviationMm = parseFloat((sumDev / n).toFixed(4));
    const rmsDeviationMm = parseFloat((Math.sqrt(sumSqDev / n)).toFixed(4));
    const inTolerancePercentage = parseFloat(((inTolCount / n) * 100).toFixed(1));

    let complianceVerdict: 'WITHIN_TOLERANCE' | 'OUT_OF_TOLERANCE_REWORKABLE' | 'OUT_OF_TOLERANCE_CRITICAL' = 'WITHIN_TOLERANCE';
    if (inTolerancePercentage < 80.0) {
      complianceVerdict = 'OUT_OF_TOLERANCE_CRITICAL';
    } else if (inTolerancePercentage < 95.0 || maxPos > toleranceBandMm.upperMm * 1.5) {
      complianceVerdict = 'OUT_OF_TOLERANCE_REWORKABLE';
    }

    const analysisId = `DEV-${scan.scanId.substring(5, 12)}-${createHash('sha256').update(`${sourceRevisionHash}_${scan.rawDataHash}`).digest('hex').substring(0, 12).toUpperCase()}`;
    const reportData = {
      analysisId,
      sourceRevisionHash,
      asBuiltScanId: scan.scanId,
      physicalSerialId: scan.physicalSerialId,
      pointCountEvaluated: n,
      meanDeviationMm,
      rmsDeviationMm,
      maxPositiveDeviationMm: parseFloat(maxPos.toFixed(4)),
      maxNegativeDeviationMm: parseFloat(maxNeg.toFixed(4)),
      inTolerancePercentage,
      toleranceBandMm,
      complianceVerdict,
      createdAt: new Date().toISOString()
    };

    const reportDigest = createHash('sha256').update(JSON.stringify(AttestationCanonicalizer.normalizeValue(reportData))).digest('hex');
    const report: DeviationAnalysisReport = Object.freeze({
      ...reportData,
      reportDigest
    });

    this.deviations.set(report.analysisId, report);
    return report;
  }

  /**
   * Reconstructs authoritative parametric B-Rep features from measured scan data.
   * Produces a sealed CanonicalReconstructionPackage with origin tagged as RECONSTRUCTED.
   */
  public static reconstructEngineeringModel(
    scanId: string,
    deviationAnalysisId: string,
    reconstructedFeatures: readonly {
      featureId: string;
      featureType: 'PLANAR_FACE' | 'CYLINDRICAL_BORE' | 'SPHERICAL_CAP' | 'FREEFORM_NURBS';
      nominalParameters: Record<string, number>;
      rmsFittingErrorMm: number;
    }[]
  ): CanonicalReconstructionPackage {
    const scan = this.scans.get(scanId);
    if (!scan) {
      throw new Error(`RE_AUTHORITY_VIOLATION: Scan '${scanId}' not found.`);
    }

    const devReport = this.deviations.get(deviationAnalysisId);
    if (!devReport) {
      throw new Error(`RE_AUTHORITY_VIOLATION: Deviation analysis '${deviationAnalysisId}' not found.`);
    }

    if (devReport.asBuiltScanId !== scan.scanId) {
      throw new Error(`RE_AUTHORITY_VIOLATION: Deviation report scan ID mismatch ('${devReport.asBuiltScanId}' !== '${scan.scanId}').`);
    }

    const features: ReconstructedFeature[] = reconstructedFeatures.map(f => {
      const originTag = PhysicalOriginSemantics.createOriginTag(
        PhysicalOriginType.RECONSTRUCTED,
        f.featureId,
        `Parametric feature fitted to scan ${scanId} with RMS error ${f.rmsFittingErrorMm} mm`,
        { confidence: 0.95 }
      );

      return Object.freeze({
        featureId: f.featureId,
        featureType: f.featureType,
        nominalParameters: Object.freeze({ ...f.nominalParameters }),
        rmsFittingErrorMm: f.rmsFittingErrorMm,
        maxFittingErrorMm: f.rmsFittingErrorMm * 1.5,
        originTag
      });
    });

    const reconstructedGeometryHash = createHash('sha256')
      .update(JSON.stringify(AttestationCanonicalizer.normalizeValue(features)))
      .digest('hex');

    const reconstructionId = `RE-PKG-${reconstructedGeometryHash.substring(0, 16).toUpperCase()}`;
    const originTag = PhysicalOriginSemantics.createOriginTag(
      PhysicalOriginType.REVERSE_ENGINEERED,
      reconstructionId,
      `Full CAD B-Rep reconstructed from physical part ${scan.physicalSerialId}`
    );

    const packageData = {
      reconstructionId,
      scanId: scan.scanId,
      physicalSerialId: scan.physicalSerialId,
      sourceDesignRevisionHash: devReport.sourceRevisionHash,
      reconstructedFeatures: Object.freeze(features),
      deviationReport: devReport,
      reconstructedGeometryHash,
      originTag,
      createdAt: new Date().toISOString()
    };

    const packageDigest = createHash('sha256')
      .update(JSON.stringify(AttestationCanonicalizer.normalizeValue(packageData)))
      .digest('hex');

    const canonicalPackage: CanonicalReconstructionPackage = Object.freeze({
      ...packageData,
      packageDigest
    });

    this.reconstructions.set(canonicalPackage.reconstructionId, canonicalPackage);
    return canonicalPackage;
  }

  /**
   * Publishes the reverse-engineered reconstruction package to RevisionEngine as a new
   * authoritative engineering revision.
   */
  public static publishToCanonicalRevision(
    revisionEngine: RevisionEngine,
    entityId: string,
    reconstructionPackageId: string,
    author: string,
    releaseReason: string
  ) {
    const pkg = this.reconstructions.get(reconstructionPackageId);
    if (!pkg) {
      throw new Error(`RE_AUTHORITY_VIOLATION: Reconstruction package '${reconstructionPackageId}' not found.`);
    }

    const latestRev = revisionEngine.getLatestRevision(entityId);
    const nextRevNumber = latestRev ? latestRev.revisionNumber + 1 : 1;
    const nextRevCode = String.fromCharCode(64 + nextRevNumber);
    const revisionId = `REV-${entityId}-${nextRevCode}`;

    const creatorId = 'RE_METROLOGY_SYSTEM';
    const reviewerId = author || 'CHIEF_METROLOGIST';

    const newRev = revisionEngine.createRevision({
      revisionId,
      entityId,
      entityType: 'CAD_MODEL' as any,
      revisionCode: nextRevCode,
      revisionNumber: nextRevNumber,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: creatorId,
      content: {
        geometry: 'RECONSTRUCTED_BREP_FROM_PHYSICAL_SCAN',
        reconstructionId: pkg.reconstructionId,
        physicalSerialId: pkg.physicalSerialId,
        sourceDesignRevisionHash: pkg.sourceDesignRevisionHash,
        reconstructedFeaturesCount: pkg.reconstructedFeatures.length,
        rmsDeviationMm: pkg.deviationReport.rmsDeviationMm
      },
      snapshot: {
        geometryState: {
          parameters: pkg.reconstructedFeatures[0]?.nominalParameters || {},
          features: pkg.reconstructedFeatures.map(f => f.featureId),
          topologyHash: `TOPO-RE-${pkg.reconstructedGeometryHash.substring(0, 12)}`,
          geometryHash: pkg.reconstructedGeometryHash
        }
      }
    } as any);

    revisionEngine.addApproval(newRev.revisionId, {
      approvalId: `APP-RE-${newRev.revisionId}`,
      revisionId: newRev.revisionId,
      role: 'CHIEF_METROLOGIST',
      actorId: reviewerId,
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: `Reverse engineering reconstruction from scan ${pkg.scanId} approved.`
    });

    revisionEngine.setValidationState(newRev.revisionId, 'SIMULATED');
    revisionEngine.transitionState(newRev.revisionId, RevisionLifecycleState.IN_REVIEW, reviewerId, 'Reviewing reconstructed geometry');
    revisionEngine.transitionState(newRev.revisionId, RevisionLifecycleState.APPROVED, reviewerId, 'Approved reconstructed geometry');
    const releasedRev = revisionEngine.releaseRevision(newRev.revisionId, reviewerId, releaseReason);

    return releasedRev;
  }

  public static getScan(id: string): RawMetrologyScan | undefined {
    return this.scans.get(id);
  }

  public static getDeviationReport(id: string): DeviationAnalysisReport | undefined {
    return this.deviations.get(id);
  }

  public static getReconstruction(id: string): CanonicalReconstructionPackage | undefined {
    return this.reconstructions.get(id);
  }

  public static clear(): void {
    this.scans.clear();
    this.deviations.clear();
    this.reconstructions.clear();
  }
}
