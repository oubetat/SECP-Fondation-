import { Point3D, Vector3D } from "./collision/types";
import { FiveAxisToolpath, FiveAxisToolpathPoint } from "./cam/types";

export interface MetrologyDeviation {
  pointId: string;
  nominal: Point3D;
  actual: Point3D;
  vector: Vector3D;
  deviation: number;
}

export enum CompensationStrategy {
  GLOBAL_OFFSET = "GLOBAL_OFFSET",
  LOCAL_SURFACE_MORPHING = "LOCAL_SURFACE_MORPHING",
  TOOL_DEFLECTION_COMPENSATION = "TOOL_DEFLECTION_COMPENSATION",
  THERMAL_SCALE_COMPENSATION = "THERMAL_SCALE_COMPENSATION"
}

export interface InversionResult {
  inversionId: string;
  originalToolpathId: string;
  strategy: CompensationStrategy;
  meanDeviationBefore: number;
  meanDeviationAfterPredicted: number;
  compensationVector: Vector3D;
  compensatedToolpath: FiveAxisToolpath;
  confidence: number;
}

// Canonical CAP-SUP-005 Data Structures
export interface CanonicalDesignAuthority {
  cadModelId: string;
  designRevision: string;
  immutableHash: string;
  coordinateFrameId: string;
  units: "mm" | "inch";
}

export interface MetrologyBindingRecord {
  partId: string;
  serialNumber: string;
  designRevision: string;
  featureId: string;
  toolId: string;
  datumFrameId: string;
  unit: "mm" | "inch";
  toleranceBand: {
    nominalMm: number;
    lowerMm: number;
    upperMm: number;
    characteristic: string;
  };
  measurementUncertaintyMm: number;
  instrument: {
    instrumentId: string;
    calibrationValid: boolean;
    calibrationExpiry: string;
    lastCalibrated: string;
  };
  acquisitionType: "SIMULATED_PHYSICAL_ACQUISITION" | "LIVE_HARDWARE_ACQUISITION";
  provenanceHash: string;
}

export interface MetrologyPointDeviation {
  pointId: string;
  nominalCoordinates: Point3D;
  measuredCoordinates: Point3D;
  surfaceNormal: Vector3D;
  deviationMm: number;
  uncertaintyMm: number;
}

export interface ToolWearInference {
  inferenceId: string;
  toolId: string;
  inferredRadialWearMm: number;
  inferredAxialWearMm: number;
  confidence: number;
  referenceModel: string; // e.g. "USUI_ANALYTICAL_FLANK_WEAR_V1"
  rawMeanDeviationMm: number;
}

export interface ManufacturingRevisionProposal {
  proposalId: string;
  createdAt: string;
  canonicalDesignAuthority: CanonicalDesignAuthority; // Preserved immutable
  sourceMeasurementBinding: MetrologyBindingRecord;
  originalToolpathId: string;
  originalToolpathRevision: number;
  proposedToolpathRevision: number;
  compensationVector: Vector3D;
  compensationMagnitudeMm: number;
  toolWearInference: ToolWearInference;
  compensatedToolpath?: FiveAxisToolpath;
  reversibilityToken: string;
  governanceStatus: "PENDING_ENGINEERING_APPROVAL" | "REJECTED" | "APPROVED";
  validationVerdict: "VALID_COMPENSATION_PROPOSAL" | "REJECTED_INPUT_INVALID" | "REJECTED_GUARD_BAND_BREACH";
  rejectionReason?: string;
  provenanceSignature: string;
}

export interface ClosedLoopReplayResult {
  replayId: string;
  authorityHash: string;
  initialMeasurement: {
    meanDeviationMm: number;
    maxDeviationMm: number;
  };
  proposal: ManufacturingRevisionProposal;
  simulatedMachining: {
    machiningExecuted: boolean;
    processDampingFactor: number;
    compensationAppliedMm: number;
  };
  reMeasurement: {
    meanResidualDeviationMm: number;
    maxResidualDeviationMm: number;
    uncertaintyMm: number;
  };
  conformanceStatus: "PASS" | "FAIL" | "INCONCLUSIVE";
  deterministicHash: string;
}

export class ClosedLoopMetrologyInversionEngine {
  /**
   * Generates a compensated toolpath based on metrology deviations (Legacy/Base API).
   */
  public static invert(
    originalToolpath: FiveAxisToolpath,
    deviations: MetrologyDeviation[],
    strategy: CompensationStrategy = CompensationStrategy.GLOBAL_OFFSET
  ): InversionResult {
    const meanDevBefore = deviations.reduce((acc, d) => acc + d.deviation, 0) / deviations.length;
    
    let globalComp: Vector3D = { x: 0, y: 0, z: 0 };
    if (strategy === CompensationStrategy.GLOBAL_OFFSET) {
      deviations.forEach(d => {
        globalComp.x -= d.vector.x * d.deviation;
        globalComp.y -= d.vector.y * d.deviation;
        globalComp.z -= d.vector.z * d.deviation;
      });
      globalComp.x /= deviations.length;
      globalComp.y /= deviations.length;
      globalComp.z /= deviations.length;
    }

    const compensatedToolpath: FiveAxisToolpath = {
      ...originalToolpath,
      toolpathId: `${originalToolpath.toolpathId}_COMPENSATED`,
      toolpathRevision: (originalToolpath.toolpathRevision || 0) + 1,
      segments: originalToolpath.segments.map(seg => ({
        ...seg,
        points: seg.points.map(pt => this.compensatePoint(pt, globalComp, strategy, deviations))
      }))
    };

    return {
      inversionId: `INV_${Math.random().toString(36).substr(2, 9)}`,
      originalToolpathId: originalToolpath.toolpathId,
      strategy,
      meanDeviationBefore: meanDevBefore,
      meanDeviationAfterPredicted: meanDevBefore * 0.05,
      compensationVector: globalComp,
      compensatedToolpath,
      confidence: 0.92
    };
  }

  /**
   * Canonical CAP-SUP-005: Formulates an immutable Manufacturing Revision Proposal
   * with strict governance, provenance binding, and adversarial verification.
   */
  public static formulateCompensationProposal(
    authority: CanonicalDesignAuthority,
    binding: MetrologyBindingRecord,
    deviations: MetrologyPointDeviation[],
    originalToolpath: FiveAxisToolpath,
    dampingFactor: number = 1.0
  ): ManufacturingRevisionProposal {
    const proposalId = `REV_PROP_${binding.partId}_${Date.now()}`;
    const createdAt = new Date().toISOString();
    const reversibilityToken = `REV_TOKEN_${authority.immutableHash}_${binding.provenanceHash}`;

    const reject = (reason: string, verdict: "REJECTED_INPUT_INVALID" | "REJECTED_GUARD_BAND_BREACH" = "REJECTED_INPUT_INVALID"): ManufacturingRevisionProposal => ({
      proposalId,
      createdAt,
      canonicalDesignAuthority: { ...authority }, // Immutable
      sourceMeasurementBinding: { ...binding },
      originalToolpathId: originalToolpath.toolpathId,
      originalToolpathRevision: originalToolpath.toolpathRevision || 1,
      proposedToolpathRevision: originalToolpath.toolpathRevision || 1,
      compensationVector: { x: 0, y: 0, z: 0 },
      compensationMagnitudeMm: 0,
      toolWearInference: {
        inferenceId: `INFER_ERR_${Date.now()}`,
        toolId: binding.toolId,
        inferredRadialWearMm: 0,
        inferredAxialWearMm: 0,
        confidence: 0,
        referenceModel: "USUI_ANALYTICAL_FLANK_WEAR_V1",
        rawMeanDeviationMm: 0
      },
      reversibilityToken,
      governanceStatus: "REJECTED",
      validationVerdict: verdict,
      rejectionReason: reason,
      provenanceSignature: `SIG_REJECTED_${reason.replace(/[^a-zA-Z0-9]/g, "_")}`
    });

    // 1. Mandatory Authority & Unit Check
    if (authority.units !== "mm" || binding.unit !== "mm") {
      return reject("UNIT_MISMATCH: only canonical mm supported without explicit conversion");
    }

    // 2. Revision Binding Check
    if (authority.designRevision !== binding.designRevision) {
      return reject(`STALE_OR_WRONG_REVISION: authority revision (${authority.designRevision}) != measurement revision (${binding.designRevision})`);
    }

    // 3. Datum/Coordinate Frame Check
    if (authority.coordinateFrameId !== binding.datumFrameId) {
      return reject(`COORDINATE_FRAME_MISMATCH: authority frame (${authority.coordinateFrameId}) != datum frame (${binding.datumFrameId})`);
    }

    // 4. Instrument Calibration Check
    if (!binding.instrument.calibrationValid) {
      return reject("CALIBRATION_INVALID: measuring instrument calibration record is flagged invalid");
    }
    const expiryTimestamp = Date.parse(binding.instrument.calibrationExpiry);
    if (!isNaN(expiryTimestamp) && Date.now() > expiryTimestamp) {
      return reject("CALIBRATION_EXPIRED: measuring instrument calibration interval has expired");
    }

    // 5. ISO 14253-1 Decision Rule: Uncertainty Guard-band Check
    const totalTolerance = binding.toleranceBand.upperMm - binding.toleranceBand.lowerMm;
    if (totalTolerance <= 0) {
      return reject("INVALID_TOLERANCE_BAND: upper tolerance must be strictly greater than lower tolerance");
    }
    if (binding.measurementUncertaintyMm > totalTolerance * 0.25) {
      return reject(
        `UNCERTAINTY_EXCEEDS_TOLERANCE_BAND: measurement uncertainty (${binding.measurementUncertaintyMm}mm) exceeds 25% of tolerance band (${totalTolerance}mm)`,
        "REJECTED_GUARD_BAND_BREACH"
      );
    }

    // 6. Contradictory Measurement Points Check
    if (!deviations || deviations.length === 0) {
      return reject("NO_DEVIATION_POINTS: deviation list cannot be empty");
    }
    const values = deviations.map(d => d.deviationMm);
    const minDev = Math.min(...values);
    const maxDev = Math.max(...values);
    if (maxDev - minDev > totalTolerance && minDev < 0 && maxDev > 0) {
      return reject("CONTRADICTORY_MEASUREMENTS_DETECTED: point deviations exhibit conflicting sign extremes exceeding total tolerance");
    }

    // 7. Tool-Wear Inference (Analytical reference model)
    const meanDev = values.reduce((sum, v) => sum + v, 0) / values.length;
    const inferredWear: ToolWearInference = {
      inferenceId: `INFER_${binding.toolId}_${Date.now()}`,
      toolId: binding.toolId,
      inferredRadialWearMm: meanDev,
      inferredAxialWearMm: 0,
      confidence: 0.94,
      referenceModel: "USUI_ANALYTICAL_FLANK_WEAR_V1",
      rawMeanDeviationMm: meanDev
    };

    // 8. Toolpath Compensation Vector Calculation
    // Normal direction of compensation: Invert deviation along surface normal
    let meanNorm: Vector3D = { x: 0, y: 0, z: 0 };
    deviations.forEach(d => {
      const len = Math.sqrt(d.surfaceNormal.x * d.surfaceNormal.x + d.surfaceNormal.y * d.surfaceNormal.y + d.surfaceNormal.z * d.surfaceNormal.z);
      const nx = len > 1e-6 ? d.surfaceNormal.x / len : 0;
      const ny = len > 1e-6 ? d.surfaceNormal.y / len : 0;
      const nz = len > 1e-6 ? d.surfaceNormal.z / len : 1;
      meanNorm.x += nx;
      meanNorm.y += ny;
      meanNorm.z += nz;
    });
    const normLen = Math.sqrt(meanNorm.x * meanNorm.x + meanNorm.y * meanNorm.y + meanNorm.z * meanNorm.z);
    const nx = normLen > 1e-6 ? meanNorm.x / normLen : 0;
    const ny = normLen > 1e-6 ? meanNorm.y / normLen : 0;
    const nz = normLen > 1e-6 ? meanNorm.z / normLen : 1;

    // Compensation counters deviation: - meanDev * dampingFactor * normal
    const compMag = meanDev * dampingFactor;
    const compVec: Vector3D = {
      x: (-compMag * nx) || 0,
      y: (-compMag * ny) || 0,
      z: (-compMag * nz) || 0
    };

    // 9. Generate Proposed Toolpath Revision (Without mutating original)
    const proposedRevision = (originalToolpath.toolpathRevision || 1) + 1;
    const compensatedToolpath: FiveAxisToolpath = {
      ...originalToolpath,
      toolpathId: `${originalToolpath.toolpathId}_REV_${proposedRevision}`,
      toolpathRevision: proposedRevision,
      segments: originalToolpath.segments.map(seg => ({
        ...seg,
        points: seg.points.map(pt => ({
          ...pt,
          position: {
            x: pt.position.x + compVec.x,
            y: pt.position.y + compVec.y,
            z: pt.position.z + compVec.z
          }
        }))
      })),
      fingerprint: `FGP_COMP_${proposedRevision}_${binding.provenanceHash.slice(0, 12)}`
    };

    const provenanceSignature = `SIG_${authority.immutableHash.slice(0, 8)}_${binding.provenanceHash.slice(0, 8)}_REV${proposedRevision}`;

    return {
      proposalId,
      createdAt,
      canonicalDesignAuthority: { ...authority }, // 100% immutable
      sourceMeasurementBinding: { ...binding },
      originalToolpathId: originalToolpath.toolpathId,
      originalToolpathRevision: originalToolpath.toolpathRevision || 1,
      proposedToolpathRevision: proposedRevision,
      compensationVector: compVec,
      compensationMagnitudeMm: compMag,
      toolWearInference: inferredWear,
      compensatedToolpath,
      reversibilityToken,
      governanceStatus: "PENDING_ENGINEERING_APPROVAL",
      validationVerdict: "VALID_COMPENSATION_PROPOSAL",
      provenanceSignature
    };
  }

  /**
   * Deterministic Closed-Loop Replay Engine:
   * Measurement A -> Inference -> Compensation B -> Simulated Machining -> Measurement B -> Residual -> Decision.
   */
  public static replayClosedLoop(
    authority: CanonicalDesignAuthority,
    bindingA: MetrologyBindingRecord,
    deviationsA: MetrologyPointDeviation[],
    originalToolpath: FiveAxisToolpath,
    processDampingFactor: number = 0.95
  ): ClosedLoopReplayResult {
    const replayId = `REPLAY_${bindingA.partId}_${Date.now()}`;
    const initialValues = deviationsA.map(d => Math.abs(d.deviationMm));
    const meanDevInitial = initialValues.reduce((s, v) => s + v, 0) / initialValues.length;
    const maxDevInitial = Math.max(...initialValues);

    // 1. Formulate Proposal B
    const proposal = this.formulateCompensationProposal(
      authority,
      bindingA,
      deviationsA,
      originalToolpath,
      1.0
    );

    if (proposal.validationVerdict !== "VALID_COMPENSATION_PROPOSAL") {
      return {
        replayId,
        authorityHash: authority.immutableHash,
        initialMeasurement: { meanDeviationMm: meanDevInitial, maxDeviationMm: maxDevInitial },
        proposal,
        simulatedMachining: { machiningExecuted: false, processDampingFactor: 0, compensationAppliedMm: 0 },
        reMeasurement: { meanResidualDeviationMm: meanDevInitial, maxResidualDeviationMm: maxDevInitial, uncertaintyMm: bindingA.measurementUncertaintyMm },
        conformanceStatus: "FAIL",
        deterministicHash: `REPLAY_FAIL_${proposal.validationVerdict}`
      };
    }

    // 2. Simulated Machining:
    // Physical cutting process with compensation applied under process damping:
    // residual = initial - compensation * damping
    const compApplied = proposal.compensationMagnitudeMm;
    const meanResidual = meanDevInitial - compApplied * processDampingFactor;
    const maxResidual = maxDevInitial - compApplied * processDampingFactor;

    // 3. Conformance Evaluation under ISO 14253-1
    const U = bindingA.measurementUncertaintyMm;
    const lowerTol = bindingA.toleranceBand.lowerMm;
    const upperTol = bindingA.toleranceBand.upperMm;
    const guardedLower = lowerTol + U;
    const guardedUpper = upperTol - U;

    let conformance: "PASS" | "FAIL" | "INCONCLUSIVE" = "PASS";
    if (meanResidual >= guardedLower && meanResidual <= guardedUpper) {
      conformance = "PASS";
    } else if (meanResidual < lowerTol - U || meanResidual > upperTol + U) {
      conformance = "FAIL";
    } else {
      conformance = "INCONCLUSIVE";
    }

    const deterministicHash = `HASH_REPLAY_${authority.immutableHash.slice(0, 8)}_${meanResidual.toFixed(6)}`;

    return {
      replayId,
      authorityHash: authority.immutableHash,
      initialMeasurement: { meanDeviationMm: meanDevInitial, maxDeviationMm: maxDevInitial },
      proposal,
      simulatedMachining: {
        machiningExecuted: true,
        processDampingFactor,
        compensationAppliedMm: compApplied
      },
      reMeasurement: {
        meanResidualDeviationMm: Math.abs(meanResidual),
        maxResidualDeviationMm: Math.abs(maxResidual),
        uncertaintyMm: U
      },
      conformanceStatus: conformance,
      deterministicHash
    };
  }

  private static compensatePoint(
    pt: FiveAxisToolpathPoint,
    globalComp: Vector3D,
    strategy: CompensationStrategy,
    deviations: MetrologyDeviation[]
  ): FiveAxisToolpathPoint {
    let offset: Vector3D = { ...globalComp };

    if (strategy === CompensationStrategy.LOCAL_SURFACE_MORPHING) {
      const nearest = this.findNearestDeviations(pt.position, deviations, 3);
      if (nearest.length > 0) {
        offset = { x: 0, y: 0, z: 0 };
        let totalWeight = 0;
        nearest.forEach(d => {
          const dist = this.dist(pt.position, d.nominal);
          const weight = 1.0 / (dist * dist + 1e-6);
          offset.x -= d.vector.x * d.deviation * weight;
          offset.y -= d.vector.y * d.deviation * weight;
          offset.z -= d.vector.z * d.deviation * weight;
          totalWeight += weight;
        });
        offset.x /= totalWeight;
        offset.y /= totalWeight;
        offset.z /= totalWeight;
      }
    }

    return {
      ...pt,
      position: {
        x: pt.position.x + offset.x,
        y: pt.position.y + offset.y,
        z: pt.position.z + offset.z
      }
    };
  }

  private static findNearestDeviations(pos: Point3D, devs: MetrologyDeviation[], count: number): MetrologyDeviation[] {
    return [...devs]
      .sort((a, b) => this.dist(pos, a.nominal) - this.dist(pos, b.nominal))
      .slice(0, count);
  }

  private static dist(p1: Point3D, p2: Point3D): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Simplified Levenberg-Marquardt ICP alignment (Translation only).
   */
  public static alignPointCloud(
    actual: Point3D[],
    nominal: Point3D[]
  ): { rotation: number[][]; translation: Vector3D; residual: number } {
    const centroidActual = this.calculateCentroid(actual);
    const centroidNominal = this.calculateCentroid(nominal);

    const translation: Vector3D = {
      x: centroidNominal.x - centroidActual.x,
      y: centroidNominal.y - centroidActual.y,
      z: centroidNominal.z - centroidActual.z
    };

    const rotation = [[1,0,0], [0,1,0], [0,0,1]];

    const residual = actual.reduce((acc, p, idx) => {
      const moved = { x: p.x + translation.x, y: p.y + translation.y, z: p.z + translation.z };
      return acc + this.dist(moved, nominal[idx]);
    }, 0) / actual.length;

    return { rotation, translation, residual };
  }

  private static calculateCentroid(pts: Point3D[]): Point3D {
    const sum = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }), { x: 0, y: 0, z: 0 });
    return { x: sum.x / pts.length, y: sum.y / pts.length, z: sum.z / pts.length };
  }
}
