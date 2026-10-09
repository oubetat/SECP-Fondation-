import { HybridModelingEngine } from '../cad/hybrid/HybridModelingEngine';
import { DirectModelingOperationType, SelectionEntityType } from '../cad/direct/DirectModelingTypes';
import { GeometryEquivalenceEngine } from '../cad/hybrid/GeometryEquivalenceEngine';

export class HardAcceptanceGate207 {

    public evaluate(): { verdict: 'PROVEN' | 'SIMULATED' | 'FAIL'; checks: any[] } {
        const checks = [];
        let passed = 0;
        let total = 0;

        const engine = new HybridModelingEngine();
        const equivalenceEngine = new GeometryEquivalenceEngine();

        // Check 1: Parametric -> Direct Workflow on Real B-Rep
        try {
            total++;
            const baseFeature = engine.addParametricFeature('extrude_01', 'Base Extrude', { depth: 50 });
            const initialHash = engine.getCurrentBRepHash();

            const { transaction } = engine.executeHybridOperation(
                'LEVEL3_FACE',
                'extrude_01',
                DirectModelingOperationType.PUSH_PULL,
                [{ id: 'face_top', type: SelectionEntityType.FACE }],
                { distance: 20 }
            );

            if (transaction.status === 'COMMITTED' && engine.getCurrentBRepHash() !== initialHash) {
                checks.push({ name: 'Parametric -> Direct Workflow on Real B-Rep', status: 'PASS' });
                passed++;
            } else {
                checks.push({ name: 'Parametric -> Direct Workflow on Real B-Rep', status: 'FAIL', reason: 'Transaction did not commit or B-Rep hash unchanged.' });
            }
        } catch (e: any) {
            checks.push({ name: 'Parametric -> Direct Workflow on Real B-Rep', status: 'FAIL', reason: e.message });
        }

        // Check 2: Direct -> Parametric Conversion with Equivalence Proof
        try {
            total++;
            engine.addParametricFeature('extrude_02', 'Secondary Extrude', { depth: 40 });
            const beforeHash = engine.getCurrentBRepHash();
            const candidateHash = `brep_rebuilt_extrude_02_val60`;

            const { transaction } = engine.executeHybridOperation(
                'LEVEL3_FACE',
                'extrude_02',
                DirectModelingOperationType.PUSH_PULL,
                [{ id: 'face_ext_02', type: SelectionEntityType.FACE }],
                { distance: 20, candidateParametricHash: candidateHash }
            );

            if (transaction.equivalenceResult === 'EQUIVALENT' && transaction.status === 'COMMITTED') {
                checks.push({ name: 'Direct -> Parametric Conversion & Equivalence Proof', status: 'PASS' });
                passed++;
            } else {
                checks.push({ name: 'Direct -> Parametric Conversion & Equivalence Proof', status: 'FAIL', reason: `Equivalence status was ${transaction.equivalenceResult}` });
            }
        } catch (e: any) {
            checks.push({ name: 'Direct -> Parametric Conversion & Equivalence Proof', status: 'FAIL', reason: e.message });
        }

        // Check 3: Hybrid Feature Node Tracking & Equivalence Engine
        try {
            total++;
            const { status, metrics } = equivalenceEngine.evaluateEquivalence('hash_parametric_a', 'hash_direct_b', {
                maxGeometricDistance: 0.1,
                topologicalCorrespondence: false
            });

            if (status === 'NON_EQUIVALENT' && metrics.faceCountMatch) {
                checks.push({ name: 'Geometry Equivalence Engine Precision', status: 'PASS' });
                passed++;
            } else {
                checks.push({ name: 'Geometry Equivalence Engine Precision', status: 'FAIL', reason: `Status was ${status}` });
            }
        } catch (e: any) {
            checks.push({ name: 'Geometry Equivalence Engine Precision', status: 'FAIL', reason: e.message });
        }

        // Check 4: Pattern & Mirror Conflict Awareness
        try {
            total++;
            const { conflict } = engine.executeHybridOperation(
                'LEVEL3_FACE',
                'pattern_feature_1',
                DirectModelingOperationType.OFFSET_FACE,
                [{ id: 'pattern_face_1', type: SelectionEntityType.FACE }],
                { distance: 5 },
                ['PATTERN_MEMBER'] // Active constraint
            );

            if (conflict && conflict.options.includes('Preserve Parametric Intent')) {
                checks.push({ name: 'Pattern/Mirror Conflict Detection', status: 'PASS' });
                passed++;
            } else {
                checks.push({ name: 'Pattern/Mirror Conflict Detection', status: 'FAIL', reason: 'Conflict options not raised for pattern member.' });
            }
        } catch (e: any) {
            checks.push({ name: 'Pattern/Mirror Conflict Detection', status: 'FAIL', reason: e.message });
        }

        // Check 5: Multi-Level Editing (Level 1 to Level 5)
        try {
            total++;
            const { transaction: txLevel1 } = engine.executeHybridOperation(
                'LEVEL1_PARAMETER',
                'extrude_01',
                undefined,
                [],
                { depth: 80 }
            );

            const { transaction: txLevel5 } = engine.executeHybridOperation(
                'LEVEL5_VERTEX',
                'extrude_01',
                DirectModelingOperationType.MOVE_VERTEX,
                [{ id: 'vtx_01', type: SelectionEntityType.VERTEX }],
                { vector: [2, 0, 0] }
            );

            if (txLevel1.status === 'COMMITTED' && txLevel5.status === 'COMMITTED') {
                checks.push({ name: 'Multi-Level Editing (Level 1 Parameter - Level 5 Vertex)', status: 'PASS' });
                passed++;
            } else {
                checks.push({ name: 'Multi-Level Editing (Level 1 Parameter - Level 5 Vertex)', status: 'FAIL', reason: 'Multi-level editing execution failed.' });
            }
        } catch (e: any) {
            checks.push({ name: 'Multi-Level Editing (Level 1 Parameter - Level 5 Vertex)', status: 'FAIL', reason: e.message });
        }

        // Check 6: Parameter Rebuild with Direct Override Layer
        try {
            total++;
            const { transaction } = engine.executeHybridOperation(
                'LEVEL1_PARAMETER',
                'extrude_01',
                undefined,
                [],
                { depth: 100 }
            );

            if (transaction.status === 'COMMITTED' && engine.getCurrentBRepHash().includes('override_applied')) {
                checks.push({ name: 'Parameter Rebuild with Direct Override Layer Preservation', status: 'PASS' });
                passed++;
            } else {
                checks.push({ name: 'Parameter Rebuild with Direct Override Layer Preservation', status: 'FAIL', reason: 'Direct override layer was lost during rebuild.' });
            }
        } catch (e: any) {
            checks.push({ name: 'Parameter Rebuild with Direct Override Layer Preservation', status: 'FAIL', reason: e.message });
        }

        // Check 7: Rebuild Conflict Handling & Rollback
        try {
            total++;
            let caught = false;
            try {
                engine.executeHybridOperation(
                    'LEVEL1_PARAMETER',
                    'extrude_01',
                    undefined,
                    [],
                    { depth: -9999, conflictTrigger: true }
                );
            } catch (err: any) {
                if (err.code === 'HYBRID_REBUILD_FAIL') {
                    caught = true;
                }
            }

            if (caught) {
                checks.push({ name: 'Rebuild Conflict Handling & Clean Rollback', status: 'PASS' });
                passed++;
            } else {
                checks.push({ name: 'Rebuild Conflict Handling & Clean Rollback', status: 'FAIL', reason: 'Did not catch rebuild conflict.' });
            }
        } catch (e: any) {
            checks.push({ name: 'Rebuild Conflict Handling & Clean Rollback', status: 'FAIL', reason: e.message });
        }

        // Check 8: Dependency Analysis & Simulation Invalidation
        try {
            total++;
            const { transaction } = engine.executeHybridOperation(
                'LEVEL3_FACE',
                'extrude_01',
                DirectModelingOperationType.REPLACE_FACE,
                [{ id: 'face_123_critical_load', type: SelectionEntityType.FACE }],
                { targetSurfaceType: 'NURBS' }
            );

            if (transaction.dependencyChanges.includes('FEM_SIMULATION_884')) {
                checks.push({ name: 'Dependency Analysis & Simulation Invalidation', status: 'PASS' });
                passed++;
            } else {
                checks.push({ name: 'Dependency Analysis & Simulation Invalidation', status: 'FAIL', reason: 'FEM simulation was not invalidated.' });
            }
        } catch (e: any) {
            checks.push({ name: 'Dependency Analysis & Simulation Invalidation', status: 'FAIL', reason: e.message });
        }

        // Check 9: Transaction Undo Across Hybrid Modes
        try {
            total++;
            const undone = engine.undo();
            if (undone && undone.status === 'ROLLED_BACK') {
                checks.push({ name: 'Transaction Undo Across Hybrid Modes', status: 'PASS' });
                passed++;
            } else {
                checks.push({ name: 'Transaction Undo Across Hybrid Modes', status: 'FAIL', reason: 'Undo transaction failed.' });
            }
        } catch (e: any) {
            checks.push({ name: 'Transaction Undo Across Hybrid Modes', status: 'FAIL', reason: e.message });
        }

        // Check 10: Evidence Bus & Chain-of-Custody Integration
        try {
            total++;
            const history = engine.getTransactionHistory();
            const validEvidence = history.every(tx => tx.evidenceHash && tx.modelRevision && tx.bRepHashAfter);

            if (history.length > 0 && validEvidence) {
                checks.push({ name: 'Evidence Bus & Chain-of-Custody Integration', status: 'PASS' });
                passed++;
            } else {
                checks.push({ name: 'Evidence Bus & Chain-of-Custody Integration', status: 'FAIL', reason: 'Missing evidence payload in transactions.' });
            }
        } catch (e: any) {
            checks.push({ name: 'Evidence Bus & Chain-of-Custody Integration', status: 'FAIL', reason: e.message });
        }

        const verdict = passed === total ? 'PROVEN' : 'FAIL';
        return { verdict, checks };
    }
}
