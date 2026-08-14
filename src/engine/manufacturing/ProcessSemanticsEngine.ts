import { 
  RecognizedManufacturingFeature, 
  ManufacturingProcessPlan, 
  ManufacturingOperation, 
  ProcessType, 
  Vector3D,
  ManufacturingFeatureType
} from './ManufacturingTypes';

/**
 * PATCH-SECP-049-B — Process Semantics & Planning Engine
 * Synthesizes process operations, tool selections, setup orientations, and time estimates
 * for recognized manufacturing features.
 */
export class ProcessSemanticsEngine {

  public static generateProcessPlan(
    features: RecognizedManufacturingFeature[],
    preferredProcess: ProcessType = ProcessType.MILLING_3AXIS
  ): ManufacturingProcessPlan {
    const operations: ManufacturingOperation[] = [];
    const setupSet = new Set<string>();
    let totalTime = 0;
    let isPlanFeasible = true;

    for (const feat of features) {
      const op = this.synthesizeOperation(feat, preferredProcess);
      operations.push(op);
      totalTime += op.estimatedTimeSec;

      const setupKey = `${op.setupOrientation.x},${op.setupOrientation.y},${op.setupOrientation.z}`;
      setupSet.add(setupKey);

      // If 3-axis milling is requested but feature requires multi-axis undercut or non-orthogonal vector
      if (preferredProcess === ProcessType.MILLING_3AXIS && feat.type === ManufacturingFeatureType.UNDERCUT) {
        isPlanFeasible = false;
      }
    }

    const setupDirections: Vector3D[] = Array.from(setupSet).map(s => {
      const [x, y, z] = s.split(',').map(Number);
      return { x, y, z };
    });

    return {
      planId: `plan-${Date.now()}`,
      targetProcess: preferredProcess,
      operations,
      setupDirections,
      isFeasible: isPlanFeasible,
      totalEstimatedTimeSec: totalTime
    };
  }

  private static synthesizeOperation(
    feat: RecognizedManufacturingFeature,
    preferredProcess: ProcessType
  ): ManufacturingOperation {
    const access = feat.primaryAccessDirection;
    let toolType = 'EndMill';
    let toolDiameter = 10;
    let estimatedTime = 60;

    switch (feat.type) {
      case ManufacturingFeatureType.HOLE:
        toolType = 'DrillBit';
        toolDiameter = feat.geometricParams.diameter || 8.0;
        estimatedTime = 15 + (feat.geometricParams.depth || 20) * 0.5;
        break;

      case ManufacturingFeatureType.POCKET:
        toolType = 'FlatEndMill';
        const w = feat.geometricParams.width || 20;
        const cornerR = feat.geometricParams.cornerRadius || 0;
        toolDiameter = cornerR > 0 ? cornerR * 2 : Math.min(w * 0.5, 12);
        estimatedTime = 120 + (feat.geometricParams.depth || 10) * 5;
        break;

      case ManufacturingFeatureType.THIN_WALL:
        toolType = 'HighHelixEndMill';
        toolDiameter = 6;
        estimatedTime = 90;
        break;

      case ManufacturingFeatureType.UNDERCUT:
        toolType = 'LollipopCutter';
        toolDiameter = 8;
        estimatedTime = 180;
        break;

      case ManufacturingFeatureType.FILLET:
        toolType = 'BallEndMill';
        toolDiameter = (feat.geometricParams.cornerRadius || 2) * 2;
        estimatedTime = 45;
        break;

      default:
        toolType = 'FaceMill';
        toolDiameter = 25;
        estimatedTime = 30;
        break;
    }

    return {
      operationId: `op-${feat.mfgFeatureId}`,
      processType: feat.suitableProcesses.includes(preferredProcess) ? preferredProcess : feat.suitableProcesses[0],
      mfgFeatureId: feat.mfgFeatureId,
      toolType,
      toolDiameterMm: toolDiameter,
      requiredReachMm: feat.geometricParams.depth || 20,
      setupOrientation: access,
      estimatedTimeSec: estimatedTime
    };
  }
}
