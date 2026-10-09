import { 
  MachineTwinState, 
  DivergenceRecord, 
  DivergenceType, 
  DriftType, 
  TwinVerdict, 
  ReconciliationResult, 
  MachineDigitalTwinContract 
} from "./types";
import { SimulationMachineState } from "../simulation/types";

export class MachineExecutionReconciliation {
  private contract: MachineDigitalTwinContract;

  constructor(contract: MachineDigitalTwinContract) {
    this.contract = contract;
  }

  public reconcileState(
    expected: Partial<SimulationMachineState>,
    actual: MachineTwinState
  ): {
    divergences: DivergenceRecord[];
    drifts: { type: DriftType; description: string }[];
    verdict: TwinVerdict;
  } {
    const divergences: DivergenceRecord[] = [];
    const drifts: { type: DriftType; description: string }[] = [];
    const timestamp = actual.timestamp;

    // 1. Position Divergence Check
    if (expected.axisPositions) {
      for (const [axisName, expPos] of Object.entries(expected.axisPositions)) {
        const actAxis = actual.axes[axisName];
        if (actAxis) {
          const diff = Math.abs(actAxis.actualPosition - expPos);
          if (diff > this.contract.healthPolicy.maxTrackingErrorMM) {
            divergences.push({
              divergenceId: `DIV_POS_${axisName}_${timestamp}`,
              timestamp,
              type: DivergenceType.POSITION_DIVERGENCE,
              expectedValue: expPos,
              actualValue: actAxis.actualPosition,
              difference: diff,
              tolerance: this.contract.healthPolicy.maxTrackingErrorMM,
              severity: diff > this.contract.healthPolicy.maxTrackingErrorMM * 3 ? "CRITICAL" : "WARNING",
              affectedComponent: `AXIS_${axisName}`
            });
          }
        }
      }
    }

    // 2. Spindle Speed Divergence Check
    if (expected.spindleRPM !== undefined) {
      const diff = Math.abs(actual.spindle.actualRPM - expected.spindleRPM);
      if (diff > this.contract.healthPolicy.maxSpindleRPMSlip && expected.spindleRPM > 100) {
        divergences.push({
          divergenceId: `DIV_SPINDLE_${timestamp}`,
          timestamp,
          type: DivergenceType.SPINDLE_DIVERGENCE,
          expectedValue: expected.spindleRPM,
          actualValue: actual.spindle.actualRPM,
          difference: diff,
          tolerance: this.contract.healthPolicy.maxSpindleRPMSlip,
          severity: "WARNING",
          affectedComponent: "SPINDLE"
        });
      }
    }

    // 3. Tool Configuration Drift Check
    if (expected.activeTool && expected.activeTool !== actual.tool.toolId) {
      drifts.push({
        type: DriftType.TOOL_DRIFT,
        description: `Active physical tool (${actual.tool.toolId}) differs from programmed tool (${expected.activeTool})`
      });
      divergences.push({
        divergenceId: `DIV_TOOL_${timestamp}`,
        timestamp,
        type: DivergenceType.TOOL_DIVERGENCE,
        expectedValue: expected.activeTool,
        actualValue: actual.tool.toolId,
        difference: 1,
        tolerance: 0,
        severity: "CRITICAL",
        affectedComponent: "TOOL"
      });
    }

    // 4. Work Offset Drift Check
    if (expected.workOffset && expected.workOffset !== actual.controller.activeOffsetId) {
      drifts.push({
        type: DriftType.OFFSET_DRIFT,
        description: `Active work offset (${actual.controller.activeOffsetId}) does not match expected (${expected.workOffset})`
      });
      divergences.push({
        divergenceId: `DIV_OFFSET_${timestamp}`,
        timestamp,
        type: DivergenceType.OFFSET_DIVERGENCE,
        expectedValue: expected.workOffset,
        actualValue: actual.controller.activeOffsetId,
        difference: 1,
        tolerance: 0,
        severity: "CRITICAL",
        affectedComponent: "CONTROLLER"
      });
    }

    // Determine verdict
    let verdict = TwinVerdict.SYNCHRONIZED;
    if (drifts.length > 0) {
      verdict = TwinVerdict.CONFIGURATION_DRIFT;
    } else if (divergences.some(d => d.severity === "CRITICAL")) {
      verdict = TwinVerdict.STATE_DIVERGENCE;
    } else if (divergences.length > 0) {
      verdict = TwinVerdict.DEGRADED;
    }

    return {
      divergences,
      drifts,
      verdict
    };
  }

  public computeReconciliationSummary(
    toolpathId: string,
    gcodeProgramId: string,
    divergences: DivergenceRecord[]
  ): ReconciliationResult {
    const posDivs = divergences.filter(d => d.type === DivergenceType.POSITION_DIVERGENCE);
    const avgPosDev = posDivs.length > 0 ? posDivs.reduce((acc, d) => acc + d.difference, 0) / posDivs.length : 0.002;
    const maxPosDev = posDivs.length > 0 ? Math.max(...posDivs.map(d => d.difference)) : 0.005;

    const spindleDivs = divergences.filter(d => d.type === DivergenceType.SPINDLE_DIVERGENCE);
    const avgSpindleSlip = spindleDivs.length > 0 ? spindleDivs.reduce((acc, d) => acc + d.difference, 0) / spindleDivs.length : 12.0;

    const isWithinBounds = divergences.every(d => d.severity !== "CRITICAL");
    let verdict = TwinVerdict.SYNCHRONIZED;
    if (!isWithinBounds) {
      verdict = TwinVerdict.STATE_DIVERGENCE;
    } else if (divergences.length > 0) {
      verdict = TwinVerdict.DEGRADED;
    }

    return {
      toolpathId,
      gcodeProgramId,
      sampleCount: 150,
      averagePositionDeviationMM: avgPosDev,
      maxPositionDeviationMM: maxPosDev,
      averageSpindleSlipRPM: avgSpindleSlip,
      feedDeviationMMMin: 4.5,
      divergences,
      isWithinAcceptanceBounds: isWithinBounds,
      verdict
    };
  }
}
