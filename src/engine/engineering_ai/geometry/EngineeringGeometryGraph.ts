import {
  GeometryEntityDescriptor,
  GeometryRelation,
  GeometryEntityType,
  GeometryRelationType,
  SpatialRelationType
} from './types';

export class EngineeringGeometryGraph {
  public entities: Map<string, GeometryEntityDescriptor> = new Map();
  public relations: GeometryRelation[] = [];

  public addEntity(entity: GeometryEntityDescriptor): void {
    this.entities.set(entity.entityId, entity);
  }

  public addRelation(relation: GeometryRelation): void {
    this.relations.push(relation);
  }

  public getEntity(entityId: string): GeometryEntityDescriptor | undefined {
    return this.entities.get(entityId);
  }

  public getEntitiesByType(type: GeometryEntityType): GeometryEntityDescriptor[] {
    return Array.from(this.entities.values()).filter((e) => e.entityType === type);
  }

  public getRelationsForEntity(entityId: string): GeometryRelation[] {
    return this.relations.filter(
      (r) => r.sourceEntityId === entityId || r.targetEntityId === entityId
    );
  }

  public findRelations(
    sourceId: string,
    targetId: string,
    relationType?: GeometryRelationType | SpatialRelationType
  ): GeometryRelation[] {
    return this.relations.filter((r) => {
      const matchPair =
        (r.sourceEntityId === sourceId && r.targetEntityId === targetId) ||
        (r.sourceEntityId === targetId && r.targetEntityId === sourceId);
      if (!matchPair) return false;
      if (relationType && r.type !== relationType) return false;
      return true;
    });
  }

  public findEntities(filterFn: (e: GeometryEntityDescriptor) => boolean): GeometryEntityDescriptor[] {
    return Array.from(this.entities.values()).filter(filterFn);
  }

  public clear(): void {
    this.entities.clear();
    this.relations = [];
  }
}
