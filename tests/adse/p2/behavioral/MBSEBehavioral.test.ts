import { describe, it, expect, beforeEach } from 'vitest';
import { ADSEP2Engine } from '../../../../src/engine/adse/p2/ADSEP2Engine';

describe('ADSE-P2 MBSE Behavioral Semantics', () => {
  let p2: ADSEP2Engine;

  beforeEach(() => {
    p2 = ADSEP2Engine.getInstance();
    p2.clear();
  });

  it('registers behavioral states and transition guards', () => {
    const behavior = p2.registry.registerElement({
      mbseId: 'mbse:behavior:ENGINE_STARTUP',
      elementType: 'Behavior',
      displayName: 'Turbine Startup Sequence',
      category: 'BEHAVIORAL',
      configurationId: 'CFG-001'
    });

    const offState = p2.behavioral.registerState({
      mbseId: 'mbse:state:OFF',
      name: 'Engine Off',
      owningBehaviorMbseId: behavior.mbseId,
      configurationId: 'CFG-001',
      isInitial: true
    });

    const crankingState = p2.behavioral.registerState({
      mbseId: 'mbse:state:CRANKING',
      name: 'Turbine Cranking',
      owningBehaviorMbseId: behavior.mbseId,
      configurationId: 'CFG-001'
    });

    const transition = p2.behavioral.registerTransition({
      mbseId: 'mbse:trans:OFF_TO_CRANKING',
      sourceStateMbseId: offState.mbseId,
      targetStateMbseId: crankingState.mbseId,
      triggerEvent: 'IGNITION_SWITCH_ON',
      guardCondition: 'fuelPressure >= 50 && batteryVoltage >= 24',
      configurationId: 'CFG-001',
      effectAction: 'START_STARTER_MOTOR'
    });

    expect(transition.triggerEvent).toBe('IGNITION_SWITCH_ON');

    // Test transition validation under failing guard condition
    const failRes = p2.behavioral.validateTransition({
      owningBehaviorMbseId: behavior.mbseId,
      currentStateMbseId: offState.mbseId,
      triggerEvent: 'IGNITION_SWITCH_ON',
      contextParameters: { fuelPressure: 30, batteryVoltage: 28 } // fuel pressure too low
    });
    expect(failRes.allowed).toBe(false);
    expect(failRes.reason).toContain('GUARD_VIOLATION');

    // Test transition validation under passing guard condition
    const passRes = p2.behavioral.validateTransition({
      owningBehaviorMbseId: behavior.mbseId,
      currentStateMbseId: offState.mbseId,
      triggerEvent: 'IGNITION_SWITCH_ON',
      contextParameters: { fuelPressure: 60, batteryVoltage: 28 }
    });
    expect(passRes.allowed).toBe(true);
    expect(passRes.nextStateMbseId).toBe('mbse:state:CRANKING');
    expect(passRes.effectAction).toBe('START_STARTER_MOTOR');
  });
});
