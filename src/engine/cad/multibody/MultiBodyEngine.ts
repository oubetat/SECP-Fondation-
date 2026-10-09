import { CADPart, CADBody } from '../../parametric-cad/ParametricCADTypes';
import { BRepSolid } from '../../cad-kernel/topology/BRepTopology';

export class MultiBodyEngine {
  public static createBody(part: CADPart, name: string): CADPart {
    const newBody: CADBody = {
      id: `body-${Date.now()}-${Math.random()}`,
      name,
      visible: true,
      suppressed: false,
      revision: 1,
      dependencyIds: []
    };
    
    return {
      ...part,
      bodies: [...(part.bodies || []), newBody]
    };
  }

  public static setActiveBody(part: CADPart, bodyId: string): CADPart {
    return {
      ...part,
      activeBodyId: bodyId
    };
  }

  public static setBodyVisibility(part: CADPart, bodyId: string, visible: boolean): CADPart {
    return this.updateBody(part, bodyId, { visible });
  }

  public static setBodySuppression(part: CADPart, bodyId: string, suppressed: boolean): CADPart {
    return this.updateBody(part, bodyId, { suppressed });
  }

  public static updateBodyBRep(part: CADPart, bodyId: string, brepSolid: BRepSolid, mass: number, volume: number): CADPart {
    return this.updateBody(part, bodyId, { brepSolid, mass, volume });
  }

  public static calculateAggregateMass(part: CADPart): number {
    if (!part.bodies) return 0;
    return part.bodies
      .filter(b => !b.suppressed)
      .reduce((sum, b) => sum + (b.mass || 0), 0);
  }

  public static addDependency(part: CADPart, bodyIdA: string, bodyIdB: string): CADPart {
    const bodyB = part.bodies?.find(b => b.id === bodyIdB);
    if (bodyB && bodyB.dependencyIds.includes(bodyIdA)) {
      throw new Error('Circular dependency detected');
    }
    
    const bodyA = part.bodies?.find(b => b.id === bodyIdA);
    if (!bodyA) return part;
    
    return this.updateBody(part, bodyIdA, { dependencyIds: [...bodyA.dependencyIds, bodyIdB] });
  }

  public static createDerivedBody(part: CADPart, bodyId: string, name: string): CADPart {
    const source = part.bodies?.find(b => b.id === bodyId);
    if (!source) return part;
    
    const newBody: CADBody = {
      id: `body-${Date.now()}-${Math.random()}`,
      name,
      visible: true,
      suppressed: false,
      revision: 1,
      dependencyIds: [bodyId],
      brepSolid: source.brepSolid
    };
    
    return {
      ...part,
      bodies: [...(part.bodies || []), newBody]
    };
  }

  public static renameBody(part: CADPart, bodyId: string, name: string): CADPart {
    const body = part.bodies?.find(b => b.id === bodyId);
    if (!body) return part;
    return this.updateBody(part, bodyId, { name, revision: body.revision + 1 });
  }

  public static transformBody(part: CADPart, bodyId: string, matrix: number[]): CADPart {
    return this.updateBody(part, bodyId, { transformMatrix: matrix });
  }

  public static assignMaterial(part: CADPart, bodyId: string, materialId: string): CADPart {
    return this.updateBody(part, bodyId, { materialId });
  }

  public static booleanOperation(part: CADPart, operation: string, targetId: string, toolIds: string[], destructive: boolean): CADPart {
    let updatedPart = { ...part };
    
    // Add dependencies to tool bodies
    for (const toolId of toolIds) {
      updatedPart = this.addDependency(updatedPart, targetId, toolId);
    }
    
    if (destructive) {
      updatedPart.bodies = updatedPart.bodies?.filter(b => !toolIds.includes(b.id));
    }
    
    return updatedPart;
  }

  private static updateBody(part: CADPart, bodyId: string, updates: Partial<CADBody>): CADPart {
    if (!part.bodies) return part;
    return {
      ...part,
      bodies: part.bodies.map(b => b.id === bodyId ? { ...b, ...updates } : b)
    };
  }
}
