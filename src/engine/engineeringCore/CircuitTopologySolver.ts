/**
 * Solver that uses circuit topology to calculate equivalent resistance
 */
import { CircuitModel } from './ReferenceCircuitModel';

export class CircuitTopologySolver {
    public static getEquivalentResistance(model: CircuitModel, node1: string, node2: string): number {
        const resistors = model.components.filter(c => c.type === 'RESISTOR');
        
        if (resistors.length === 0) return Infinity; // Open circuit
        
        // Check for missing values
        if (resistors.some(r => isNaN(r.value))) return NaN;

        // Series/Parallel only supported for 2 resistors currently
        if (resistors.length < 2) return Infinity; 
        
        const r1 = resistors[0];
        const r2 = resistors[1];

        // Check for Parallel: Both share both nodes
        const isParallel = (r1.nodes.includes(node1) && r1.nodes.includes(node2)) &&
                           (r2.nodes.includes(node1) && r2.nodes.includes(node2));
        
        if (isParallel) {
            return 1 / (1 / r1.value + 1 / r2.value);
        }

        // Assume Series otherwise (one node shared)
        return r1.value + r2.value;
    }
}
