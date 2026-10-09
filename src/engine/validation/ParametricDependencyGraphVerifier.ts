import { ParametricDependencyGraph } from '../parametric-cad/ParametricDependencyGraph';

function simpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).toUpperCase();
}


export type GateVerdict = 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE';

export interface GraphEvidence {
    graphIdentity: string;
    nodeCount: number;
    edgeCount: number;
    rootCount: number;
    leafCount: number;
    cycleCount: number;
    validationResult: any;
    topologicalOrderHash: string;
    snapshotHash: string;
    deterministicReplay: boolean;
    testsExecuted: string[];
    adversarialTestsExecuted: string[];
    verdict: GateVerdict;
}

export class ParametricDependencyGraphVerifier {
    public static verify(): GraphEvidence {
        try {
            const graph = new ParametricDependencyGraph();
            const testsExecuted: string[] = [];
            const adversarialTestsExecuted: string[] = [];
            let allPassed = true;

            // 1. Node identity integrity & Duplicate nodes
            graph.clear();
            graph.addNode({ id: 'N1', type: 'FEATURE' });
            testsExecuted.push('NodeIdentity');
            try {
                graph.addNode({ id: 'N1', type: 'FEATURE' });
                allPassed = false;
            } catch (e) {
                adversarialTestsExecuted.push('DuplicateNode');
            }

            // 2. Edge integrity & Missing references
            graph.clear();
            graph.addNode({ id: 'N1', type: 'FEATURE' });
            graph.addDependency('N1', 'MISSING', 'REFERENCES');
            testsExecuted.push('EdgeIntegrity');
            if (!graph.validate().errors.some(e => e.type === 'MISSING_NODE')) {
                allPassed = false;
            } else {
                adversarialTestsExecuted.push('MissingReference');
            }

            // 3. Self dependencies
            graph.clear();
            graph.addNode({ id: 'N1', type: 'FEATURE' });
            graph.addDependency('N1', 'N1', 'REFERENCES');
            if (!graph.validate().errors.some(e => e.type === 'SELF_DEPENDENCY')) {
                allPassed = false;
            } else {
                adversarialTestsExecuted.push('SelfDependency');
            }

            // 4. Cycles
            graph.clear();
            graph.addNode({ id: 'A', type: 'FEATURE' });
            graph.addNode({ id: 'B', type: 'FEATURE' });
            graph.addDependency('A', 'B', 'REFERENCES');
            graph.addDependency('B', 'A', 'REFERENCES');
            testsExecuted.push('CycleDetection');
            if (!graph.validate().errors.some(e => e.type === 'CYCLE')) {
                allPassed = false;
            } else {
                adversarialTestsExecuted.push('Cycle');
            }

            // 5. Deterministic snapshot ordering
            const g1 = new ParametricDependencyGraph();
            g1.addNode({ id: 'A', type: 'FEATURE' });
            g1.addNode({ id: 'B', type: 'FEATURE' });
            g1.addDependency('A', 'B', 'REFERENCES');
            
            const g2 = new ParametricDependencyGraph();
            g2.addNode({ id: 'B', type: 'FEATURE' });
            g2.addNode({ id: 'A', type: 'FEATURE' });
            g2.addDependency('A', 'B', 'REFERENCES');
            
            const snap1 = JSON.stringify(g1.snapshot());
            const snap2 = JSON.stringify(g2.snapshot());
            const deterministicReplay = snap1 === snap2;
            testsExecuted.push('DeterministicSnapshot');
            if (!deterministicReplay) allPassed = false;

            // 6. Topological ordering & Transitive dependency correctness
            graph.clear();
            graph.addNode({ id: 'P1', type: 'PARAMETER' });
            graph.addNode({ id: 'F1', type: 'FEATURE' });
            graph.addNode({ id: 'G1', type: 'GEOMETRY' });
            graph.addDependency('P1', 'F1', 'DRIVES');
            graph.addDependency('F1', 'G1', 'PRODUCES');
            testsExecuted.push('TopologicalOrder');
            const topo = graph.topologicalOrder();
            if (topo.join(',') !== 'P1,F1,G1') allPassed = false;

            testsExecuted.push('TransitiveDependencies');
            const deps = graph.getTransitiveDependencies('G1');
            if (deps.join(',') !== 'F1,P1') allPassed = false;

            // 7. Impact-set correctness
            testsExecuted.push('ImpactSet');
            const impact = graph.getImpactSet('P1');
            if (impact.join(',') !== 'F1,G1') allPassed = false;

            const paramImpact = graph.getParameterImpact('P1');
            if (paramImpact.join(',') !== 'F1,G1') allPassed = false;

            // Compute final state for evidence
            const validationResult = graph.validate();
            const snapshotHash = simpleHash(JSON.stringify(graph.snapshot()));
            const topologicalOrderHash = simpleHash(JSON.stringify(topo));
            
            const verdict: GateVerdict = allPassed ? 'PASS' : 'FAIL';

            return {
                graphIdentity: 'ParametricDependencyGraph',
                nodeCount: graph.snapshot().nodes.length,
                edgeCount: graph.snapshot().edges.length,
                rootCount: graph.getRoots().length,
                leafCount: graph.getLeaves().length,
                cycleCount: graph.detectCycles().length,
                validationResult,
                topologicalOrderHash,
                snapshotHash,
                deterministicReplay,
                testsExecuted,
                adversarialTestsExecuted,
                verdict
            };
        } catch (error) {
            return {
                graphIdentity: 'ParametricDependencyGraph',
                nodeCount: 0,
                edgeCount: 0,
                rootCount: 0,
                leafCount: 0,
                cycleCount: 0,
                validationResult: { valid: false, errors: [], warnings: [], nodeCount: 0, edgeCount: 0, cycleCount: 0 },
                topologicalOrderHash: '',
                snapshotHash: '',
                deterministicReplay: false,
                testsExecuted: [],
                adversarialTestsExecuted: [],
                verdict: 'FAIL'
            };
        }
    }
}
