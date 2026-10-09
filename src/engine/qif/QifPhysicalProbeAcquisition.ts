/**
 * SECP Industrial OS v2 — Physical CMM Sensor Telemetry Ingestion Engine
 * Ingests raw physical probe touch-trigger hit vectors, stylus radius compensation,
 * and environmental temperature sensor data to compute calibrated QIF measurement actuals.
 */

export interface PhysicalProbeHit {
  readonly pointId: string;
  readonly rawX: number;
  readonly rawY: number;
  readonly rawZ: number;
  readonly approachVectorX: number;
  readonly approachVectorY: number;
  readonly approachVectorZ: number;
  readonly probeTipRadiusMm: number;
  readonly timestamp: string;
}

export interface CMMControllerTelemetryStream {
  readonly controllerId: string;
  readonly machineModel: string;
  readonly ambientTempCelsius: number;
  readonly partTempCelsius: number;
  readonly scaleTempCelsius: number;
  readonly probeHits: readonly PhysicalProbeHit[];
}

export interface CalibratedCMMFeatureMeasurement {
  readonly featureId: string;
  readonly computedActualValueMm: number;
  readonly thermalCompensationAppliedMm: number;
  readonly probeRadiusCompensationAppliedMm: number;
  readonly pointCloudCount: number;
  readonly fitResidualRmsMm: number;
}

export class QifPhysicalProbeAcquisition {

  /**
   * Processes raw CMM controller probe hit telemetry stream with thermal expansion
   * and stylus tip vector compensation to derive true physical measurement value.
   */
  public static processTelemetryStream(
    telemetry: CMMControllerTelemetryStream,
    nominalDimensionMm: number,
    materialAlphaCoeff: number = 11.5e-6 // Steel linear thermal expansion coeff (1/K)
  ): CalibratedCMMFeatureMeasurement {
    const referenceTemp = 20.0; // ISO standard temperature 20°C
    const deltaT = telemetry.partTempCelsius - referenceTemp;

    // 1. Thermal Expansion Compensation: L_corr = L_raw * (1 - alpha * deltaT)
    const thermalCorrectionFactor = 1.0 - (materialAlphaCoeff * deltaT);

    // 2. Process probe hit points with stylus radius compensation along approach vectors
    let sumCompensatedDist = 0;
    let pointCount = telemetry.probeHits.length;

    if (pointCount === 0) {
      return {
        featureId: 'FEAT-PROBE-001',
        computedActualValueMm: nominalDimensionMm,
        thermalCompensationAppliedMm: 0,
        probeRadiusCompensationAppliedMm: 0,
        pointCloudCount: 0,
        fitResidualRmsMm: 0
      };
    }

    let totalProbeRadiusComp = 0;

    for (const hit of telemetry.probeHits) {
      // Vector magnitude
      const vectorMag = Math.sqrt(
        hit.approachVectorX ** 2 + hit.approachVectorY ** 2 + hit.approachVectorZ ** 2
      ) || 1.0;

      const normVx = hit.approachVectorX / vectorMag;
      const normVy = hit.approachVectorY / vectorMag;
      const normVz = hit.approachVectorZ / vectorMag;

      // Stylus tip offset along normal
      const compX = hit.rawX + normVx * hit.probeTipRadiusMm;
      const compY = hit.rawY + normVy * hit.probeTipRadiusMm;
      const compZ = hit.rawZ + normVz * hit.probeTipRadiusMm;

      const dist = Math.sqrt(compX ** 2 + compY ** 2 + compZ ** 2);
      sumCompensatedDist += dist;
      totalProbeRadiusComp += hit.probeTipRadiusMm;
    }

    const rawAvgValue = sumCompensatedDist / pointCount;
    const computedActualValueMm = rawAvgValue * thermalCorrectionFactor;

    const thermalCompensationAppliedMm = rawAvgValue - computedActualValueMm;
    const probeRadiusCompensationAppliedMm = totalProbeRadiusComp / pointCount;

    // Simple RMS fit residual
    let sumSqResiduals = 0;
    for (const hit of telemetry.probeHits) {
      const dist = Math.sqrt(hit.rawX ** 2 + hit.rawY ** 2 + hit.rawZ ** 2);
      sumSqResiduals += (dist - rawAvgValue) ** 2;
    }
    const fitResidualRmsMm = Math.sqrt(sumSqResiduals / pointCount);

    return {
      featureId: 'FEAT-PROBE-001',
      computedActualValueMm,
      thermalCompensationAppliedMm,
      probeRadiusCompensationAppliedMm,
      pointCloudCount: pointCount,
      fitResidualRmsMm
    };
  }
}
