// SECP Industrial OS v2 — Canonical Inspection Serializer
import * as crypto from 'crypto';
import {
  InspectionRequirement,
  InspectionPlan,
  MeasurementDevice,
  CalibrationRecord,
  MeasurementRecord,
  ToleranceEvaluation,
  InspectionState
} from './types';

export class CanonicalInspectionSerializer {
  public static sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  public static canonicalizeRequirement(req: InspectionRequirement): string {
    return JSON.stringify({
      criticality: req.criticality,
      datumReference: [...req.datumReference].sort(),
      featureId: req.featureId.trim(),
      lowerLimit: Number(req.lowerLimit.toFixed(6)),
      measurementMethod: req.measurementMethod.trim(),
      nominal: Number(req.nominal.toFixed(6)),
      requirementId: req.requirementId.trim(),
      requirementType: req.requirementType,
      requiredAccuracy: Number(req.requiredAccuracy.toFixed(6)),
      sourceReference: req.sourceReference.trim(),
      toleranceType: req.toleranceType,
      uncertaintyLimit: Number(req.uncertaintyLimit.toFixed(6)),
      upperLimit: Number(req.upperLimit.toFixed(6))
    });
  }

  public static canonicalizeInspectionPlan(plan: InspectionPlan): string {
    const sortedReqs = [...plan.requirements].sort((a, b) => a.requirementId.localeCompare(b.requirementId));
    return JSON.stringify({
      inspectionPlanId: plan.inspectionPlanId.trim(),
      measurementDevices: [...plan.measurementDevices].sort(),
      measurementMethods: [...plan.measurementMethods].sort(),
      partDefinition: plan.partDefinition.trim(),
      requirements: sortedReqs.map(r => this.canonicalizeRequirement(r)),
      revision: plan.revision.trim(),
      samplingPolicy: plan.samplingPolicy.trim()
    });
  }

  public static canonicalizeMeasurementDevice(device: MeasurementDevice): string {
    return JSON.stringify({
      accuracy: Number(device.accuracy.toFixed(6)),
      deviceId: device.deviceId.trim(),
      deviceType: device.deviceType.trim(),
      firmwareVersion: device.firmwareVersion.trim(),
      manufacturer: device.manufacturer.trim(),
      model: device.model.trim(),
      resolution: Number(device.resolution.toFixed(6)),
      serialNumber: device.serialNumber.trim(),
      softwareVersion: device.softwareVersion.trim()
    });
  }

  public static canonicalizeCalibrationRecord(cal: CalibrationRecord): string {
    return JSON.stringify({
      calibrationDate: cal.calibrationDate.trim(),
      calibrationId: cal.calibrationId.trim(),
      calibrationStandard: cal.calibrationStandard.trim(),
      certificateId: cal.certificateId.trim(),
      deviceId: cal.deviceId.trim(),
      expiryDate: cal.expiryDate.trim(),
      status: cal.status,
      uncertainty: Number(cal.uncertainty.toFixed(6))
    });
  }

  public static canonicalizeMeasurementRecord(measurement: MeasurementRecord): string {
    return JSON.stringify({
      calibrationId: measurement.calibrationId.trim(),
      deviceId: measurement.deviceId.trim(),
      featureId: measurement.featureId.trim(),
      inspectionTwinId: measurement.inspectionTwinId.trim(),
      measuredValue: Number(measurement.measuredValue.toFixed(6)),
      measurementId: measurement.measurementId.trim(),
      methodId: measurement.methodId.trim(),
      nominalValue: Number(measurement.nominalValue.toFixed(6)),
      operatorId: measurement.operatorId.trim(),
      processedDataHash: measurement.processedDataHash.trim(),
      rawDataHash: measurement.rawDataHash.trim(),
      requirementId: measurement.requirementId.trim(),
      timestamp: measurement.timestamp.trim(),
      uncertainty: Number(measurement.uncertainty.toFixed(6)),
      unit: measurement.unit.trim()
    });
  }

  public static canonicalizeMeasurements(measurements: MeasurementRecord[]): string {
    const sorted = [...measurements].sort((a, b) => a.measurementId.localeCompare(b.measurementId));
    return JSON.stringify(sorted.map(m => this.canonicalizeMeasurementRecord(m)));
  }

  public static computeInspectionInputHash(state: InspectionState): string {
    const geomStr = `${state.designRevision}:${state.geometryRevision}:${state.requirementRevision}`;
    const planStr = this.canonicalizeInspectionPlan(state.inspectionPlan);
    const deviceStr = this.canonicalizeMeasurementDevice(state.measurementDevice);
    const calStr = this.canonicalizeCalibrationRecord(state.calibrationRecord);
    const measStr = this.canonicalizeMeasurements(state.measurements);
    
    return this.sha256([state.partIdentityHash, geomStr, planStr, deviceStr, calStr, measStr].join('|INSP_INPUT|'));
  }

  public static computeInspectionRootHash(hashes: {
    inputHash: string;
    evaluationsHash: string;
    verdict: string;
    evidenceHash: string;
  }): string {
    return this.sha256([
      hashes.inputHash,
      hashes.evaluationsHash,
      hashes.verdict,
      hashes.evidenceHash
    ].join('|INSP_ROOT|'));
  }
}
