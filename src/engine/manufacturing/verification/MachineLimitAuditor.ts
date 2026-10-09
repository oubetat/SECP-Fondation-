import { MachineProfile } from "../post/types";
import {
  MachineLimitCheckResult,
  MachineLimitVerdict,
  MachineStateTraceEntry,
  VerificationLimitPolicy
} from "./types";

export class MachineLimitAuditor {
  private machineProfile: MachineProfile;
  private limitPolicy: VerificationLimitPolicy;

  constructor(machineProfile: MachineProfile, limitPolicy: VerificationLimitPolicy) {
    this.machineProfile = machineProfile;
    this.limitPolicy = limitPolicy;
  }

  /**
   * Audits all states in the machine state trace against physical machine limits.
   */
  public auditLimits(trace: MachineStateTraceEntry[]): MachineLimitCheckResult {
    const linearViolations: MachineLimitCheckResult["linearAxisViolations"] = [];
    const rotaryViolations: MachineLimitCheckResult["rotaryAxisViolations"] = [];
    const rotaryContinuityViolations: MachineLimitCheckResult["rotaryContinuityViolations"] = [];
    const feedViolations: MachineLimitCheckResult["feedRateViolations"] = [];
    const spindleViolations: MachineLimitCheckResult["spindleSpeedViolations"] = [];

    const limits = this.machineProfile.axisLimits;
    const spindleMax = this.machineProfile.spindle.maxRPM;
    const spindleMin = this.machineProfile.spindle.minRPM;

    let prevRotary = { a: 0, b: 0, c: 0 };
    let hasPrev = false;

    for (const entry of trace) {
      const state = entry.stateAfter;
      const lineNum = entry.lineNumber;
      const pos = state.machinePosition;
      const rot = state.rotaryAngles;

      // 1. Linear limits
      if (this.limitPolicy.enforceLinearStroke) {
        if (limits["X"]) {
          if (pos.x < limits["X"].min || pos.x > limits["X"].max) {
            linearViolations.push({
              axis: "X",
              value: pos.x,
              limitMin: limits["X"].min,
              limitMax: limits["X"].max,
              lineNumber: lineNum
            });
          }
        }
        if (limits["Y"]) {
          if (pos.y < limits["Y"].min || pos.y > limits["Y"].max) {
            linearViolations.push({
              axis: "Y",
              value: pos.y,
              limitMin: limits["Y"].min,
              limitMax: limits["Y"].max,
              lineNumber: lineNum
            });
          }
        }
        if (limits["Z"]) {
          if (pos.z < limits["Z"].min || pos.z > limits["Z"].max) {
            linearViolations.push({
              axis: "Z",
              value: pos.z,
              limitMin: limits["Z"].min,
              limitMax: limits["Z"].max,
              lineNumber: lineNum
            });
          }
        }
      }

      // 2. Rotary limits
      if (this.limitPolicy.enforceRotaryRange) {
        if (limits["A"]) {
          if (rot.a < limits["A"].min || rot.a > limits["A"].max) {
            rotaryViolations.push({
              axis: "A",
              value: rot.a,
              limitMin: limits["A"].min,
              limitMax: limits["A"].max,
              lineNumber: lineNum
            });
          }
        }
        if (limits["B"]) {
          if (rot.b < limits["B"].min || rot.b > limits["B"].max) {
            rotaryViolations.push({
              axis: "B",
              value: rot.b,
              limitMin: limits["B"].min,
              limitMax: limits["B"].max,
              lineNumber: lineNum
            });
          }
        }
        if (limits["C"]) {
          if (rot.c < limits["C"].min || rot.c > limits["C"].max) {
            rotaryViolations.push({
              axis: "C",
              value: rot.c,
              limitMin: limits["C"].min,
              limitMax: limits["C"].max,
              lineNumber: lineNum
            });
          }
        }
      }

      // 3. Rotary continuity (detecting 359° -> -1° rapid flip or unnatural reversal)
      if (this.limitPolicy.enforceRotaryContinuity && hasPrev) {
        const deltaA = Math.abs(rot.a - prevRotary.a);
        const deltaB = Math.abs(rot.b - prevRotary.b);
        const deltaC = Math.abs(rot.c - prevRotary.c);

        const ROTARY_STEP_LIMIT_DEG = 180; // Large single-step rotary jump flag
        if (deltaA > ROTARY_STEP_LIMIT_DEG) {
          rotaryContinuityViolations.push({
            axis: "A",
            deltaDeg: deltaA,
            thresholdDeg: ROTARY_STEP_LIMIT_DEG,
            lineNumber: lineNum
          });
        }
        if (deltaB > ROTARY_STEP_LIMIT_DEG) {
          rotaryContinuityViolations.push({
            axis: "B",
            deltaDeg: deltaB,
            thresholdDeg: ROTARY_STEP_LIMIT_DEG,
            lineNumber: lineNum
          });
        }
        if (deltaC > ROTARY_STEP_LIMIT_DEG) {
          rotaryContinuityViolations.push({
            axis: "C",
            deltaDeg: deltaC,
            thresholdDeg: ROTARY_STEP_LIMIT_DEG,
            lineNumber: lineNum
          });
        }
      }

      prevRotary = { ...rot };
      hasPrev = true;

      // 4. Feed rate bounds
      if (this.limitPolicy.enforceFeedBounds) {
        const axisXDef = this.machineProfile.axisDefinitions["X"];
        const maxFeed = axisXDef?.maxFeed ?? 15000;
        if (state.feedRate > maxFeed) {
          feedViolations.push({
            programmedFeed: state.feedRate,
            limitMax: maxFeed,
            lineNumber: lineNum
          });
        }
      }

      // 5. Spindle RPM bounds
      if (this.limitPolicy.enforceSpindleBounds && state.spindleRPM > 0) {
        if (state.spindleRPM < spindleMin || state.spindleRPM > spindleMax) {
          spindleViolations.push({
            programmedRPM: state.spindleRPM,
            limitMin: spindleMin,
            limitMax: spindleMax,
            lineNumber: lineNum
          });
        }
      }
    }

    const hasViolations =
      linearViolations.length > 0 ||
      rotaryViolations.length > 0 ||
      rotaryContinuityViolations.length > 0 ||
      feedViolations.length > 0 ||
      spindleViolations.length > 0;

    return {
      linearAxisViolations: linearViolations,
      rotaryAxisViolations: rotaryViolations,
      rotaryContinuityViolations,
      feedRateViolations: feedViolations,
      spindleSpeedViolations: spindleViolations,
      verdict: hasViolations ? MachineLimitVerdict.LIMIT_VIOLATION : MachineLimitVerdict.LIMITS_VALID
    };
  }
}
