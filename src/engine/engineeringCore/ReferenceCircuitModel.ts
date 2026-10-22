/**
 * SECP Electrical Engineering Canonical Foundation - Phase 1
 * Reference Circuit Model (EEC-001 through EEC-026)
 * Supports canonical hashing, component attribution, and explicit node connectivity.
 */

import { createHash } from 'crypto';

export type ComponentType = 'RESISTOR' | 'VOLTAGE_SOURCE' | 'DIODE';

export interface CircuitComponent {
  id: string;
  type: ComponentType;
  value: number; // Ohms for RESISTOR, Volts for VOLTAGE_SOURCE, forward threshold/bias for DIODE
  nodes: [string, string]; // [Positive/Anode Node, Negative/Cathode Node]
  saturationCurrent?: number; // Saturation current Is (Amps, default: 1e-14 A)
  idealityFactor?: number; // Emission coefficient n (default: 1.0)
  temperatureKelvin?: number; // Junction temperature in Kelvin (default: 300.0 K)
}

export interface CircuitModel {
  id: string;
  version?: string;
  referenceNode?: string; // Defaults to 'GND'
  components: CircuitComponent[];
}

/**
 * Computes deterministic canonical cryptographic digest of a CircuitModel
 */
export function computeCircuitCanonicalHash(model: CircuitModel): string {
  const normalized = {
    id: model.id,
    version: model.version || '1.0.0',
    referenceNode: model.referenceNode || 'GND',
    components: [...model.components].map(c => ({
      id: c.id,
      type: c.type,
      value: Number.isFinite(c.value) ? Number(c.value.toFixed(8)) : null,
      nodes: [c.nodes[0], c.nodes[1]],
      ...(c.saturationCurrent !== undefined ? { saturationCurrent: Number(c.saturationCurrent.toExponential(6)) } : {}),
      ...(c.idealityFactor !== undefined ? { idealityFactor: Number(c.idealityFactor.toFixed(4)) } : {}),
      ...(c.temperatureKelvin !== undefined ? { temperatureKelvin: Number(c.temperatureKelvin.toFixed(2)) } : {})
    })).sort((a, b) => a.id.localeCompare(b.id))
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 16);
}

// Canonical Reference Case EEC-001
export const referenceCircuit: CircuitModel = {
  id: 'EEC-001-Ref',
  referenceNode: 'GND',
  components: [
    { id: 'V1', type: 'VOLTAGE_SOURCE', value: 10.0, nodes: ['N1', 'GND'] },
    { id: 'R1', type: 'RESISTOR', value: 1000.0, nodes: ['N1', 'GND'] }
  ]
};
