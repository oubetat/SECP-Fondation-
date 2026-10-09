import { 
    HybridFeatureNode, 
    EquivalenceStatus, 
    HybridNodeType 
} from './HybridModelingTypes';
import { DirectModelingOperationType } from '../direct/DirectModelingTypes';
import { GeometryEquivalenceEngine } from './GeometryEquivalenceEngine';

export class HybridFeatureTreeSync {
    private featureTree: HybridFeatureNode[] = [];
    private equivalenceEngine: GeometryEquivalenceEngine;

    constructor(equivalenceEngine?: GeometryEquivalenceEngine) {
        this.equivalenceEngine = equivalenceEngine || new GeometryEquivalenceEngine();
    }

    public getFeatureTree(): HybridFeatureNode[] {
        return [...this.featureTree];
    }

    public addParametricFeature(
        featureId: string, 
        name: string, 
        parameters: Record<string, any>, 
        bRepHash: string
    ): HybridFeatureNode {
        const node: HybridFeatureNode = {
            featureId,
            name,
            nodeType: 'PARAMETRIC',
            parameters: { ...parameters },
            geometryBeforeHash: bRepHash,
            geometryAfterHash: bRepHash,
            equivalenceStatus: 'EQUIVALENT',
            dependencies: []
        };
        this.featureTree.push(node);
        return node;
    }

    /**
     * Attempts Direct -> Parametric conversion or creates a Hybrid/Override feature node.
     */
    public applyDirectEditToTree(
        targetFeatureId: string,
        operation: DirectModelingOperationType,
        directParams: Record<string, any>,
        bRepBeforeHash: string,
        bRepAfterHash: string,
        candidateParametricHash?: string
    ): { node: HybridFeatureNode; convertedToParametric: boolean } {
        const sourceIndex = this.featureTree.findIndex(f => f.featureId === targetFeatureId);
        const sourceNode = sourceIndex >= 0 ? this.featureTree[sourceIndex] : null;

        // Try Direct -> Parametric Conversion
        if (sourceNode && candidateParametricHash) {
            const { status } = this.equivalenceEngine.evaluateEquivalence(candidateParametricHash, bRepAfterHash);
            
            if (status === 'EQUIVALENT') {
                // Perform conversion: update existing parametric feature node directly!
                if (operation === DirectModelingOperationType.PUSH_PULL && directParams.distance) {
                    const currentDepth = sourceNode.parameters.depth || 0;
                    sourceNode.parameters.depth = currentDepth + directParams.distance;
                }
                sourceNode.geometryAfterHash = bRepAfterHash;
                sourceNode.equivalenceStatus = 'EQUIVALENT';
                
                return { node: sourceNode, convertedToParametric: true };
            }
        }

        // If not convertible or not equivalent, append a Hybrid/Direct Override Node
        const newNodeId = `hyb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const statusResult = candidateParametricHash 
            ? this.equivalenceEngine.evaluateEquivalence(candidateParametricHash, bRepAfterHash).status 
            : 'NON_EQUIVALENT';

        const hybridNode: HybridFeatureNode = {
            featureId: newNodeId,
            name: `Direct ${operation} on ${targetFeatureId}`,
            nodeType: statusResult === 'EQUIVALENT' ? 'PARAMETRIC' : 'DIRECT_OVERRIDE',
            sourceFeatureId: targetFeatureId,
            directOperation: operation,
            parameters: { ...directParams },
            geometryBeforeHash: bRepBeforeHash,
            geometryAfterHash: bRepAfterHash,
            equivalenceStatus: statusResult,
            dependencies: [targetFeatureId]
        };

        this.featureTree.push(hybridNode);
        return { node: hybridNode, convertedToParametric: false };
    }

    public removeFeature(featureId: string): boolean {
        const idx = this.featureTree.findIndex(f => f.featureId === featureId);
        if (idx >= 0) {
            this.featureTree.splice(idx, 1);
            return true;
        }
        return false;
    }
}
