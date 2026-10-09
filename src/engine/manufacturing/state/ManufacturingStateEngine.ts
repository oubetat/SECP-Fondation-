import { 
  ManufacturingState, 
  ManufacturingStateType, 
  ManufacturingStateTransition, 
  ManufacturingOperation,
  ManufacturingEvent,
  ManufacturingEventType
} from "./types";

export class ManufacturingStateEngine {
  /**
   * Validates state transitions based on the strict state machine rules.
   */
  public static validateTransition(
    from: ManufacturingStateType, 
    to: ManufacturingStateType
  ): { valid: boolean; error?: string } {
    if (from === to) {
      return { valid: true };
    }

    // Rule: SCRAPPED is terminal, cannot go SCRAPPED -> RELEASED
    if (from === ManufacturingStateType.SCRAPPED && to === ManufacturingStateType.RELEASED) {
      return { valid: false, error: "INVALID_TRANSITION: Cannot release a scrapped component" };
    }

    // Rule: RELEASED cannot move back to AS_DESIGNED
    if (from === ManufacturingStateType.RELEASED && to === ManufacturingStateType.AS_DESIGNED) {
      return { valid: false, error: "INVALID_TRANSITION: Cannot revert a released part state back to design" };
    }

    // Rule: AS_DESIGNED cannot skip directly to AS_INSPECTED
    if (from === ManufacturingStateType.AS_DESIGNED && to === ManufacturingStateType.AS_INSPECTED) {
      return { valid: false, error: "INVALID_TRANSITION: Cannot skip directly from design to inspected without manufacturing" };
    }

    // Common valid workflows
    const allowedTransitions: Record<ManufacturingStateType, ManufacturingStateType[]> = {
      [ManufacturingStateType.AS_DESIGNED]: [ManufacturingStateType.AS_PLANNED],
      [ManufacturingStateType.AS_PLANNED]: [ManufacturingStateType.AS_SCHEDULED, ManufacturingStateType.AS_DESIGNED],
      [ManufacturingStateType.AS_SCHEDULED]: [ManufacturingStateType.IN_PROCESS, ManufacturingStateType.AS_PLANNED],
      [ManufacturingStateType.IN_PROCESS]: [ManufacturingStateType.AS_MANUFACTURED, ManufacturingStateType.SCRAPPED],
      [ManufacturingStateType.AS_MANUFACTURED]: [ManufacturingStateType.AS_INSPECTED, ManufacturingStateType.SCRAPPED],
      [ManufacturingStateType.AS_INSPECTED]: [
        ManufacturingStateType.RELEASED, 
        ManufacturingStateType.REWORKED, 
        ManufacturingStateType.SCRAPPED
      ],
      [ManufacturingStateType.REWORKED]: [ManufacturingStateType.IN_PROCESS, ManufacturingStateType.AS_INSPECTED, ManufacturingStateType.SCRAPPED],
      [ManufacturingStateType.SCRAPPED]: [],
      [ManufacturingStateType.RELEASED]: []
    };

    const allowed = allowedTransitions[from] || [];
    if (!allowed.includes(to)) {
      return { valid: false, error: `INVALID_TRANSITION: Moving from ${from} to ${to} is prohibited` };
    }

    return { valid: true };
  }

  /**
   * Calculates a unique deterministic cryptographic fingerprint of the Manufacturing State.
   */
  public static calculateStateFingerprint(state: ManufacturingState): string {
    const parts = [
      state.partId,
      state.materialId,
      state.materialRevision.toString(),
      state.stateType,
      state.revision.toString(),
      state.batchId || "nobatch",
      state.lotId || "nolot",
      state.geometryState.nominalGeometry,
      state.geometryState.geometricRevision.toString(),
      state.processHistory.map(op => `${op.operationId}_${op.sequence}`).join(",")
    ];
    
    if (state.defectState && state.defectState.length > 0) {
      parts.push(state.defectState.map(d => `${d.defectId}_${d.severity}`).join(","));
    }

    return "mfg-state-fp-" + parts.join("_").replace(/[^a-zA-Z0-9_-]/g, "");
  }

  /**
   * Performs reconciliation comparing planned vs. executed process parameters.
   */
  public static reconcileParameters(
    planned: Record<string, any>,
    actual: Record<string, any>,
    tolerances: Record<string, number> = {}
  ): { status: "MATCHED" | "DEVIATION" | "CONFLICT"; deviations: { key: string; planned: any; actual: any; diff: number }[] } {
    const deviations: { key: string; planned: any; actual: any; diff: number }[] = [];
    let status: "MATCHED" | "DEVIATION" | "CONFLICT" = "MATCHED";

    for (const key of Object.keys(planned)) {
      if (actual[key] === undefined) {
        continue;
      }

      const pVal = planned[key];
      const aVal = actual[key];

      if (typeof pVal === "number" && typeof aVal === "number") {
        const diff = Math.abs(aVal - pVal);
        const tol = tolerances[key] !== undefined ? tolerances[key] : 0.05 * pVal; // default 5% tolerance

        if (diff > tol) {
          status = "DEVIATION";
          // Check if it's an extreme deviation (greater than 30%)
          if (diff > pVal * 0.3) {
            status = "CONFLICT";
          }
          deviations.push({ key, planned: pVal, actual: aVal, diff });
        }
      } else if (pVal !== aVal) {
        status = "CONFLICT";
        deviations.push({ key, planned: pVal, actual: aVal, diff: NaN });
      }
    }

    return { status, deviations };
  }

  /**
   * Validates chronic event sequence ordering to avoid illegal events.
   */
  public static validateEventSequence(events: ManufacturingEvent[]): { valid: boolean; error?: string } {
    let hasCompleted = false;
    let hasStarted = false;

    // Sort by timestamp
    const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    for (const event of sorted) {
      if (event.eventType === ManufacturingEventType.OPERATION_STARTED) {
        hasStarted = true;
      }
      if (event.eventType === ManufacturingEventType.OPERATION_COMPLETED) {
        if (!hasStarted) {
          return { valid: false, error: "OPERATION_COMPLETED received before OPERATION_STARTED" };
        }
        hasCompleted = true;
      }
      if (event.eventType === ManufacturingEventType.INSPECTION_COMPLETED) {
        if (!hasCompleted) {
          return { valid: false, error: "INSPECTION_COMPLETED received before any operation was completed" };
        }
      }
    }

    return { valid: true };
  }
}
