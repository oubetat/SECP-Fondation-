import {
  ParametricFeatureTree,
  RebuildValidationResult,
  FeatureType
} from './ParametricFeatureTypes324';
import { NativeCADFeatureKernel } from '../../engineering_ai/nl_cad/NativeCADFeatureKernel';
import { CADConstructionPlan, FeatureType307 } from '../../engineering_ai/nl_cad/NLCADTypes307';

export class FeatureRegenerationEngine324 {
  public static rebuild(tree: ParametricFeatureTree): RebuildValidationResult {
    const startTime = Date.now();
    
    try {
      // 1. Convert 324 tree to 307 Construction Plan
      const plan = this.convertToConstructionPlan(tree);
      
      // 2. Use Native CAD Kernel for actual geometry recomputation
      const kernel = new NativeCADFeatureKernel();
      kernel.buildFromPlan(plan);
      
      const solid = kernel.getCurrentSolid();
      const isValid = solid.validationStatus === 'VALID_SOLID';
      
      return {
        isValid: isValid,
        errors: isValid ? [] : ['Geometry validation failed: ' + solid.validationStatus],
        warnings: [],
        brokenReferences: [],
        geometryDeviation: 0.0, // In a real system, we'd compare against source mesh
        rebuildTimeMs: Date.now() - startTime,
        solidVolumeMm3: solid.volumeMm3,
        isWatertight: solid.isManifold,
        topologySummary: {
          verticesCount: solid.verticesCount,
          edgesCount: solid.edgesCount,
          facesCount: solid.facesCount,
          faceIds: solid.generatedFaceIds
        }
      };
    } catch (error: any) {
      return {
        isValid: false,
        errors: [error.message || 'Unknown regeneration error'],
        warnings: [],
        brokenReferences: [],
        rebuildTimeMs: Date.now() - startTime,
        solidVolumeMm3: 0,
        isWatertight: false
      };
    }
  }

  private static convertToConstructionPlan(tree: ParametricFeatureTree): CADConstructionPlan {
    // Sort features by hierarchy (simplified: root first, then others)
    // In a production system, we'd use a proper topological sort based on dependencies
    const sortedFeatures = [...tree.features].sort((a, b) => {
      if (a.id === tree.rootId) return -1;
      if (b.id === tree.rootId) return 1;
      return 0;
    });

    return {
      planId: `PLAN-REGEN-${Date.now()}`,
      intentId: 'REGEN-INTENT',
      orderedSteps: sortedFeatures.map((feat, index) => {
        // Map feature types between systems
        let targetType: FeatureType307 = 'EXTRUDE_PAD';
        switch (feat.type) {
          case FeatureType.EXTRUDE: targetType = 'EXTRUDE_PAD'; break;
          case FeatureType.HOLE: targetType = 'HOLE'; break;
          case FeatureType.PATTERN: targetType = 'PATTERN_CIRCULAR'; break;
          case FeatureType.SKETCH as any: targetType = 'SKETCH'; break;
          default: targetType = 'EXTRUDE_PAD';
        }

        // Convert parameter list to record
        const parameters: Record<string, any> = {
          id: feat.id // CRITICAL: Preserve original feature ID
        };
        feat.parameters.forEach(p => {
          parameters[p.name] = p.value;
        });

        return {
          stepNumber: index + 1,
          action: 'CREATE',
          targetFeatureType: targetType,
          parameters: parameters,
          dependencies: feat.parentId ? [feat.parentId] : [],
          suppressionState: feat.isSuppressed ? 'SUPPRESSED' : 'ACTIVE'
        };
      })
    };
  }
}
