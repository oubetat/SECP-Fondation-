import {
  GeometryQueryPlan,
  GeometryEntityDescriptor,
  GeometryFeatureEvidence,
  GeometryContext,
  FeatureType
} from './types';
import { EngineeringGeometryGraph } from './EngineeringGeometryGraph';
import { SpatialReasoningEngine } from './SpatialReasoningEngine';

export class GeometryReasoningQueryEngine {
  public static compileNaturalQuery(rawQuery: string): GeometryQueryPlan {
    const queryLower = rawQuery.toLowerCase();

    // Check query safety & ambiguity
    if (!rawQuery || rawQuery.trim().length === 0) {
      return {
        queryId: `QRY-INVALID-${Date.now()}`,
        rawQuery,
        isValid: false,
        validationError: 'Empty or blank geometry query.'
      };
    }

    if (queryLower.includes('something') || queryLower.includes('whatever')) {
      return {
        queryId: `QRY-AMBIGUOUS-${Date.now()}`,
        rawQuery,
        isValid: false,
        validationError: 'Ambiguous geometry reference in query.'
      };
    }

    let featureType: FeatureType | undefined;
    if (queryLower.includes('hole')) featureType = 'HOLE';
    else if (queryLower.includes('pocket')) featureType = 'POCKET';
    else if (queryLower.includes('fillet')) featureType = 'FILLET';
    else if (queryLower.includes('boss')) featureType = 'BOSS';

    let filter: GeometryQueryPlan['filter'];

    // Regex for filter e.g., "larger than 10 mm", "diameter > 10 mm", "> 0.5 inch"
    const numMatch = rawQuery.match(/(?:larger than|>|greater than|>=|smaller than|<|<=)\s*(\d+(?:\.\d+)?)\s*(mm|m|inch|cm)/i);
    if (numMatch) {
      const val = parseFloat(numMatch[1]);
      const unit = numMatch[2];
      const op = queryLower.includes('<') || queryLower.includes('smaller') ? '<' : '>';

      filter = {
        field: 'diameter',
        operator: op,
        value: val,
        unit
      };
    }

    return {
      queryId: `QRY-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      rawQuery,
      featureType,
      filter,
      isValid: true
    };
  }

  public static executeQuery(
    plan: GeometryQueryPlan,
    graph: EngineeringGeometryGraph,
    features: GeometryFeatureEvidence[],
    context: GeometryContext
  ): {
    matchedEntities: GeometryEntityDescriptor[];
    matchedFeatures: GeometryFeatureEvidence[];
    unitConverted: boolean;
    details: string;
  } {
    if (!plan.isValid) {
      throw new Error(`Cannot execute invalid geometry query plan: ${plan.validationError}`);
    }

    let matchedFeatures = features;
    if (plan.featureType) {
      matchedFeatures = matchedFeatures.filter((f) => f.featureType === plan.featureType);
    }

    let matchedEntities: GeometryEntityDescriptor[] = [];
    let unitConverted = false;

    // Retrieve entities for matched features or all entities
    const relatedEntityIds = new Set(matchedFeatures.flatMap((f) => f.entityIds));
    const candidateEntities =
      relatedEntityIds.size > 0
        ? graph.findEntities((e) => relatedEntityIds.has(e.entityId))
        : Array.from(graph.entities.values());

    if (plan.filter) {
      const { field, operator, value, unit: queryUnit } = plan.filter;

      matchedEntities = candidateEntities.filter((ent) => {
        const rawVal = ent.parameters[field] ?? ent.parameters.diameter ?? ent.parameters.radius * 2;
        if (rawVal === undefined) return false;

        // Perform unit conversion if CAD model unit != query unit
        let convertedVal = rawVal;
        if (context.units.toLowerCase() !== queryUnit.toLowerCase()) {
          convertedVal = SpatialReasoningEngine.convertLength(rawVal, context.units, queryUnit);
          unitConverted = true;
        }

        if (operator === '>') return convertedVal > value;
        if (operator === '>=') return convertedVal >= value;
        if (operator === '<') return convertedVal < value;
        if (operator === '<=') return convertedVal <= value;
        if (operator === '==') return Math.abs(convertedVal - value) <= 0.001;
        return false;
      });

      const matchedEntityIds = new Set(matchedEntities.map((e) => e.entityId));
      matchedFeatures = matchedFeatures.filter((f) => f.entityIds.some((id) => matchedEntityIds.has(id)));
    } else {
      matchedEntities = candidateEntities;
    }

    return {
      matchedEntities,
      matchedFeatures,
      unitConverted,
      details: `Executed query '${plan.rawQuery}': found ${matchedEntities.length} entities and ${matchedFeatures.length} features (Unit conversion applied: ${unitConverted})`
    };
  }
}
