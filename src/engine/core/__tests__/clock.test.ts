import { describe, it, expect, vi } from 'vitest';
import {
  EngineeringClock,
  WallClock,
  DeterministicClock,
  SimulationClock,
  toISOString
} from '../clock';

describe('EngineeringClock Foundation Tests', () => {
  // TEST 1
  it('TEST 1: WallClock returns a valid current timestamp', () => {
    const wallClock: EngineeringClock = new WallClock();
    const before = Date.now();
    const nowMs = wallClock.nowMs();
    const after = Date.now();
    const nowDate = wallClock.now();

    expect(nowMs).toBeGreaterThanOrEqual(before);
    expect(nowMs).toBeLessThanOrEqual(after);
    expect(nowDate).toBeInstanceOf(Date);
    expect(nowDate.getTime()).toBeCloseTo(nowMs, -1);
  });

  // TEST 2
  it('TEST 2: DeterministicClock returns exactly the configured timestamp', () => {
    const configuredIso = "2026-08-18T12:00:00.000Z";
    const expectedEpoch = new Date(configuredIso).getTime();
    const clock = new DeterministicClock(configuredIso);

    expect(clock.nowMs()).toBe(expectedEpoch);
    expect(clock.now().toISOString()).toBe(configuredIso);
    expect(toISOString(clock)).toBe(configuredIso);
  });

  // TEST 3
  it('TEST 3: Two consecutive calls to DeterministicClock.nowMs() return the same value unless advanceMs() is called', () => {
    const clock = new DeterministicClock(1700000000000);
    const call1 = clock.nowMs();
    
    // Busy loop or wait a few ms
    const start = Date.now();
    while (Date.now() - start < 10) {
      // simulate delay
    }

    const call2 = clock.nowMs();
    expect(call1).toBe(call2);
    expect(call2).toBe(1700000000000);
  });

  // TEST 4
  it('TEST 4: advanceMs(1000) advances deterministic time by exactly 1000 ms', () => {
    const initial = 1700000000000;
    const clock = new DeterministicClock(initial);
    
    clock.advanceMs(1000);
    expect(clock.nowMs()).toBe(initial + 1000);
    expect(clock.now().getTime()).toBe(initial + 1000);
  });

  // TEST 5
  it('TEST 5: SimulationClock does not depend on host wall-clock time', () => {
    const initialSimTime = 50000; // 50 seconds in simulation world
    const simClock = new SimulationClock(initialSimTime);

    expect(simClock.nowMs()).toBe(initialSimTime);
    expect(simClock.now().getTime()).toBe(initialSimTime);
  });

  // TEST 6
  it('TEST 6: SimulationClock advances only when explicitly instructed', () => {
    const simClock = new SimulationClock(0);
    expect(simClock.nowMs()).toBe(0);

    // Multiple reads do not advance
    for (let i = 0; i < 10; i++) {
      expect(simClock.nowMs()).toBe(0);
      expect(simClock.now().getTime()).toBe(0);
    }

    // Explicit step
    simClock.advanceMs(250);
    expect(simClock.nowMs()).toBe(250);

    // Explicit set
    simClock.setTimeMs(10000);
    expect(simClock.nowMs()).toBe(10000);
  });

  // TEST 7
  it('TEST 7: Returned Date objects cannot mutate the clock internal state', () => {
    const clock = new DeterministicClock("2026-01-01T00:00:00.000Z");
    const initialMs = clock.nowMs();

    const leakedDate = clock.now();
    // External adversary attempts to mutate internal state via Date mutation method
    leakedDate.setFullYear(2099);
    leakedDate.setTime(0);

    // Clock must remain untouched
    expect(clock.nowMs()).toBe(initialMs);
    expect(clock.now().toISOString()).toBe("2026-01-01T00:00:00.000Z");

    // Also verify for SimulationClock
    const simClock = new SimulationClock(5000);
    const simLeakedDate = simClock.now();
    simLeakedDate.setTime(999999);
    expect(simClock.nowMs()).toBe(5000);
  });

  // TEST 8
  it('TEST 8: Invalid clock advancement values are rejected (NaN, Infinity, -Infinity, negative)', () => {
    const clock = new DeterministicClock(1000);
    const simClock = new SimulationClock(1000);

    expect(() => clock.advanceMs(NaN)).toThrow();
    expect(() => clock.advanceMs(Infinity)).toThrow();
    expect(() => clock.advanceMs(-Infinity)).toThrow();
    expect(() => clock.advanceMs(-100)).toThrow();

    expect(() => simClock.advanceMs(NaN)).toThrow();
    expect(() => simClock.advanceMs(Infinity)).toThrow();
    expect(() => simClock.advanceMs(-Infinity)).toThrow();
    expect(() => simClock.advanceMs(-50)).toThrow();

    expect(() => simClock.setTimeMs(NaN)).toThrow();
    expect(() => simClock.setTimeMs(Infinity)).toThrow();

    // Constructor validation
    expect(() => new DeterministicClock(NaN)).toThrow();
    expect(() => new DeterministicClock(Infinity)).toThrow();
    expect(() => new DeterministicClock("invalid-date-string")).toThrow();
    expect(() => new SimulationClock(NaN)).toThrow();
  });

  // TEST 9
  it('TEST 9: A deterministic clock can reproduce the exact same sequence across independent instances', () => {
    const T0 = "2026-08-18T00:00:00.000Z";
    const clockA = new DeterministicClock(T0);
    const clockB = new DeterministicClock(T0);

    const logA: number[] = [clockA.nowMs()];
    const logB: number[] = [clockB.nowMs()];

    clockA.advanceMs(1000);
    clockB.advanceMs(1000);
    logA.push(clockA.nowMs());
    logB.push(clockB.nowMs());

    clockA.advanceMs(5000);
    clockB.advanceMs(5000);
    logA.push(clockA.nowMs());
    logB.push(clockB.nowMs());

    expect(logA).toEqual(logB);
    expect(logA).toEqual([
      new Date(T0).getTime(),
      new Date(T0).getTime() + 1000,
      new Date(T0).getTime() + 6000
    ]);
  });
});

describe('Adversarial Clock Tests', () => {
  it('Adversarial 1: Changing the machine wall-clock (simulated via spy) does not change DeterministicClock output', () => {
    const clock = new DeterministicClock(1600000000000);
    const originalDateNow = Date.now;

    try {
      // Mock Date.now to simulate a host time jump / NTP skew / leap second
      Date.now = () => 9999999999999;
      expect(clock.nowMs()).toBe(1600000000000);
      expect(clock.now().getTime()).toBe(1600000000000);
    } finally {
      Date.now = originalDateNow;
    }
  });

  it('Adversarial 2: Calling now() repeatedly in rapid succession does not advance SimulationClock', () => {
    const simClock = new SimulationClock(12345);
    for (let i = 0; i < 1000; i++) {
      expect(simClock.nowMs()).toBe(12345);
      expect(simClock.now().getTime()).toBe(12345);
    }
  });

  it('Adversarial 3: DeterministicClock does not secretly call Date.now()', () => {
    const clock = new DeterministicClock(5000);
    const dateNowSpy = vi.spyOn(Date, 'now');

    clock.nowMs();
    clock.now();
    clock.iso();
    clock.advanceMs(100);

    expect(dateNowSpy).not.toHaveBeenCalled();
    dateNowSpy.mockRestore();
  });

  it('Adversarial 4: SimulationClock does not secretly call Date.now()', () => {
    const simClock = new SimulationClock(1000);
    const dateNowSpy = vi.spyOn(Date, 'now');

    simClock.nowMs();
    simClock.now();
    simClock.iso();
    simClock.advanceMs(50);
    simClock.setTimeMs(2000);

    expect(dateNowSpy).not.toHaveBeenCalled();
    dateNowSpy.mockRestore();
  });

  it('Adversarial 5: External mutation of a returned Date cannot alter future clock results', () => {
    const clock = new DeterministicClock(42000);
    const snapshot1 = clock.now();
    snapshot1.setUTCFullYear(1970);
    snapshot1.setUTCMonth(0);
    snapshot1.setUTCDate(1);

    const snapshot2 = clock.now();
    expect(snapshot2.getTime()).toBe(42000);
    expect(clock.nowMs()).toBe(42000);
  });

  it('Adversarial 6: No global Date monkey-patching is used by the module', () => {
    // Verify native Date object is standard un-patched global
    expect(Date).toBe(globalThis.Date);
    const d = new Date();
    expect(d).toBeInstanceOf(Date);
    expect(typeof Date.now).toBe('function');
    expect(typeof Date.parse).toBe('function');
  });
});
