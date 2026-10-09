import { ExpressionParser, EvaluatedValue } from './ExpressionParser';
import { UnitCategory, UNIT_DEFINITIONS } from '../units';

export interface ParameterNode {
  id: string;
  name: string;
  expression: string;
  value: number;
  unit?: string;
  category?: UnitCategory;
  comment?: string;
  revision: number;
}

export interface FeatureBinding {
  bindingId: string;
  featureId: string;
  parameterName: string; // Feature parameter name e.g. "width", "depth", "radius"
  expression: string;    // Expression e.g. "W * 0.4", "H * 0.3"
  evaluatedValue: number;
  unit?: string;
}

export interface GraphEvaluationResult {
  status: 'SUCCESS' | 'ERROR';
  evaluationOrder: string[];
  evaluatedParameters: Map<string, ParameterNode>;
  evaluatedBindings: FeatureBinding[];
  errorMessage?: string;
  revision: number;
}

export class ParameterGraph {
  private nodes: Map<string, ParameterNode> = new Map();
  private nameToIdMap: Map<string, string> = new Map();
  private featureBindings: Map<string, FeatureBinding> = new Map();
  private graphRevision: number = 1;

  /**
   * Add a parameter to the graph.
   */
  public addParameter(node: Omit<ParameterNode, 'value' | 'revision'> & { value?: number }): ParameterNode {
    if (this.nameToIdMap.has(node.name)) {
      throw new Error(`Parameter with name '${node.name}' already exists.`);
    }

    const fullNode: ParameterNode = {
      id: node.id,
      name: node.name,
      expression: node.expression,
      value: node.value || 0,
      unit: node.unit,
      category: node.unit && UNIT_DEFINITIONS[node.unit] ? UNIT_DEFINITIONS[node.unit].category : node.category,
      comment: node.comment,
      revision: 1
    };

    this.nodes.set(node.id, fullNode);
    this.nameToIdMap.set(node.name, node.id);
    this.graphRevision++;

    this.evaluateGraph();
    return this.nodes.get(node.id)!;
  }

  /**
   * Update expression or value of a parameter.
   */
  public updateParameter(idOrName: string, newExpression: string | number): ParameterNode {
    const node = this.getNode(idOrName);
    if (!node) {
      throw new Error(`Parameter '${idOrName}' not found in graph.`);
    }

    node.expression = typeof newExpression === 'number' ? newExpression.toString() : newExpression;
    node.revision++;
    this.graphRevision++;

    this.evaluateGraph();
    return node;
  }

  /**
   * Remove parameter from graph.
   */
  public removeParameter(idOrName: string): void {
    const node = this.getNode(idOrName);
    if (!node) return;

    this.nodes.delete(node.id);
    this.nameToIdMap.delete(node.name);
    this.graphRevision++;

    this.evaluateGraph();
  }

  /**
   * Bind a feature parameter to a parametric expression.
   */
  public bindFeatureParameter(featureId: string, parameterName: string, expression: string, unit?: string): FeatureBinding {
    const bindingId = `${featureId}:${parameterName}`;
    const binding: FeatureBinding = {
      bindingId,
      featureId,
      parameterName,
      expression,
      evaluatedValue: 0,
      unit
    };

    this.featureBindings.set(bindingId, binding);
    this.graphRevision++;
    this.evaluateGraph();

    return this.featureBindings.get(bindingId)!;
  }

  /**
   * Unbind a feature parameter.
   */
  public unbindFeatureParameter(featureId: string, parameterName: string): void {
    const bindingId = `${featureId}:${parameterName}`;
    this.featureBindings.delete(bindingId);
    this.graphRevision++;
  }

  /**
   * Get parameter by ID or name.
   */
  public getNode(idOrName: string): ParameterNode | undefined {
    if (this.nodes.has(idOrName)) return this.nodes.get(idOrName);
    const id = this.nameToIdMap.get(idOrName);
    if (id) return this.nodes.get(id);
    return undefined;
  }

  /**
   * Evaluate the complete parameter graph topologically, enforcing cycle detection,
   * dangling variable detection, and unit consistency.
   */
  public evaluateGraph(): GraphEvaluationResult {
    // 1. Build Adjacency List & Dependencies
    const adj = new Map<string, string[]>(); // node.id -> list of node.id dependencies
    const inDegree = new Map<string, number>();

    for (const [id] of this.nodes) {
      adj.set(id, []);
      inDegree.set(id, 0);
    }

    // Build map of parameter name -> ParameterNode
    const paramScope: Record<string, EvaluatedValue | number> = {};

    // Validate references & build graph edges
    for (const [id, node] of this.nodes) {
      const referencedNames = ExpressionParser.extractVariables(node.expression);

      for (const refName of referencedNames) {
        const targetId = this.nameToIdMap.get(refName);
        if (!targetId) {
          throw new Error(`Dangling parameter error: '${refName}' referenced in parameter '${node.name}' expression '${node.expression}' is not defined.`);
        }

        // Edge: targetId -> id (targetId must be evaluated before id)
        const currentEdges = adj.get(targetId) || [];
        currentEdges.push(id);
        adj.set(targetId, currentEdges);

        inDegree.set(id, (inDegree.get(id) || 0) + 1);
      }
    }

    // 2. Topological Sort (Kahn's Algorithm) & Cycle Detection
    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) {
        queue.push(id);
      }
    }

    const evaluationOrder: string[] = [];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      evaluationOrder.push(currentId);

      const neighbors = adj.get(currentId) || [];
      for (const n of neighbors) {
        const newDeg = (inDegree.get(n) || 1) - 1;
        inDegree.set(n, newDeg);
        if (newDeg === 0) {
          queue.push(n);
        }
      }
    }

    if (evaluationOrder.length !== this.nodes.size) {
      // Cyclic dependency detected!
      const unresolved = Array.from(this.nodes.keys()).filter(k => !evaluationOrder.includes(k));
      const unresolvedNames = unresolved.map(id => this.nodes.get(id)?.name).join(', ');
      throw new Error(`Cyclic dependency detected in parameter graph involving parameters: [${unresolvedNames}]`);
    }

    // 3. Sequential Evaluation in Topological Order
    for (const id of evaluationOrder) {
      const node = this.nodes.get(id)!;

      // Evaluate expression
      const evalRes = ExpressionParser.evaluate(node.expression, paramScope, node.category);

      node.value = evalRes.value;
      if (evalRes.unitCategory) {
        node.category = evalRes.unitCategory;
      }

      // Add to scope for downstream variables
      paramScope[node.name] = {
        value: node.value,
        unitCategory: node.category,
        unitSymbol: node.unit
      };
    }

    // 4. Evaluate Feature Bindings
    const evaluatedBindingsList: FeatureBinding[] = [];

    for (const [bindingId, binding] of this.featureBindings) {
      // Validate references in binding expression
      const referencedNames = ExpressionParser.extractVariables(binding.expression);
      for (const refName of referencedNames) {
        if (!(refName in paramScope)) {
          throw new Error(`Dangling parameter error in feature binding '${bindingId}': variable '${refName}' is not defined.`);
        }
      }

      const evalRes = ExpressionParser.evaluate(binding.expression, paramScope);
      binding.evaluatedValue = evalRes.value;
      evaluatedBindingsList.push(binding);
    }

    return {
      status: 'SUCCESS',
      evaluationOrder: evaluationOrder.map(id => this.nodes.get(id)!.name),
      evaluatedParameters: new Map(this.nodes),
      evaluatedBindings: evaluatedBindingsList,
      revision: this.graphRevision
    };
  }

  public getParameters(): ParameterNode[] {
    return Array.from(this.nodes.values());
  }

  public getFeatureBindings(): FeatureBinding[] {
    return Array.from(this.featureBindings.values());
  }

  public getBindingsForFeature(featureId: string): FeatureBinding[] {
    return Array.from(this.featureBindings.values()).filter(b => b.featureId === featureId);
  }

  public getRevision(): number {
    return this.graphRevision;
  }
}
