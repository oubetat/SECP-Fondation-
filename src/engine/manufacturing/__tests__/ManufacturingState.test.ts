import { describe, expect, it } from "vitest";
import { 
  ManufacturingStateEngine, 
  IndependentManufacturingStateAuditor, 
  HardAcceptanceGate097, 
  generateReports097,
  ManufacturingStateType,
  ManufacturingEvent,
  ManufacturingEventType
} from "../state/index";

describe("PATCH-097: Manufacturing State & Genealogy", () => {
  it("1. ManufacturingStateEngine validates valid transition workflow", () => {
    const check = ManufacturingStateEngine.validateTransition(
      ManufacturingStateType.AS_DESIGNED,
      ManufacturingStateType.AS_PLANNED
    );
    expect(check.valid).toBe(true);
  });

  it("2. ManufacturingStateEngine rejects illegal terminal transition SCRAPPED -> RELEASED", () => {
    const check = ManufacturingStateEngine.validateTransition(
      ManufacturingStateType.SCRAPPED,
      ManufacturingStateType.RELEASED
    );
    expect(check.valid).toBe(false);
    expect(check.error).toContain("Cannot release a scrapped component");
  });

  it("3. ManufacturingStateEngine detects parameter reconciliation matching", () => {
    const planned = { speed: 1200, feed: 150 };
    const actual = { speed: 1198, feed: 150 };
    const recon = ManufacturingStateEngine.reconcileParameters(planned, actual);
    expect(recon.status).toBe("MATCHED");
    expect(recon.deviations.length).toBe(0);
  });

  it("4. ManufacturingStateEngine flags severe deviations as CONFLICT", () => {
    const planned = { feed: 150 };
    const actual = { feed: 300 }; // 100% feed increase
    const recon = ManufacturingStateEngine.reconcileParameters(planned, actual);
    expect(recon.status).toBe("CONFLICT");
    expect(recon.deviations[0].key).toBe("feed");
  });

  it("5. Event sequence validator rejects out-of-order events", () => {
    const events: ManufacturingEvent[] = [
      {
        eventId: "EV-01",
        eventType: ManufacturingEventType.OPERATION_COMPLETED,
        partId: "P-1",
        timestamp: "2026-08-20T08:00:00Z"
      },
      {
        eventId: "EV-02",
        eventType: ManufacturingEventType.OPERATION_STARTED,
        partId: "P-1",
        timestamp: "2026-08-20T08:10:00Z" // Started AFTER completed
      }
    ];
    const validation = ManufacturingStateEngine.validateEventSequence(events);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("before OPERATION_STARTED");
  });

  it("6. Hard Acceptance Gate evaluates to PASS", () => {
    const report = HardAcceptanceGate097.evaluateGate();
    expect(report.verdict).toBe("PASS");
  });

  it("7. generateReports097 runs successfully without throwing errors", () => {
    expect(() => generateReports097()).not.toThrow();
  });
});
