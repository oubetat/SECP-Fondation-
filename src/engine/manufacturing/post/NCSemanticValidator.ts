import {
  MachineProfile,
  NCProgram,
  NCSemanticValidationResult,
  PostTrueVerdict
} from "./types";

export class NCSemanticValidator {
  public static validateProgram(program: NCProgram, machineProfile: MachineProfile): NCSemanticValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const axisLimitViolations: string[] = [];
    const spindleLimitViolations: string[] = [];
    const feedLimitViolations: string[] = [];

    const currentCoords: Record<string, number> = {
      X: 0,
      Y: 0,
      Z: 0,
      A: 0,
      B: 0,
      C: 0
    };

    let activeTool = 0;
    let spindleRPM = 0;
    let activeFeed = 0;

    for (const block of program.blocks) {
      for (const word of block.words) {
        const val = typeof word.value === "number" ? word.value : parseFloat(String(word.value));

        // 1. Axis check
        if (["X", "Y", "Z", "A", "B", "C"].includes(word.letter)) {
          currentCoords[word.letter] = val;
          const limits = machineProfile.axisLimits[word.letter];
          if (limits) {
            // Check limits with small floating tolerance 1e-4
            if (val < limits.min - 1e-4 || val > limits.max + 1e-4) {
              const violation = `Block ${block.blockNumber}: Axis ${word.letter} value ${val} exceeds machine limits [${limits.min}, ${limits.max}]`;
              axisLimitViolations.push(violation);
              errors.push(violation);
            }
          }
        }

        // 2. Tool number check
        if (word.letter === "T") {
          activeTool = Math.round(val);
          if (activeTool < 1 || activeTool > machineProfile.toolChanger.capacity) {
            errors.push(
              `Block ${block.blockNumber}: Tool T${activeTool} exceeds tool changer capacity (${machineProfile.toolChanger.capacity})`
            );
          }
        }

        // 3. Spindle speed check
        if (word.letter === "S") {
          spindleRPM = val;
          if (spindleRPM > 0 && (spindleRPM < machineProfile.spindle.minRPM || spindleRPM > machineProfile.spindle.maxRPM)) {
            const violation = `Block ${block.blockNumber}: Spindle speed ${spindleRPM} RPM outside machine limits [${machineProfile.spindle.minRPM}, ${machineProfile.spindle.maxRPM}]`;
            spindleLimitViolations.push(violation);
            errors.push(violation);
          }
        }

        // 4. Feed rate check
        if (word.letter === "F") {
          activeFeed = val;
          const maxLinearFeed = machineProfile.axisDefinitions.X?.maxFeed || 25000;
          if (activeFeed < 0 || activeFeed > maxLinearFeed) {
            const violation = `Block ${block.blockNumber}: Feed rate ${activeFeed} mm/min exceeds maximum axis feed (${maxLinearFeed} mm/min)`;
            feedLimitViolations.push(violation);
            errors.push(violation);
          }
        }
      }
    }

    const isValid = errors.length === 0;
    return {
      isValid,
      errors,
      warnings,
      axisLimitViolations,
      spindleLimitViolations,
      feedLimitViolations,
      semanticVerdict: isValid ? PostTrueVerdict.SEMANTICALLY_VALIDATED : PostTrueVerdict.SEMANTICALLY_INVALID
    };
  }
}
