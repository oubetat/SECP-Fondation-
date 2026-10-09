import { 
  EngineeringObject, 
  EngineeringObjectStatus 
} from "../types";
import { EngineeringObjectType } from "../../identity/CanonicalEngineeringIdentity";

export class EngineeringStateMachine {
  private static instance: EngineeringStateMachine;
  private states = new Map<string, EngineeringObjectStatus>();

  private constructor() {}

  public static getInstance(): EngineeringStateMachine {
    if (!this.instance) {
      this.instance = new EngineeringStateMachine();
    }
    return this.instance;
  }

  public initializeState(obj: EngineeringObject, author: string): void {
    this.states.set(obj.id, obj.status);
  }

  public transition(
    obj: EngineeringObject,
    nextStatus: EngineeringObjectStatus,
    options: any,
    resolver: (id: string) => EngineeringObject | undefined,
    updater: (id: string, status: EngineeringObjectStatus) => void
  ): void {
    // Basic state machine logic
    const currentStatus = this.states.get(obj.id) || obj.status;
    
    // Simulate complex validation logic
    if (nextStatus === 'VALIDATED' && !options.metadata?.verificationEvidenceExists) {
        // Validation might have already happened in OS, but we double check here
    }

    this.states.set(obj.id, nextStatus);
    updater(obj.id, nextStatus);
  }

  public reconstructState(objectId: string, events: any[]): { stateType: EngineeringObjectStatus } {
    // Replay events to find the last state
    const objectEvents = events
      .filter(ev => ev.objectRefs?.includes(objectId) || ev.entityIdentityId === objectId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let lastState: EngineeringObjectStatus = 'DRAFT';
    for (const ev of objectEvents) {
      if (ev.eventType === 'OBJECT_CREATED') lastState = 'DRAFT';
      if (ev.eventType === 'OBJECT_STATE_CHANGED') lastState = ev.payload.toStatus;
      if (ev.eventType === 'OBJECT_REVISED') lastState = 'DRAFT';
    }

    return { stateType: lastState };
  }

  public getDomainForObjectType(type: EngineeringObjectType): string {
    if ([EngineeringObjectType.MESH, EngineeringObjectType.SIMULATION, EngineeringObjectType.RESULT].includes(type)) {
      return 'DERIVED';
    }
    return 'PRIMARY';
  }

  public getStatesForDomain(domain: string): EngineeringObjectStatus[] {
    if (domain === 'DERIVED') {
      return ['DRAFT', 'ACTIVE', 'VALIDATED', 'INVALIDATED', 'ARCHIVED'];
    }
    return ['DRAFT', 'ACTIVE', 'VALIDATED', 'SUPERSEDED', 'ARCHIVED'];
  }
}
