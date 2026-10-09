/**
 * SECP — ADSE-P2 MBSE Parametric Engine
 * Authoritative constraint blocks, parameter bindings, and impact propagation.
 */

import { MBSEElementRegistry } from './MBSEElementRegistry';
import { 
  MBSEConstraintBlock, 
  MBSEValueProperty, 
  MBSEBinding, 
  MBSEImpactReport, 
  MBSEImpactNode 
} from './types';

export class MBSEParametricEngine {
  private registry: MBSEElementRegistry;
  private constraintBlocks: Map<string, MBSEConstraintBlock> = new Map();
  private valueProperties: Map<string, MBSEValueProperty> = new Map();
  private bindings: Map<string, MBSEBinding> = new Map();

  constructor(registry: MBSEElementRegistry) {
    this.registry = registry;
  }

  /**
   * Registers a ValueProperty (e.g. Mass, Thrust, Power, MaxTemperature).
   */
  public registerValueProperty(params: {
    mbseId: string;
    name: string;
    value: number | string | boolean;
    unit: string;
    ownerMbseId: string;
    configurationId: string;
  }): MBSEValueProperty {
    this.registry.registerElement({
      mbseId: params.mbseId,
      elementType: 'ValueProperty',
      displayName: `${params.name} = ${params.value} ${params.unit}`,
      category: 'PARAMETRIC',
      configurationId: params.configurationId
    });

    const valProp: MBSEValueProperty = {
      mbseId: params.mbseId,
      name: params.name,
      value: params.value,
      unit: params.unit,
      ownerMbseId: params.ownerMbseId
    };

    this.valueProperties.set(params.mbseId, valProp);

    this.registry.addRelationship({
      relationshipType: 'COMPOSES',
      sourceMbseId: params.ownerMbseId,
      targetMbseId: params.mbseId,
      configurationId: params.configurationId
    });

    return valProp;
  }

  /**
   * Registers a Constraint Block with parametric mathematical/engineering expressions.
   */
  public registerConstraintBlock(params: {
    mbseId: string;
    name: string;
    expression: string;
    parameters: Array<{ name: string; unit: string; valuePropertyMbseId?: string }>;
    configurationId: string;
  }): MBSEConstraintBlock {
    this.registry.registerElement({
      mbseId: params.mbseId,
      elementType: 'ConstraintBlock',
      displayName: `${params.name}: [${params.expression}]`,
      category: 'PARAMETRIC',
      configurationId: params.configurationId
    });

    const block: MBSEConstraintBlock = {
      mbseId: params.mbseId,
      name: params.name,
      expression: params.expression,
      parameters: params.parameters
    };

    this.constraintBlocks.set(params.mbseId, block);
    return block;
  }

  /**
   * Binds a constraint parameter to a target ValueProperty.
   */
  public bindParameter(params: {
    constraintBlockMbseId: string;
    parameterName: string;
    targetValuePropertyMbseId: string;
    configurationId: string;
  }): MBSEBinding {
    const bindingId = `BIND-${params.constraintBlockMbseId}-${params.parameterName}->${params.targetValuePropertyMbseId}`;
    
    this.registry.registerElement({
      mbseId: bindingId,
      elementType: 'Binding',
      displayName: `Bind ${params.parameterName} -> ${params.targetValuePropertyMbseId}`,
      category: 'PARAMETRIC',
      configurationId: params.configurationId
    });

    const binding: MBSEBinding = {
      mbseId: bindingId,
      constraintBlockMbseId: params.constraintBlockMbseId,
      parameterName: params.parameterName,
      targetValuePropertyMbseId: params.targetValuePropertyMbseId
    };

    this.bindings.set(bindingId, binding);

    this.registry.addRelationship({
      relationshipType: 'BINDS_TO',
      sourceMbseId: params.constraintBlockMbseId,
      targetMbseId: params.targetValuePropertyMbseId,
      configurationId: params.configurationId
    });

    return binding;
  }

  /**
   * Propagates impact when a parameter or ValueProperty changes value.
   * Returns a complete impact report showing affected ConstraintBlocks, Subsystems, Functions, and Requirements.
   */
  public analyzeParameterImpact(valPropMbseId: string, newValue: number | string | boolean): MBSEImpactReport {
    const valProp = this.valueProperties.get(valPropMbseId);
    if (!valProp) {
      throw new Error(`PARAMETRIC_ERROR: ValueProperty '${valPropMbseId}' not found.`);
    }

    const oldValue = valProp.value;
    const affectedNodes: MBSEImpactNode[] = [];
    const constraintViolations: string[] = [];

    // 1. Direct owner component/subsystem
    const ownerElem = this.registry.getElement(valProp.ownerMbseId);
    if (ownerElem) {
      affectedNodes.push({
        mbseId: ownerElem.mbseId,
        elementType: ownerElem.elementType,
        displayName: ownerElem.displayName,
        impactType: 'DIRECT',
        detail: `ValueProperty '${valProp.name}' changed from ${oldValue} to ${newValue} ${valProp.unit}`
      });
    }

    // 2. Bound Constraint Blocks
    const boundConstraintRels = this.registry.getRelationshipsForTarget(valPropMbseId)
      .filter(r => r.relationshipType === 'BINDS_TO' || r.sourceMbseId.startsWith('BIND-'));

    for (const rel of boundConstraintRels) {
      const constraintElem = this.registry.getElement(rel.sourceMbseId);
      if (constraintElem) {
        affectedNodes.push({
          mbseId: constraintElem.mbseId,
          elementType: constraintElem.elementType,
          displayName: constraintElem.displayName,
          impactType: 'CONSTRAINT_PROPAGATION',
          detail: `Bound parameter recalculation required under new value ${newValue}`
        });

        // Check if constraint block expression is violated
        const block = this.constraintBlocks.get(constraintElem.mbseId);
        if (block) {
          const violation = this.evaluateConstraintBlock(block, valPropMbseId, newValue);
          if (violation) {
            constraintViolations.push(violation);
          }
        }
      }
    }

    // 3. Upstream Requirements and Functions connected to owner element
    if (ownerElem) {
      const rels = this.registry.getRelationshipsForTarget(ownerElem.mbseId);
      for (const rel of rels) {
        const source = this.registry.getElement(rel.sourceMbseId);
        if (source) {
          affectedNodes.push({
            mbseId: source.mbseId,
            elementType: source.elementType,
            displayName: source.displayName,
            impactType: 'INDIRECT',
            detail: `Downstream value change in ${ownerElem.displayName}`
          });
        }
      }
    }

    return {
      parameterMbseId: valPropMbseId,
      oldValue,
      newValue,
      affectedNodes,
      constraintViolations
    };
  }

  private evaluateConstraintBlock(block: MBSEConstraintBlock, changedPropId: string, newValue: any): string | null {
    try {
      // Build context map
      const context: Record<string, any> = {};
      for (const p of block.parameters) {
        if (p.valuePropertyMbseId === changedPropId) {
          context[p.name] = newValue;
        } else if (p.valuePropertyMbseId) {
          const prop = this.valueProperties.get(p.valuePropertyMbseId);
          if (prop) context[p.name] = prop.value;
        }
      }

      let expr = block.expression;
      for (const [k, v] of Object.entries(context)) {
        const regex = new RegExp(`\\b${k}\\b`, 'g');
        expr = expr.replace(regex, JSON.stringify(v));
      }

      if (/import|require|process|global|window|eval|Function/i.test(expr)) {
        return null;
      }

      const evalFn = new Function(`return Boolean(${expr});`);
      const satisfied = evalFn();
      if (!satisfied) {
        return `CONSTRAINT_VIOLATION: Block '${block.name}' expression '${block.expression}' is FALSE under new value ${newValue}.`;
      }
    } catch {
      // Non-evaluatable or complex expression deferred to SECP solver
    }
    return null;
  }

  public getValueProperty(mbseId: string): MBSEValueProperty | undefined {
    return this.valueProperties.get(mbseId);
  }

  public getConstraintBlock(mbseId: string): MBSEConstraintBlock | undefined {
    return this.constraintBlocks.get(mbseId);
  }

  public clear(): void {
    this.constraintBlocks.clear();
    this.valueProperties.clear();
    this.bindings.clear();
  }
}
