import { 
  Toolpath, 
  ToolpathValidationReport, 
  CAMVerdictType, 
  ToolpathSegmentType, 
  CAMOperation, 
  MachiningRegion, 
  CAMSetup,
  ToolpathStatus
} from "./types";
import { ToolDefinition, ToolAssembly } from "../toolLibrary/types";
import { MachineKinematicModel, MachineAxis } from "../kinematics/types";
import { InverseKinematicsSolver } from "../kinematics/InverseKinematicsSolver";
import { CoordinateFrameGraph } from "../kinematics/CoordinateFrameGraph";

export class ToolpathValidator {
  /**
   * Performs high-integrity kinematic, velocity, envelope, and geometric validation of a 3-Axis Toolpath.
   */
  public static validate(
    toolpath: Toolpath,
    operation: CAMOperation,
    setup: CAMSetup,
    tool: ToolDefinition,
    assembly: ToolAssembly,
    machine: MachineKinematicModel,
    region: MachiningRegion,
    frameGraph?: CoordinateFrameGraph
  ): ToolpathValidationReport {
    const reportId = `VAL_REP_${toolpath.toolpathId}_${Date.now()}`;
    const anomalies: Array<{ code: string; severity: "CRITICAL" | "WARNING" | "INFO"; message: string; segmentId?: string; sequenceId?: number }> = [];

    let kinematicPassed = true;
    let boundsPassed = true;
    let gougeFree = true;
    let limitCompliance = true;

    // Guard 1: Toolpath basic integrity
    if (!toolpath || toolpath.status === ToolpathStatus.INVALID || toolpath.segments.length === 0) {
      anomalies.push({
        code: "INVALID_TOOLPATH_SOURCE",
        severity: "CRITICAL",
        message: "Toolpath source is empty or flagged as invalid."
      });
      return this.buildReport(reportId, toolpath, false, false, false, false, anomalies);
    }

    // Guard 2: Machine axis validation
    const axisMap = new Map<string, MachineAxis>();
    for (const axis of machine.axes) {
      axisMap.set(axis.axisType, axis);
    }

    const xLimit = axisMap.get("LINEAR_X" as any)?.travelLimits || machine.limits.workEnvelope;
    const yLimit = axisMap.get("LINEAR_Y" as any)?.travelLimits || machine.limits.workEnvelope;
    const zLimit = axisMap.get("LINEAR_Z" as any)?.travelLimits || machine.limits.workEnvelope;

    const getMin = (limit: any) => {
      if (limit) {
        if (typeof limit.min === "number") return limit.min;
        if (typeof limit.xMin === "number") return limit.xMin;
        if (typeof limit.yMin === "number") return limit.yMin;
        if (typeof limit.zMin === "number") return limit.zMin;
      }
      return -Infinity;
    };

    const getMax = (limit: any) => {
      if (limit) {
        if (typeof limit.max === "number") return limit.max;
        if (typeof limit.xMax === "number") return limit.xMax;
        if (typeof limit.yMax === "number") return limit.yMax;
        if (typeof limit.zMax === "number") return limit.zMax;
      }
      return Infinity;
    };

    // Check spindle limit
    if (operation.cuttingConditions.spindleSpeed > machine.spindle.maxRPM) {
      limitCompliance = false;
      anomalies.push({
        code: "SPINDLE_LIMIT_EXCEEDED",
        severity: "CRITICAL",
        message: `Requested spindle speed (${operation.cuttingConditions.spindleSpeed} RPM) exceeds machine max spindle limit (${machine.spindle.maxRPM} RPM).`
      });
    }

    if (operation.cuttingConditions.spindleSpeed > tool.maximumRPM) {
      limitCompliance = false;
      anomalies.push({
        code: "TOOL_MAX_RPM_EXCEEDED",
        severity: "CRITICAL",
        message: `Requested spindle speed (${operation.cuttingConditions.spindleSpeed} RPM) exceeds cutting tool max threshold (${tool.maximumRPM} RPM).`
      });
    }

    // Check workpiece weight capacity
    const stockVolumeCm3 = (setup.stock.dimensions.x * setup.stock.dimensions.y * setup.stock.dimensions.z) / 1000;
    const estimatedStockWeightKg = (stockVolumeCm3 * 2.7) / 1000; // Al 6061 has ~2.7 g/cm3 density
    const totalFixtureWeight = setup.fixture ? 15.0 : 0;
    const totalSetupWeight = estimatedStockWeightKg + totalFixtureWeight;
    if (totalSetupWeight > machine.limits.maxWorkpieceWeight) {
      limitCompliance = false;
      anomalies.push({
        code: "WEIGHT_LIMIT_EXCEEDED",
        severity: "CRITICAL",
        message: `Total stock/fixture setup weight (${totalSetupWeight.toFixed(2)} kg) exceeds maximum machine capacity (${machine.limits.maxWorkpieceWeight} kg).`
      });
    }

    // Tool length and geometry check
    if (assembly.gaugeLength > tool.geometry.overallLength * 3) {
      limitCompliance = false;
      anomalies.push({
        code: "DANGEROUS_STICKOUT",
        severity: "WARNING",
        message: `Tool assembly stickout / gauge length ratio indicates potential lack of rigidity or excess runout.`
      });
    }

    // Walk all points and segments
    for (const segment of toolpath.segments) {
      for (const pt of segment.points) {
        // Envelope & Kinematic Reachability Bounds Check
        const envelope = machine.limits.workEnvelope;
        if (
          pt.x < envelope.xMin || pt.x > envelope.xMax ||
          pt.y < envelope.yMin || pt.y > envelope.yMax ||
          pt.z < envelope.zMin || pt.z > envelope.zMax
        ) {
          boundsPassed = false;
          anomalies.push({
            code: "WORK_ENVELOPE_OUT_OF_BOUNDS",
            severity: "CRITICAL",
            message: `Toolpoint position (${pt.x.toFixed(3)}, ${pt.y.toFixed(3)}, ${pt.z.toFixed(3)}) is outside machine work envelope boundary.`,
            segmentId: segment.segmentId,
            sequenceId: pt.sequence
          });
        }

        // Axis Travel limits check specifically
        const xMinVal = getMin(xLimit);
        const xMaxVal = getMax(xLimit);
        if (pt.x < xMinVal || pt.x > xMaxVal) {
          kinematicPassed = false;
          anomalies.push({
            code: "X_AXIS_TRAVEL_EXCEEDED",
            severity: "CRITICAL",
            message: `X-axis joint limit violation: target X ${pt.x.toFixed(3)} is outside travel limit range [${xMinVal}, ${xMaxVal}].`,
            segmentId: segment.segmentId,
            sequenceId: pt.sequence
          });
        }
        const yMinVal = getMin(yLimit);
        const yMaxVal = getMax(yLimit);
        if (pt.y < yMinVal || pt.y > yMaxVal) {
          kinematicPassed = false;
          anomalies.push({
            code: "Y_AXIS_TRAVEL_EXCEEDED",
            severity: "CRITICAL",
            message: `Y-axis joint limit violation: target Y ${pt.y.toFixed(3)} is outside travel limit range [${yMinVal}, ${yMaxVal}].`,
            segmentId: segment.segmentId,
            sequenceId: pt.sequence
          });
        }
        const zMinVal = getMin(zLimit);
        const zMaxVal = getMax(zLimit);
        if (pt.z < zMinVal || pt.z > zMaxVal) {
          kinematicPassed = false;
          anomalies.push({
            code: "Z_AXIS_TRAVEL_EXCEEDED",
            severity: "CRITICAL",
            message: `Z-axis joint limit violation: target Z ${pt.z.toFixed(3)} is outside travel limit range [${zMinVal}, ${zMaxVal}].`,
            segmentId: segment.segmentId,
            sequenceId: pt.sequence
          });
        }

        // Axis Velocity and Feed Limits checks
        const feedLim = 12000; // default max feed mm/min
        if (pt.feed > feedLim) {
          limitCompliance = false;
          anomalies.push({
            code: "FEED_VELOCITY_EXCEEDED",
            severity: "CRITICAL",
            message: `Feed rate (${pt.feed} mm/min) exceeds maximum allowed machine linear axis velocity threshold.`,
            segmentId: segment.segmentId,
            sequenceId: pt.sequence
          });
        }

        // Gouge detection
        // A gouge occurs if any cutting motion goes below the floor Z coordinate
        if (pt.segmentType === ToolpathSegmentType.FEED || pt.segmentType === ToolpathSegmentType.HELIX) {
          if (pt.z < region.floorZ - 0.005) { // allowed a small tolerance of 5 microns for computation
            gougeFree = false;
            anomalies.push({
              code: "CRITICAL_GOUGE_DETECTION",
              severity: "CRITICAL",
              message: `Toolpoint gouges designated floor geometry at depth Z: ${pt.z.toFixed(3)} (floor Z threshold: ${region.floorZ.toFixed(3)}).`,
              segmentId: segment.segmentId,
              sequenceId: pt.sequence
            });
          }
        }
      }
    }

    const validationPassed = kinematicPassed && boundsPassed && gougeFree && limitCompliance;

    return this.buildReport(
      reportId,
      toolpath,
      kinematicPassed,
      boundsPassed,
      gougeFree,
      limitCompliance,
      anomalies
    );
  }

  private static buildReport(
    reportId: string,
    toolpath: Toolpath,
    kinematicPassed: boolean,
    boundsPassed: boolean,
    gougeFree: boolean,
    limitCompliance: boolean,
    anomalies: any[]
  ): ToolpathValidationReport {
    const verdict = (kinematicPassed && boundsPassed && gougeFree && limitCompliance) 
      ? CAMVerdictType.VALIDATED 
      : CAMVerdictType.LIMIT_FAILURE;

    return {
      reportId,
      toolpathId: toolpath.toolpathId,
      operationId: toolpath.operationId,
      verdict,
      timestamp: new Date().toISOString(),
      kinematicPassed,
      boundsPassed,
      gougeFree,
      limitCompliance,
      anomalies,
      signature: `SIG-VAL-REPORT-${toolpath.toolpathId}-${anomalies.length}`
    };
  }
}
