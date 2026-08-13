/**
 * SECP Parametric Intelligence Engine
 * Implements Feature Dependency Graphs and Incremental Rebuilds.
 */

export enum FeatureType {
  SKETCH = 'SKETCH',
  EXTRUDE = 'EXTRUDE',
  FILLET = 'FILLET',
  CHAMFER = 'CHAMFER',
  PATTERN = 'PATTERN'
}

export interface Parameter {
  id: string;
  name: string;
  value: number;
  unit: 'mm' | 'deg';
}

export interface CADFeature {
  id: string;
  type: FeatureType;
  name: string;
  dependencies: string[]; // IDs of parameters or other features
  lastRebuildTime: number;
  isDirty: boolean;
}

export interface RebuildReport {
  totalFeatures: number;
  rebuiltFeatures: number;
  skippedFeatures: number;
  rebuildTimeMs: number;
  affectedPath: string[];
}

export class ParametricEngine {
  private features: Map<string, CADFeature> = new Map();
  private parameters: Map<string, Parameter> = new Map();

  constructor() {
    this.initializeMockEngine();
  }

  private initializeMockEngine() {
    // Parameters
    this.parameters.set('p1', { id: 'p1', name: 'Main_Diameter', value: 100, unit: 'mm' });
    this.parameters.set('p2', { id: 'p2', name: 'Shell_Thickness', value: 5, unit: 'mm' });
    this.parameters.set('p3', { id: 'p3', name: 'Bolt_Count', value: 8, unit: 'mm' });

    // Features with Dependencies
    this.features.set('f1', { 
      id: 'f1', type: FeatureType.SKETCH, name: 'Base_Profile', 
      dependencies: ['p1'], lastRebuildTime: Date.now(), isDirty: false 
    });
    this.features.set('f2', { 
      id: 'f2', type: FeatureType.EXTRUDE, name: 'Main_Body', 
      dependencies: ['f1'], lastRebuildTime: Date.now(), isDirty: false 
    });
    this.features.set('f3', { 
      id: 'f3', type: FeatureType.FILLET, name: 'Edge_Softening', 
      dependencies: ['f2', 'p2'], lastRebuildTime: Date.now(), isDirty: false 
    });
    this.features.set('f4', { 
      id: 'f4', type: FeatureType.PATTERN, name: 'Bolt_Pattern', 
      dependencies: ['f2', 'p3'], lastRebuildTime: Date.now(), isDirty: false 
    });
    this.features.set('f5', { 
      id: 'f5', type: FeatureType.EXTRUDE, name: 'Secondary_Flange', 
      dependencies: ['f1'], lastRebuildTime: Date.now(), isDirty: false 
    });
  }

  /**
   * Triggers an incremental rebuild starting from a changed parameter
   */
  public updateParameter(paramId: string, newValue: number): RebuildReport {
    const startTime = performance.now();
    const param = this.parameters.get(paramId);
    if (!param) throw new Error('Parameter not found');

    param.value = newValue;

    // 1. Mark direct dependents as dirty
    const affectedPath: string[] = [];
    this.markDirty(paramId, affectedPath);

    // 2. Perform Incremental Rebuild
    let rebuiltCount = 0;
    let skippedCount = 0;

    this.features.forEach(f => {
      if (f.isDirty) {
        // Simulate CAD Kernel rebuild for this feature
        f.lastRebuildTime = Date.now();
        f.isDirty = false;
        rebuiltCount++;
      } else {
        skippedCount++;
      }
    });

    return {
      totalFeatures: this.features.size,
      rebuiltFeatures: rebuiltCount,
      skippedFeatures: skippedCount,
      rebuildTimeMs: Number((performance.now() - startTime + (rebuiltCount * 1.5)).toFixed(2)),
      affectedPath
    };
  }

  private markDirty(sourceId: string, path: string[]) {
    this.features.forEach(f => {
      if (f.dependencies.includes(sourceId)) {
        if (!f.isDirty) {
          f.isDirty = true;
          path.push(f.name);
          this.markDirty(f.id, path); // Recursive propagation
        }
      }
    });
  }

  public getParameters(): Parameter[] {
    return Array.from(this.parameters.values());
  }

  public getFeatures(): CADFeature[] {
    return Array.from(this.features.values());
  }

  /**
   * Applies an external engineering specification (e.g. from AI Copilot)
   */
  public applySpecification(parameters: Parameter[], features: CADFeature[]) {
    this.parameters.clear();
    this.features.clear();
    
    parameters.forEach(p => this.parameters.set(p.id, p));
    features.forEach(f => this.features.set(f.id, f));
  }
}
