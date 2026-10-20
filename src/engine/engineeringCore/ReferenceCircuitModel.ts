/**
 * SECP Electrical Engineering Canonical Foundation - Phase 1
 * Reference Circuit Model (EEC-001, EEC-002, EEC-003)
 */

export interface CircuitComponent {
    id: string;
    type: 'RESISTOR' | 'VOLTAGE_SOURCE';
    value: number; // Ohms or Volts
    nodes: [string, string]; // Connection nodes
}

export interface CircuitModel {
    id: string;
    components: CircuitComponent[];
}
