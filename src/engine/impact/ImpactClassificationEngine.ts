import { ImpactClass, RelationshipType, ImpactNode } from './types';

export class ImpactClassificationEngine {
  public static classifyNode(
    distance: number,
    relationshipType?: RelationshipType,
    entityType?: string
  ): ImpactClass {
    if (distance === 0) {
      return 'DIRECT';
    }

    if (relationshipType === 'SIMULATION_DEPENDENCY') {
      return 'REVERIFICATION_REQUIRED';
    }
    if (relationshipType === 'VALIDATION_DEPENDENCY') {
      return 'INVALIDATED';
    }
    if (relationshipType === 'DOCUMENT_DEPENDENCY') {
      return 'REVIEW_REQUIRED';
    }

    if (entityType === 'SIMULATION') {
      return 'REVERIFICATION_REQUIRED';
    }
    if (entityType === 'GCODE' || entityType === 'TOOLPATH') {
      return 'REVERIFICATION_REQUIRED';
    }

    if (distance === 1) {
      return 'INDIRECT';
    }

    return 'TRANSITIVE';
  }
}
