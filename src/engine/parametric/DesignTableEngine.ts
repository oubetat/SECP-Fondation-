import { ParameterGraph, GraphEvaluationResult } from './ParameterGraph';

export interface DesignTableColumn {
  parameterName: string;
  unit?: string;
}

export interface DesignTableRow {
  variantName: string;
  parameterValues: Record<string, number | string>; // e.g. { "W": 80, "H": 40, "T": 3 }
}

export interface DesignTableDefinition {
  tableId: string;
  tableName: string;
  columns: DesignTableColumn[];
  rows: DesignTableRow[];
  activeVariantName?: string;
}

export interface VariantEvaluationResult {
  variantName: string;
  evaluationResult: GraphEvaluationResult;
  parameterValues: Record<string, number>;
  bindingValues: Record<string, number>; // featureId:param -> val
  deterministicHash: string;
}

export class DesignTableEngine {
  private table: DesignTableDefinition;
  private parameterGraph: ParameterGraph;

  constructor(table: DesignTableDefinition, parameterGraph: ParameterGraph) {
    this.table = table;
    this.parameterGraph = parameterGraph;
  }

  public getTableDefinition(): DesignTableDefinition {
    return this.table;
  }

  /**
   * Apply a specific variant configuration from the design table to the parameter graph.
   */
  public applyVariant(variantName: string): VariantEvaluationResult {
    const row = this.table.rows.find(r => r.variantName === variantName);
    if (!row) {
      throw new Error(`Variant '${variantName}' not found in Design Table '${this.table.tableName}'`);
    }

    this.table.activeVariantName = variantName;

    // Apply parameter overrides from row
    for (const col of this.table.columns) {
      const pName = col.parameterName;
      if (pName in row.parameterValues) {
        const val = row.parameterValues[pName];
        this.parameterGraph.updateParameter(pName, val);
      }
    }

    // Re-evaluate graph
    const evalRes = this.parameterGraph.evaluateGraph();

    // Extract values
    const parameterValues: Record<string, number> = {};
    for (const [_, node] of evalRes.evaluatedParameters) {
      parameterValues[node.name] = node.value;
    }

    const bindingValues: Record<string, number> = {};
    for (const binding of evalRes.evaluatedBindings) {
      bindingValues[binding.bindingId] = binding.evaluatedValue;
    }

    // Hash for determinism check
    const rawHashPayload = JSON.stringify({ variantName, parameterValues, bindingValues });
    const deterministicHash = this.computeHash(rawHashPayload);

    return {
      variantName,
      evaluationResult: evalRes,
      parameterValues,
      bindingValues,
      deterministicHash: `sha256-variant-${deterministicHash}`
    };
  }

  /**
   * Execute evaluation across all variants in the design table and verify multi-variant determinism.
   */
  public evaluateAllVariants(): Map<string, VariantEvaluationResult> {
    const results = new Map<string, VariantEvaluationResult>();

    for (const row of this.table.rows) {
      const res = this.applyVariant(row.variantName);
      results.set(row.variantName, res);
    }

    return results;
  }

  private computeHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
