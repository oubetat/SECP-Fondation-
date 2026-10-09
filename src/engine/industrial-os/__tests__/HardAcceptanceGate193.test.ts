import { describe, it, expect, vi } from 'vitest';
import { HardAcceptanceGate193 } from '../HardAcceptanceGate193';

vi.mock('crypto', async (importOriginal) => {
  const original = await importOriginal<any>();
  return {
    ...original,
    randomUUID: original.randomUUID || (() => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    })
  };
});

if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = {
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
  };
} else if (!globalThis.crypto.randomUUID) {
  (globalThis.crypto as any).randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
}

describe('PATCH-193: Parametric Sketch Editing, Smart Dimensioning & GCS Diagnostics Tests', () => {
  it('should pass all 28 industrial-grade acceptance checks in the gate', () => {
    const report = HardAcceptanceGate193.execute();

    report.logs.forEach(log => console.log(log));

    expect(report.passed).toBe(true);
    expect(report.score).toBe(28);
    expect(report.checks['smart_dimension_line']).toBe(true);
    expect(report.checks['smart_dimension_circle']).toBe(true);
    expect(report.checks['radius_dimension']).toBe(true);
    expect(report.checks['diameter_dimension']).toBe(true);
    expect(report.checks['distance_dimension']).toBe(true);
    expect(report.checks['horizontal_distance']).toBe(true);
    expect(report.checks['vertical_distance']).toBe(true);
    expect(report.checks['angle_dimension']).toBe(true);
    expect(report.checks['driving_dimension']).toBe(true);
    expect(report.checks['reference_dimension']).toBe(true);
    expect(report.checks['driving_to_reference']).toBe(true);
    expect(report.checks['reference_to_driving']).toBe(true);
    expect(report.checks['dimension_editing']).toBe(true);
    expect(report.checks['unit_conversion']).toBe(true);
    expect(report.checks['fully_constrained_detection']).toBe(true);
    expect(report.checks['under_constrained_detection']).toBe(true);
    expect(report.checks['over_constrained_detection']).toBe(true);
    expect(report.checks['dof_calculation']).toBe(true);
    expect(report.checks['solver_diagnostics']).toBe(true);
    expect(report.checks['failed_constraint_identification']).toBe(true);
    expect(report.checks['conflicting_constraint_identification']).toBe(true);
    expect(report.checks['diagnostic_highlighting']).toBe(true);
    expect(report.checks['dimension_dependency_tracking']).toBe(true);
    expect(report.checks['dimension_provenance']).toBe(true);
    expect(report.checks['deterministic_replay']).toBe(true);
    expect(report.checks['undo_redo']).toBe(true);
    expect(report.checks['persistence_reload']).toBe(true);
    expect(report.checks['industrial_os_events']).toBe(true);
  });
});
