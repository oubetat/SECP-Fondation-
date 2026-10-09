import { Solid } from '../cad-kernel/topology/TopologyContracts';
import { ManufacturingFeatureEngine, FeatureRecognitionResult } from './feature-recognition/ManufacturingFeatureEngine';
import { BRepTessellator } from '../cad-kernel/tessellation/BRepTessellator';
import { ManufacturingFeatureType } from './feature-recognition/FeatureTypes';

export interface CAMSetupData {
  brepHash: string;
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  features: {
    pockets: any[];
    holes: any[];
    planes: any[];
    bosses: any[];
    slots: any[];
    steps: any[];
  };
  machiningRegions: any[];
  featureGraph: any;
  recognitionExecutionTimeMs: number;
}

export class CAMSetup {
  /**
   * Initializes a CAM Setup directly from a BRep Solid.
   * Performs Manufacturing Feature Recognition (MFR) to identify pockets, holes, etc.
   */
  public static fromBRep(solid: Solid): CAMSetupData {
    const brepHash = BRepTessellator.computeBRepHash(solid);
    
    // Perform full autonomous feature recognition
    const recognition = ManufacturingFeatureEngine.recognizeFromSolid(solid);
    
    const bb = this.computeBoundingBox(solid);

    return {
      brepHash,
      boundingBox: bb,
      features: {
        pockets: recognition.features.filter(f => 
          f.type === ManufacturingFeatureType.POCKET || 
          f.type === ManufacturingFeatureType.OPEN_POCKET || 
          f.type === ManufacturingFeatureType.CLOSED_POCKET
        ),
        holes: recognition.features.filter(f => 
          f.type === ManufacturingFeatureType.HOLE || 
          f.type === ManufacturingFeatureType.SIMPLE_HOLE || 
          f.type === ManufacturingFeatureType.THROUGH_HOLE || 
          f.type === ManufacturingFeatureType.BLIND_HOLE || 
          f.type === ManufacturingFeatureType.COUNTERBORE_HOLE || 
          f.type === ManufacturingFeatureType.COUNTERSINK_HOLE
        ),
        planes: recognition.features.filter(f => f.type === ManufacturingFeatureType.FACE),
        bosses: recognition.features.filter(f => f.type === ManufacturingFeatureType.BOSS),
        slots: recognition.features.filter(f => f.type === ManufacturingFeatureType.SLOT),
        steps: recognition.features.filter(f => f.type === ManufacturingFeatureType.STEP),
      },
      machiningRegions: recognition.setups,
      featureGraph: recognition.graph,
      recognitionExecutionTimeMs: recognition.executionTimeMs
    };
  }

  private static computeBoundingBox(solid: Solid) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    solid.outerShell.orientedFaces.forEach(of => {
      of.face.outerLoop.orientedEdges.forEach(oe => {
        // Use coordinates to compute exact BB
        const vertices = [oe.edge.startVertex.geometry, oe.edge.endVertex.geometry];
        vertices.forEach(p => {
          minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); minZ = Math.min(minZ, p.z);
          maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); maxZ = Math.max(maxZ, p.z);
        });
      });
    });
    
    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    };
  }
}
