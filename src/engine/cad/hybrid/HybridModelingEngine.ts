import { 
    HybridTransaction, 
    HybridFeatureNode, 
    FeatureEditLevel, 
    EquivalenceStatus, 
    PatternMode, 
    MirrorMode,
    HybridConflict,
    HybridModelingError
} from './HybridModelingTypes';
import { DirectModelingEngine } from '../direct/DirectModelingEngine';
import { DirectModelingOperationType, SelectionEntityType, SelectedEntity } from '../direct/DirectModelingTypes';
import { GeometryEquivalenceEngine } from './GeometryEquivalenceEngine';
import { HybridConstraintResolver } from './HybridConstraintResolver';
import { HybridFeatureTreeSync } from './HybridFeatureTreeSync';
import { HybridRebuildEngine } from './HybridRebuildEngine';

export class HybridModelingEngine {
    private directEngine = new DirectModelingEngine();
    private equivalenceEngine = new GeometryEquivalenceEngine();
    private constraintResolver = new HybridConstraintResolver();
    private treeSync = new HybridFeatureTreeSync(this.equivalenceEngine);
    private rebuildEngine = new HybridRebuildEngine();

    private transactionHistory: HybridTransaction[] = [];
    private currentBRepHash: string = 'brep_initial_root_001';

    public getCurrentBRepHash(): string {
        return this.currentBRepHash;
    }

    public getFeatureTree(): HybridFeatureNode[] {
        return this.treeSync.getFeatureTree();
    }

    public addParametricFeature(featureId: string, name: string, parameters: Record<string, any>): HybridFeatureNode {
        const node = this.treeSync.addParametricFeature(featureId, name, parameters, this.currentBRepHash);
        this.currentBRepHash = node.geometryAfterHash;
        return node;
    }

    /**
     * Executes a hybrid transaction across Level 1 (Parameter), Level 2 (Feature), Level 3 (Face), Level 4 (Edge), Level 5 (Vertex).
     */
    public executeHybridOperation(
        editLevel: FeatureEditLevel,
        targetFeatureId: string,
        operation?: DirectModelingOperationType,
        selectedEntities: SelectedEntity[] = [],
        parameters: Record<string, any> = {},
        activeConstraints: string[] = [],
        patternMode?: PatternMode,
        mirrorMode?: MirrorMode
    ): { transaction: HybridTransaction; conflict?: HybridConflict } {
        const transactionId = `hybtxn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const bRepBefore = this.currentBRepHash;

        // Step 1: Constraint & Conflict Check
        if (operation) {
            const constraintResult = this.constraintResolver.resolveDirectEdit(
                targetFeatureId,
                operation,
                selectedEntities.map(e => e.id),
                parameters,
                activeConstraints,
                patternMode,
                mirrorMode
            );

            if (constraintResult.hasConflict && constraintResult.conflict) {
                const pendingTx: HybridTransaction = {
                    transactionId,
                    modelRevision: 'rev_01',
                    featureRevision: 'ft_01',
                    bRepHashBefore: bRepBefore,
                    bRepHashAfter: bRepBefore,
                    parametersBefore: parameters,
                    parametersAfter: parameters,
                    directOperation: operation,
                    equivalenceResult: 'UNPROVEN',
                    constraintChanges: [],
                    dependencyChanges: [],
                    validationResult: 'INVALID',
                    evidenceHash: `ev_failed_${transactionId}`,
                    timestamp: new Date().toISOString(),
                    status: 'FAILED',
                    failureReason: constraintResult.conflict.description,
                    editLevel
                };
                return { transaction: pendingTx, conflict: constraintResult.conflict };
            }
        }

        // Step 2: Level 1 / Level 2 Parameter Rebuild
        if (editLevel === 'LEVEL1_PARAMETER' || editLevel === 'LEVEL2_FEATURE') {
            const rebuildRes = this.rebuildEngine.rebuildModel(this.getFeatureTree(), targetFeatureId, parameters);
            
            if (!rebuildRes.success) {
                throw new HybridModelingError('HYBRID_REBUILD_FAIL', rebuildRes.conflictReason || 'Rebuild conflict detected.');
            }

            this.currentBRepHash = rebuildRes.finalBRepHash;

            const tx: HybridTransaction = {
                transactionId,
                modelRevision: `rev_${Date.now()}`,
                featureRevision: `ft_rev_${targetFeatureId}`,
                bRepHashBefore: bRepBefore,
                bRepHashAfter: this.currentBRepHash,
                parametersBefore: {},
                parametersAfter: parameters,
                equivalenceResult: 'EQUIVALENT',
                constraintChanges: [],
                dependencyChanges: rebuildRes.invalidatedDependencies,
                validationResult: 'VALID',
                evidenceHash: `ev_tx_${transactionId}`,
                timestamp: new Date().toISOString(),
                status: 'COMMITTED',
                editLevel
            };

            this.transactionHistory.push(tx);
            return { transaction: tx };
        }

        // Step 3: Level 3 (Face), Level 4 (Edge), Level 5 (Vertex) Direct Modifications
        if (!operation) {
            throw new HybridModelingError('MISSING_OPERATION', 'Direct operation type is required for face/edge/vertex editing.');
        }

        const directTx = this.directEngine.beginTransaction(
            bRepBefore,
            selectedEntities,
            operation,
            parameters
        );
        this.directEngine.executeOperation(directTx);

        const bRepAfter = directTx.newBRepHash || `brep_modified_${transactionId}`;
        
        // Candidate parametric hash calculation for Direct -> Parametric conversion check
        const candidateParametricHash = parameters.candidateParametricHash || 
            (operation === DirectModelingOperationType.PUSH_PULL ? bRepAfter : undefined);

        // Feature Tree Sync
        const { node, convertedToParametric } = this.treeSync.applyDirectEditToTree(
            targetFeatureId,
            operation,
            parameters,
            bRepBefore,
            bRepAfter,
            candidateParametricHash
        );

        this.currentBRepHash = bRepAfter;

        const tx: HybridTransaction = {
            transactionId,
            modelRevision: `rev_${Date.now()}`,
            featureRevision: `ft_rev_${node.featureId}`,
            bRepHashBefore: bRepBefore,
            bRepHashAfter: bRepAfter,
            parametersBefore: {},
            parametersAfter: parameters,
            directOperation: operation,
            equivalenceResult: node.equivalenceStatus,
            constraintChanges: [],
            dependencyChanges: directTx.invalidatedDependencies || [],
            validationResult: 'VALID',
            evidenceHash: `ev_tx_${transactionId}`,
            timestamp: new Date().toISOString(),
            status: 'COMMITTED',
            editLevel
        };

        this.transactionHistory.push(tx);
        return { transaction: tx };
    }

    public undo(): HybridTransaction | null {
        for (let i = this.transactionHistory.length - 1; i >= 0; i--) {
            if (this.transactionHistory[i].status === 'COMMITTED') {
                const tx = this.transactionHistory[i];
                tx.status = 'ROLLED_BACK';
                this.currentBRepHash = tx.bRepHashBefore;
                return tx;
            }
        }
        return null;
    }

    public getTransactionHistory(): HybridTransaction[] {
        return [...this.transactionHistory];
    }
}
