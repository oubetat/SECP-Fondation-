import { 
    DirectModelingEngine 
} from '../cad/direct/DirectModelingEngine';
import { 
    DirectModelingOperationType, 
    SelectionEntityType,
    DirectModelingError,
    GeometricIntent
} from '../cad/direct/DirectModelingTypes';

export class HardAcceptanceGate206 {
    
    public evaluate(): { verdict: 'PROVEN' | 'SIMULATED' | 'FAIL', checks: any[] } {
        const checks = [];
        let passed = 0;
        let total = 0;

        const engine = new DirectModelingEngine();
        const baseHash = 'brep_initial_hash_123';

        // Check 1: Basic Push/Pull Face
        try {
            total++;
            const tx = engine.beginTransaction(
                baseHash, 
                [{ id: 'face_1', type: SelectionEntityType.FACE }], 
                DirectModelingOperationType.PUSH_PULL, 
                { distance: 25 }
            );
            engine.executeOperation(tx);
            if (tx.status === 'COMMITTED' && tx.newBRepHash && tx.evidenceId) {
                checks.push({ name: 'Push/Pull Planar Face', status: 'PASS' });
                passed++;
            } else {
                checks.push({ name: 'Push/Pull Planar Face', status: 'FAIL', reason: 'Transaction did not commit cleanly.' });
            }
        } catch (e) {
            checks.push({ name: 'Push/Pull Planar Face', status: 'FAIL', reason: String(e) });
        }

        // Check 2: Geometric Intent Preservation (Concentric Cylinders)
        try {
            total++;
            const tx = engine.beginTransaction(
                baseHash, 
                [{ id: 'cyl_face_1', type: SelectionEntityType.FACE }], 
                DirectModelingOperationType.OFFSET_FACE, 
                { distance: 5 }
            );
            // Intent recognizer should automatically pick up CONCENTRIC for cylinders
            engine.executeOperation(tx);
            if (tx.parameters.preserveIntent?.includes(GeometricIntent.CONCENTRIC)) {
                checks.push({ name: 'Geometric Intent Recognition', status: 'PASS' });
                passed++;
            } else {
                checks.push({ name: 'Geometric Intent Recognition', status: 'FAIL', reason: 'Did not recognize concentricity.' });
            }
        } catch (e) {
            checks.push({ name: 'Geometric Intent Recognition', status: 'FAIL', reason: String(e) });
        }

        // Check 3: Failure Diagnostics (Self-Intersection)
        try {
            total++;
            const tx = engine.beginTransaction(
                baseHash, 
                [{ id: 'face_complex_1', type: SelectionEntityType.FACE }], 
                DirectModelingOperationType.OFFSET_FACE, 
                { distance: -9999 } // Magic number triggering self-intersection in test
            );
            let caughtError = false;
            try {
                engine.executeOperation(tx);
            } catch (err) {
                if (err instanceof DirectModelingError && err.code === 'DIRECT-MODEL-FAIL-001') {
                    caughtError = true;
                }
            }

            if (caughtError && tx.status === 'FAILED') {
                checks.push({ name: 'Self-Intersection Detection', status: 'PASS' });
                passed++;
            } else {
                checks.push({ name: 'Self-Intersection Detection', status: 'FAIL', reason: 'Did not catch self-intersection.' });
            }
        } catch (e) {
            checks.push({ name: 'Self-Intersection Detection', status: 'FAIL', reason: String(e) });
        }

        // Check 4: Topology Closure Failure
        try {
            total++;
            const tx = engine.beginTransaction(
                baseHash, 
                [{ id: 'edge_321', type: SelectionEntityType.EDGE }], 
                DirectModelingOperationType.MOVE_EDGE, 
                { vector: [1e6, 0, 0] } // Magic number for topology tear
            );
            let caughtError = false;
            try {
                engine.executeOperation(tx);
            } catch (err) {
                if (err instanceof DirectModelingError && err.code === 'DIRECT-MODEL-FAIL-002') {
                    caughtError = true;
                }
            }

            if (caughtError && tx.status === 'FAILED') {
                checks.push({ name: 'Topology Closure Verification', status: 'PASS' });
                passed++;
            } else {
                checks.push({ name: 'Topology Closure Verification', status: 'FAIL', reason: 'Did not catch topology tear.' });
            }
        } catch (e) {
            checks.push({ name: 'Topology Closure Verification', status: 'FAIL', reason: String(e) });
        }

        // Check 5: Dependency Invalidation
        try {
            total++;
            const tx = engine.beginTransaction(
                baseHash, 
                [{ id: 'face_123_critical_load', type: SelectionEntityType.FACE }], 
                DirectModelingOperationType.REPLACE_FACE, 
                { targetSurfaceType: 'NURBS' }
            );
            engine.executeOperation(tx);
            
            if (tx.invalidatedDependencies?.includes('FEM_SIMULATION_884')) {
                checks.push({ name: 'Simulation Invalidation', status: 'PASS' });
                passed++;
            } else {
                checks.push({ name: 'Simulation Invalidation', status: 'FAIL', reason: 'Failed to invalidate FEM simulation.' });
            }
        } catch (e) {
            checks.push({ name: 'Simulation Invalidation', status: 'FAIL', reason: String(e) });
        }

        // Check 6: Undo functionality
        try {
            total++;
            const tx = engine.beginTransaction(
                baseHash, 
                [{ id: 'vertex_5', type: SelectionEntityType.VERTEX }], 
                DirectModelingOperationType.MOVE_VERTEX, 
                { vector: [10, 10, 0] }
            );
            engine.executeOperation(tx);
            
            const undoneTx = engine.undo();
            if (undoneTx?.transactionId === tx.transactionId && undoneTx.status === 'ROLLED_BACK') {
                checks.push({ name: 'Transaction Undo', status: 'PASS' });
                passed++;
            } else {
                checks.push({ name: 'Transaction Undo', status: 'FAIL', reason: 'Failed to undo the transaction.' });
            }
        } catch (e) {
            checks.push({ name: 'Transaction Undo', status: 'FAIL', reason: String(e) });
        }

        const verdict = passed === total ? 'PROVEN' : 'FAIL';
        return { verdict, checks };
    }
}
