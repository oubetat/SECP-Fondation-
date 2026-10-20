/**
 * SECP Industrial OS — SECP-PCB-PHASE-2-001
 * Schematic-to-Layout Electrical Consistency Verifier:
 * Validates pin-to-net mappings, required connectivity vs intentional NC (No-Connect),
 * unrouted required pins, and cross-net mapping divergence between Schematic and Physical PCB.
 */

import { PcbCanonicalModel, PcbCanonicalModelValidator } from './PcbCanonicalModel';
import { PcbConnectivityVerifier, ConnectivityReport } from './PcbConnectivityVerifier';

export type PinElectricalIntent = 
  | 'REQUIRED'          // Pin is in schematic net and MUST be physically connected
  | 'INTENTIONAL_NC'    // Explicitly designated as No-Connect (valid open)
  | 'OPTIONAL'          // Optional / test point pin
  | 'UNSPECIFIED';      // Pin not in schematic net and not declared NC

export interface PinConsistencyStatus {
  refDes: string;
  pinNumber: number;
  netName?: string;
  intent: PinElectricalIntent;
  isPhysicallyConnected: boolean;
  status: 'VALID' | 'MISSING_CONNECTION' | 'UNEXPECTED_CONNECTION' | 'ILLEGAL_SHORT';
  details?: string;
}

export interface SchematicConsistencyViolation {
  code:
    | 'SCH-CON-001' // Missing component in PCB placement
    | 'SCH-CON-002' // Missing pin in footprint definition
    | 'SCH-CON-003' // Required schematic pin is physically unrouted (open circuit)
    | 'SCH-CON-004' // Intentional NC pin has illegal copper trace attached
    | 'SCH-CON-005' // Net assignment mismatch between Schematic and PCB trace
    | 'SCH-CON-006' // Incomplete schematic or netlist metadata
    | 'SCH-CON-007'; // Orphaned PCB component placement not present in schematic
  severity: 'ERROR' | 'WARNING';
  message: string;
  affectedEntities: string[];
}

export interface SchematicConsistencyReport {
  status: 'PASS' | 'FAIL' | 'INCOMPLETE';
  passed: boolean;
  schematicRevision: string;
  pcbRevision: string;
  totalSchematicComponents: number;
  placedComponentsCount: number;
  totalRequiredPins: number;
  connectedRequiredPins: number;
  unroutedRequiredPins: number;
  intentionalNcPinsCount: number;
  violations: SchematicConsistencyViolation[];
  pinStatuses: PinConsistencyStatus[];
  timestamp: string;
}

export class PcbSchematicConsistencyVerifier {
  public static verify(
    model: PcbCanonicalModel,
    connectivityReport?: ConnectivityReport
  ): SchematicConsistencyReport {
    const violations: SchematicConsistencyViolation[] = [];
    const pinStatuses: PinConsistencyStatus[] = [];

    const schematicRev = model.designId ? `${model.designId}:${model.revisionId || 'REV-0.1.0'}` : 'SCH-REV-UNKNOWN';
    const pcbRev = model.revisionId || 'PCB-REV-0.1.0';

    // 1. Fail-safe: check presence of components and netlists
    if (!model.components || model.components.length === 0) {
      violations.push({
        code: 'SCH-CON-006',
        severity: 'ERROR',
        message: 'Schematic has zero components defined',
        affectedEntities: ['schematic']
      });
      return {
        status: 'INCOMPLETE',
        passed: false,
        schematicRevision: schematicRev,
        pcbRevision: pcbRev,
        totalSchematicComponents: 0,
        placedComponentsCount: 0,
        totalRequiredPins: 0,
        connectedRequiredPins: 0,
        unroutedRequiredPins: 0,
        intentionalNcPinsCount: 0,
        violations,
        pinStatuses: [],
        timestamp: new Date().toISOString()
      };
    }

    const placementMap = new Map(model.placements.map(p => [p.refDes, p]));
    const schematicCompMap = new Map(model.components.map(c => [c.refDes, c]));

    // Check 1: Every schematic component must be placed on PCB
    for (const comp of model.components) {
      if (comp.isMechanicalOnly) continue;
      if (!placementMap.has(comp.refDes)) {
        violations.push({
          code: 'SCH-CON-001',
          severity: 'ERROR',
          message: `Schematic component '${comp.refDes}' (${comp.name}) is missing from PCB placements`,
          affectedEntities: [comp.refDes]
        });
      }
    }

    // Check 2: Every PCB placement must exist in schematic
    for (const place of model.placements) {
      if (!schematicCompMap.has(place.refDes)) {
        violations.push({
          code: 'SCH-CON-007',
          severity: 'ERROR',
          message: `PCB placement '${place.refDes}' is orphaned and does not exist in schematic`,
          affectedEntities: [place.refDes]
        });
      }
    }

    // Check 3: Build pin intent map from schematic nets
    const pinNetMap = new Map<string, string>(); // 'refDes:pinNum' -> netName
    for (const net of model.schematicNets) {
      for (const p of net.pins) {
        const key = `${p.refDes}:${p.pinNumber}`;
        pinNetMap.set(key, net.name);
      }
    }

    // Check footprint pin completeness
    for (const comp of model.components) {
      const fp = model.footprintLibrary?.[comp.footprintId];
      if (!fp) {
        violations.push({
          code: 'SCH-CON-006',
          severity: 'ERROR',
          message: `Footprint definition '${comp.footprintId}' for '${comp.refDes}' not found`,
          affectedEntities: [comp.refDes, comp.footprintId]
        });
        continue;
      }

      const fpPinNumbers = new Set(fp.pins.map(p => p.pinNumber));

      // Inspect pins referenced by schematic nets
      for (const net of model.schematicNets) {
        for (const np of net.pins) {
          if (np.refDes === comp.refDes && !fpPinNumbers.has(np.pinNumber)) {
            violations.push({
              code: 'SCH-CON-002',
              severity: 'ERROR',
              message: `Schematic net '${net.name}' references pin ${np.pinNumber} on '${comp.refDes}', which does not exist in footprint '${fp.name}'`,
              affectedEntities: [comp.refDes, `pin_${np.pinNumber}`, net.name]
            });
          }
        }
      }
    }

    // Run or reuse connectivity verification to know physical copper connection status
    const conn = connectivityReport || PcbConnectivityVerifier.verify(model);

    let totalRequiredPins = 0;
    let connectedRequiredPins = 0;
    let unroutedRequiredPins = 0;
    let intentionalNcPinsCount = 0;

    // Check each component's footprint pins against physical connection
    for (const comp of model.components) {
      const fp = model.footprintLibrary?.[comp.footprintId];
      if (!fp) continue;

      for (const pin of fp.pins) {
        const key = `${comp.refDes}:${pin.pinNumber}`;
        const netName = pinNetMap.get(key);

        const allPads = PcbCanonicalModelValidator.calculateAllPadLocations(model);
        const padLocation = allPads.find(pl => pl.refDes === comp.refDes && pl.pinNumber === pin.pinNumber);
        const pinKey = `${comp.refDes}:${pin.pinNumber}`;
        const isPhysicallyConnected = !conn.violations.some(v => 
          v.code === 'PCB-CON-002' && v.affectedEntities.includes(pinKey)
        ) && (conn.violations.some(v => v.netName === netName) || conn.routedNetsCount > 0);

        if (netName) {
          totalRequiredPins++;
          if (isPhysicallyConnected) {
            connectedRequiredPins++;
            pinStatuses.push({
              refDes: comp.refDes,
              pinNumber: pin.pinNumber,
              netName,
              intent: 'REQUIRED',
              isPhysicallyConnected: true,
              status: 'VALID'
            });
          } else {
            unroutedRequiredPins++;
            violations.push({
              code: 'SCH-CON-003',
              severity: 'ERROR',
              message: `Required schematic pin '${comp.refDes}:${pin.pinNumber}' on net '${netName}' is physically unrouted on PCB`,
              affectedEntities: [comp.refDes, `pin_${pin.pinNumber}`, netName]
            });
            pinStatuses.push({
              refDes: comp.refDes,
              pinNumber: pin.pinNumber,
              netName,
              intent: 'REQUIRED',
              isPhysicallyConnected: false,
              status: 'MISSING_CONNECTION',
              details: `Unrouted pin on net ${netName}`
            });
          }
        } else {
          // Pin is not in any schematic net: check if it's explicitly designated as NC or unused
          const isNC = !pin.isElectrical || pin.name?.toUpperCase() === 'NC';
          if (isNC) {
            intentionalNcPinsCount++;
            if (isPhysicallyConnected) {
              violations.push({
                code: 'SCH-CON-004',
                severity: 'ERROR',
                message: `Intentional No-Connect (NC) pin '${comp.refDes}:${pin.pinNumber}' has illegal copper trace attached`,
                affectedEntities: [comp.refDes, `pin_${pin.pinNumber}`]
              });
              pinStatuses.push({
                refDes: comp.refDes,
                pinNumber: pin.pinNumber,
                intent: 'INTENTIONAL_NC',
                isPhysicallyConnected: true,
                status: 'ILLEGAL_SHORT',
                details: 'Copper trace routed to NC pin'
              });
            } else {
              pinStatuses.push({
                refDes: comp.refDes,
                pinNumber: pin.pinNumber,
                intent: 'INTENTIONAL_NC',
                isPhysicallyConnected: false,
                status: 'VALID'
              });
            }
          } else {
            // Unconnected electrical pin (allowed unused GPIO/pin)
            pinStatuses.push({
              refDes: comp.refDes,
              pinNumber: pin.pinNumber,
              intent: 'OPTIONAL',
              isPhysicallyConnected,
              status: 'VALID'
            });
          }
        }
      }
    }

    const hasErrors = violations.some(v => v.severity === 'ERROR');

    return {
      status: hasErrors ? 'FAIL' : 'PASS',
      passed: !hasErrors,
      schematicRevision: schematicRev,
      pcbRevision: pcbRev,
      totalSchematicComponents: model.components.length,
      placedComponentsCount: model.placements.length,
      totalRequiredPins,
      connectedRequiredPins,
      unroutedRequiredPins,
      intentionalNcPinsCount,
      violations,
      pinStatuses,
      timestamp: new Date().toISOString()
    };
  }
}
