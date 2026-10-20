/**
 * General Nodal Circuit Solver (MNA)
 * Supports resistive circuits with independent voltage sources.
 */
import { CircuitModel } from './ReferenceCircuitModel';

export class NodalCircuitSolver {
    public static solve(model: CircuitModel): { [node: string]: number } | null {
        const nodes = Array.from(new Set(model.components.flatMap(c => c.nodes)));
        const groundNode = nodes.find(n => n === 'GND') || nodes[0];
        const unknownNodes = nodes.filter(n => n !== groundNode);
        const nodeToIndex = new Map(unknownNodes.map((n, i) => [n, i]));
        const n = unknownNodes.length;

        const G = Array.from({ length: n }, () => Array(n).fill(0));
        const I = Array(n).fill(0);

        // Add resistors
        for (const comp of model.components.filter(c => c.type === 'RESISTOR')) {
            const [n1, n2] = comp.nodes;
            const g = 1 / comp.value;
            const i1 = nodeToIndex.get(n1);
            const i2 = nodeToIndex.get(n2);

            if (i1 !== undefined) G[i1][i1] += g;
            if (i2 !== undefined) G[i2][i2] += g;
            if (i1 !== undefined && i2 !== undefined) {
                G[i1][i2] -= g;
                G[i2][i1] -= g;
            }
        }

        // Add voltage sources (simplified: connected to GND)
        for (const comp of model.components.filter(c => c.type === 'VOLTAGE_SOURCE')) {
            const [n1, n2] = comp.nodes;
            const node = n1 === groundNode ? n2 : n1;
            const idx = nodeToIndex.get(node);
            if (idx !== undefined) {
                // Set node voltage
                for (let j = 0; j < n; j++) G[idx][j] = 0;
                G[idx][idx] = 1;
                I[idx] = comp.value;
            }
        }

        // Solve G*V = I using Gaussian elimination
        const V = this.gaussianElimination(G, I);
        if (!V) return null;

        const result: { [node: string]: number } = { [groundNode]: 0 };
        unknownNodes.forEach((node, i) => {
            result[node] = V[i];
        });
        return result;
    }

    private static gaussianElimination(A: number[][], b: number[]): number[] | null {
        const n = b.length;
        for (let i = 0; i < n; i++) {
            let max = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(A[k][i]) > Math.abs(A[max][i])) max = k;
            }
            [A[i], A[max]] = [A[max], A[i]];
            [b[i], b[max]] = [b[max], b[i]];

            if (Math.abs(A[i][i]) < 1e-12) return null; // Singular

            for (let k = i + 1; k < n; k++) {
                const c = A[k][i] / A[i][i];
                b[k] -= c * b[i];
                for (let j = i; j < n; j++) A[k][j] -= c * A[i][j];
            }
        }
        const x = Array(n).fill(0);
        for (let i = n - 1; i >= 0; i--) {
            let sum = 0;
            for (let j = i + 1; j < n; j++) sum += A[i][j] * x[j];
            x[i] = (b[i] - sum) / A[i][i];
        }
        return x;
    }
}
