/**
 * SECP — ADSE-P2 MBSE Behavioral Engine
 * Authoritative management of Functions, Activities, Actions, States, Transitions, Events, Guards & Effects.
 */

import { MBSEElementRegistry } from './MBSEElementRegistry';
import { MBSEState, MBSEStateTransition, MBSEElementIdentity } from './types';

export class MBSEBehavioralEngine {
  private registry: MBSEElementRegistry;
  private states: Map<string, MBSEState> = new Map();
  private transitions: Map<string, MBSEStateTransition> = new Map();

  constructor(registry: MBSEElementRegistry) {
    this.registry = registry;
  }

  /**
   * Registers a state machine state.
   */
  public registerState(params: {
    mbseId: string;
    name: string;
    owningBehaviorMbseId: string;
    configurationId: string;
    entryAction?: string;
    exitAction?: string;
    isInitial?: boolean;
    isFinal?: boolean;
  }): MBSEState {
    const elem = this.registry.registerElement({
      mbseId: params.mbseId,
      elementType: 'State',
      displayName: params.name,
      category: 'BEHAVIORAL',
      configurationId: params.configurationId
    });

    const state: MBSEState = {
      mbseId: params.mbseId,
      name: params.name,
      owningBehaviorMbseId: params.owningBehaviorMbseId,
      entryAction: params.entryAction,
      exitAction: params.exitAction,
      isInitial: params.isInitial,
      isFinal: params.isFinal
    };

    this.states.set(params.mbseId, state);

    // Link state to owning behavior
    this.registry.addRelationship({
      relationshipType: 'COMPOSES',
      sourceMbseId: params.owningBehaviorMbseId,
      targetMbseId: params.mbseId,
      configurationId: params.configurationId
    });

    return state;
  }

  /**
   * Registers a state transition.
   */
  public registerTransition(params: {
    mbseId: string;
    sourceStateMbseId: string;
    targetStateMbseId: string;
    triggerEvent: string;
    configurationId: string;
    guardCondition?: string;
    effectAction?: string;
  }): MBSEStateTransition {
    this.registry.registerElement({
      mbseId: params.mbseId,
      elementType: 'StateTransition',
      displayName: `Transition ${params.sourceStateMbseId} -> ${params.targetStateMbseId} [${params.triggerEvent}]`,
      category: 'BEHAVIORAL',
      configurationId: params.configurationId
    });

    const transition: MBSEStateTransition = {
      mbseId: params.mbseId,
      sourceStateMbseId: params.sourceStateMbseId,
      targetStateMbseId: params.targetStateMbseId,
      triggerEvent: params.triggerEvent,
      guardCondition: params.guardCondition,
      effectAction: params.effectAction
    };

    this.transitions.set(params.mbseId, transition);

    // Add graph relationships
    this.registry.addRelationship({
      relationshipType: 'TRANSITIONS_TO',
      sourceMbseId: params.sourceStateMbseId,
      targetMbseId: params.targetStateMbseId,
      configurationId: params.configurationId
    });

    return transition;
  }

  /**
   * Validates if a state transition is legal given the trigger event and numerical context parameters.
   */
  public validateTransition(params: {
    owningBehaviorMbseId: string;
    currentStateMbseId: string;
    triggerEvent: string;
    contextParameters?: Record<string, number | string | boolean>;
  }): { allowed: boolean; nextStateMbseId?: string; reason: string; effectAction?: string } {
    const matchingTransitions = Array.from(this.transitions.values()).filter(t => 
      t.sourceStateMbseId === params.currentStateMbseId && t.triggerEvent === params.triggerEvent
    );

    if (matchingTransitions.length === 0) {
      return {
        allowed: false,
        reason: `BEHAVIORAL_ERROR: No state transition registered from state '${params.currentStateMbseId}' on event '${params.triggerEvent}'.`
      };
    }

    for (const transition of matchingTransitions) {
      // Evaluate guard condition if present
      if (transition.guardCondition) {
        const guardPassed = this.evaluateGuardCondition(transition.guardCondition, params.contextParameters || {});
        if (!guardPassed) {
          return {
            allowed: false,
            reason: `GUARD_VIOLATION: Guard condition '${transition.guardCondition}' evaluated to FALSE under current parameters.`
          };
        }
      }

      return {
        allowed: true,
        nextStateMbseId: transition.targetStateMbseId,
        effectAction: transition.effectAction,
        reason: 'State transition validated successfully.'
      };
    }

    return {
      allowed: false,
      reason: 'BEHAVIORAL_ERROR: Transition validation failed.'
    };
  }

  /**
   * Safe evaluation of simple guard condition expressions.
   */
  private evaluateGuardCondition(guard: string, context: Record<string, number | string | boolean>): boolean {
    try {
      // Replace known parameters with values
      let expr = guard;
      for (const [key, val] of Object.entries(context)) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        expr = expr.replace(regex, JSON.stringify(val));
      }

      // Safe JS evaluation for expressions like "temperature <= 800", "altitude > 10000"
      // Disallow dangerous keywords
      if (/import|require|process|global|window|eval|Function/i.test(expr)) {
        return false;
      }

      const fn = new Function(`return Boolean(${expr});`);
      return fn();
    } catch {
      return false;
    }
  }

  public getState(mbseId: string): MBSEState | undefined {
    return this.states.get(mbseId);
  }

  public getTransitionsForState(stateMbseId: string): MBSEStateTransition[] {
    return Array.from(this.transitions.values()).filter(t => t.sourceStateMbseId === stateMbseId);
  }

  public clear(): void {
    this.states.clear();
    this.transitions.clear();
  }
}
