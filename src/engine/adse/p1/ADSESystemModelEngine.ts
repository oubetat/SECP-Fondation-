/**
 * SECP — ADSE-P1 System Model Engine
 * Authoritative system architecture and decomposition layer.
 */

import { ADSESystemModel, ADSESubsystem, ADSEFunction, ADSEInterface, ADSEComponentReference, ADSEAllocation, ADSEConstraint } from './types';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { RevisionEntityType, RevisionLifecycleState } from '../../revision/types';

export class ADSESystemModelEngine {
  private systems: Map<string, ADSESystemModel> = new Map();
  private subsystems: Map<string, ADSESubsystem> = new Map();
  private functions: Map<string, ADSEFunction> = new Map();
  private components: Map<string, ADSEComponentReference> = new Map();
  private interfaces: Map<string, ADSEInterface> = new Map();
  private allocations: Map<string, ADSEAllocation> = new Map();
  private constraints: Map<string, ADSEConstraint> = new Map();

  constructor(private revisionEngine: RevisionEngine) {}

  public createSystem(systemId: string, name: string, description: string, configId: string, actor: string): ADSESystemModel {
    if (this.systems.has(systemId)) throw new Error(`SYSTEM_EXISTS: ${systemId}`);

    const { code, number } = this.revisionEngine.generateNextRevisionCode(systemId);
    const revisionId = `${systemId}:REV-${code}`;

    const system: ADSESystemModel = {
      systemId,
      name,
      description,
      revisionId,
      configurationId: configId,
      subsystems: [],
      functions: [],
      components: [],
      interfaces: [],
      constraints: [],
      allocations: [],
      requirements: []
    };

    // Authorize through SECP Core Revision
    this.revisionEngine.createRevision({
      revisionId,
      entityId: systemId,
      entityType: RevisionEntityType.ENGINEERING_DOCUMENT,
      revisionCode: code,
      revisionNumber: number,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdAt: new Date().toISOString(),
      createdBy: actor,
      effectivity: [],
      configurationScope: [configId],
      dependencies: [],
      approvals: [],
      comments: [],
      contentHash: '',
      dependencyHash: '',
      revisionHash: '',
      content: JSON.parse(JSON.stringify(system))
    });

    this.systems.set(systemId, system);
    return system;
  }

  public createSubsystem(systemId: string, data: Omit<ADSESubsystem, 'systemId'>): ADSESubsystem {
    const sub: ADSESubsystem = { ...data, systemId };
    this.subsystems.set(sub.id, sub);
    
    const sys = this.systems.get(systemId);
    if (sys && !sys.subsystems.includes(sub.id)) {
      sys.subsystems.push(sub.id);
    }
    return sub;
  }

  public createFunction(systemId: string, data: Omit<ADSEFunction, 'systemId'>): ADSEFunction {
    const func: ADSEFunction = { ...data, systemId };
    this.functions.set(func.id, func);

    const sys = this.systems.get(systemId);
    if (sys && !sys.functions.includes(func.id)) {
      sys.functions.push(func.id);
    }
    return func;
  }

  public createComponentReference(systemId: string, data: Omit<ADSEComponentReference, 'systemId'>): ADSEComponentReference {
    const comp: ADSEComponentReference = { ...data, systemId };
    this.components.set(comp.id, comp);

    const sys = this.systems.get(systemId);
    if (sys && !sys.components.includes(comp.id)) {
      sys.components.push(comp.id);
    }
    return comp;
  }

  public createInterface(systemId: string, data: Omit<ADSEInterface, 'systemId'>): ADSEInterface {
    const iface: ADSEInterface = { ...data, systemId };
    this.interfaces.set(iface.id, iface);

    const sys = this.systems.get(systemId);
    if (sys && !sys.interfaces.includes(iface.id)) {
      sys.interfaces.push(iface.id);
    }
    return iface;
  }

  public createAllocation(systemId: string, data: Omit<ADSEAllocation, 'systemId'>): ADSEAllocation {
    const alloc: ADSEAllocation = { ...data, systemId };
    this.allocations.set(alloc.id, alloc);

    const sys = this.systems.get(systemId);
    if (sys && !sys.allocations.includes(alloc.id)) {
      sys.allocations.push(alloc.id);
    }
    return alloc;
  }

  public createConstraint(systemId: string, data: Omit<ADSEConstraint, 'systemId'>): ADSEConstraint {
    const constraint: ADSEConstraint = { ...data, systemId };
    this.constraints.set(constraint.id, constraint);

    const sys = this.systems.get(systemId);
    if (sys && !sys.constraints.includes(constraint.id)) {
      sys.constraints.push(constraint.id);
    }
    return constraint;
  }

  public bindRequirementToSystem(systemId: string, requirementId: string): void {
    const sys = this.systems.get(systemId);
    if (sys && !sys.requirements.includes(requirementId)) {
      sys.requirements.push(requirementId);
    }
  }

  public getSystem(id: string): ADSESystemModel | undefined { return this.systems.get(id); }
  public getSubsystem(id: string): ADSESubsystem | undefined { return this.subsystems.get(id); }
  public getFunction(id: string): ADSEFunction | undefined { return this.functions.get(id); }
  public getComponent(id: string): ADSEComponentReference | undefined { return this.components.get(id); }
  public getInterface(id: string): ADSEInterface | undefined { return this.interfaces.get(id); }
  public getAllocation(id: string): ADSEAllocation | undefined { return this.allocations.get(id); }
  public getConstraint(id: string): ADSEConstraint | undefined { return this.constraints.get(id); }

  public clear(): void {
    this.systems.clear();
    this.subsystems.clear();
    this.functions.clear();
    this.components.clear();
    this.interfaces.clear();
    this.allocations.clear();
    this.constraints.clear();
  }
}
