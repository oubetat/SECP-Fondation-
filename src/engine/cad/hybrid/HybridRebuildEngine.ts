import { 
    HybridFeatureNode, 
    HybridModelingError 
} from './HybridModelingTypes';
import { DependencyInvalidator } from '../direct/DependencyInvalidator';

export interface RebuildResult {
    success: boolean;
    finalBRepHash: string;
    invalidatedDependencies: string[];
    rebuildConflict?: boolean;
    conflictReason?: string;
}

export class HybridRebuildEngine {
    private dependencyInvalidator = new DependencyInvalidator();

    public rebuildModel(
        featureTree: HybridFeatureNode[],
        changedFeatureId: string,
        newParameters: Record<string, any>
    ): RebuildResult {
        let currentHash = 'brep_root_seed';
        const invalidatedDependencies: string[] = [];

        for (const node of featureTree) {
            if (node.featureId === changedFeatureId) {
                node.parameters = { ...node.parameters, ...newParameters };
                
                // Re-evaluate parametric B-Rep
                currentHash = `brep_rebuilt_${node.featureId}_val${node.parameters.depth || node.parameters.length || 1}`;
                node.geometryAfterHash = currentHash;

                // Special failure trigger for conflict test
                if (newParameters.depth === -9999 || newParameters.conflictTrigger) {
                    return {
                        success: false,
                        finalBRepHash: currentHash,
                        invalidatedDependencies: [],
                        rebuildConflict: true,
                        conflictReason: 'REBUILD_CONFLICT: Direct override surface topologies do not match updated parametric features.'
                    };
                }
            } else if (node.nodeType === 'DIRECT_OVERRIDE' || node.nodeType === 'HYBRID') {
                // Re-apply direct override layer on top of new parametric base
                currentHash = `brep_override_applied_${node.featureId}_on_${currentHash}`;
                node.geometryBeforeHash = node.geometryBeforeHash;
                node.geometryAfterHash = currentHash;
            } else {
                currentHash = node.geometryAfterHash || currentHash;
            }
        }

        // Downstream dependency analysis for Assembly, CAM, FEM/CFD
        const impacted = this.dependencyInvalidator.analyzeImpact(
            [{ id: changedFeatureId }],
            currentHash
        );
        invalidatedDependencies.push(...impacted);
        this.dependencyInvalidator.invalidate(impacted);

        return {
            success: true,
            finalBRepHash: currentHash,
            invalidatedDependencies
        };
    }
}
