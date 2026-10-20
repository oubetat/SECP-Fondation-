/**
 * SECP Industrial OS - PHASE 1 Production-Grade PCB Engineering Foundation
 * Canonical Source of Truth for ECAD / MCAD Co-Design:
 * Schematics → Pin Maps → Footprints & Pads → Placements → Multi-Layer Traces & Vias → Enclosures.
 * Enforces runtime deterministic hashing, entity attribution, and strict structural invariants.
 */

import { createHash } from 'crypto';
import { PcbDesignRuleset } from './PcbDesignRules';

function deterministicStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(deterministicStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${deterministicStringify(obj[k])}`).join(',') + '}';
}

export type PcbLayer = 'TOP_COPPER' | 'BOTTOM_COPPER' | 'INNER_1' | 'INNER_2';
export type ComponentLayer = 'TOP' | 'BOTTOM';

export interface PinDefinition {
  pinNumber: number;
  name?: string;
  xMm: number; // Offset relative to component centroid
  yMm: number; // Offset relative to component centroid
  padWidthMm: number;
  padHeightMm: number;
  shape?: 'RECT' | 'ROUND' | 'OVAL' | 'POLYGON';
  isElectrical: boolean;
  isNoConnect?: boolean;
  polygonVertices?: { x: number; y: number }[];
}

export interface FootprintDefinition {
  id: string;
  name: string;
  pins: PinDefinition[];
  bodyWidthMm: number;
  bodyHeightMm: number;
  defaultHeight3dMm: number;
}

export interface SchematicComponentDefinition {
  id: string;
  refDes: string;
  name: string;
  value: string;
  footprintId: string;
  isMechanicalOnly?: boolean;
}

export interface SchematicNetConnection {
  refDes: string;
  pinNumber: number;
}

export interface SchematicNetDefinition {
  id: string;
  name: string;
  pins: SchematicNetConnection[];
  requiredWidthMm?: number;
  requiredClearanceMm?: number;
}

export interface PhysicalPadLocation {
  refDes: string;
  pinNumber: number;
  netName?: string;
  xAbsoluteMm: number;
  yAbsoluteMm: number;
  padWidthMm: number;
  padHeightMm: number;
  layer: ComponentLayer;
}

export interface PcbComponentPlacementRecord {
  refDes: string;
  xMm: number; // Component centroid
  yMm: number; // Component centroid
  rotationDeg: number;
  layer: ComponentLayer;
  widthMm: number;
  heightMm: number;
  height3dMm: number;
  colorHex?: string;
}

export interface PcbTraceRecord {
  id: string;
  netName: string;
  layer: PcbLayer;
  widthMm: number;
  path: { x: number; y: number }[];
}

export interface PcbViaRecord {
  id: string;
  netName: string;
  xMm: number;
  yMm: number;
  drillDiameterMm: number;
  padDiameterMm: number;
  startLayer: PcbLayer;
  endLayer: PcbLayer;
}

export interface PcbMountingHoleRecord {
  id: string;
  x: number;
  y: number;
  diameterMm: number;
  isPlated?: boolean;
}

export interface PcbDesignRules {
  minClearanceMm: number;
  minTraceWidthMm: number;
  boardMarginMm: number;
}

export interface MechanicalStandoffPost {
  id: string;
  x: number;
  y: number;
  diameterMm: number;
}

export interface MechanicalTargetEnclosure {
  id: string;
  name: string;
  internalWidthMm: number;
  internalLengthMm: number;
  internalHeightMm: number;
  wallThicknessMm: number;
  standoffHeightMm: number;
  screwDiameterMm: number;
  standoffPosts: MechanicalStandoffPost[];
  maxComponentHeightMm?: number;
}

export interface PcbCanonicalModel {
  designId?: string;
  revisionId?: string;
  version: string;
  boardWidthMm: number;
  boardHeightMm: number;
  thicknessMm: number;
  layerCount: number;
  components: SchematicComponentDefinition[];
  schematicNets: SchematicNetDefinition[];
  placements: PcbComponentPlacementRecord[];
  traces: PcbTraceRecord[];
  vias: PcbViaRecord[];
  mountingHoles: PcbMountingHoleRecord[];
  footprintLibrary: Record<string, FootprintDefinition>;
  rules: PcbDesignRules;
  ruleset?: PcbDesignRuleset;
  targetEnclosure?: MechanicalTargetEnclosure;
}

export interface ModelValidationViolation {
  code: 'PCB-CAN-001' | 'PCB-CAN-002' | 'PCB-CAN-003' | 'PCB-CAN-004';
  severity: 'ERROR' | 'WARNING';
  message: string;
  affectedEntities: string[];
}

export interface ModelValidationResult {
  valid: boolean;
  violations: ModelValidationViolation[];
  canonicalHash: string;
}

export class PcbCanonicalModelValidator {
  /**
   * Computes deterministic canonical cryptographic digest of the PCB model.
   */
  public static computeCanonicalHash(model: PcbCanonicalModel): string {
    const canonicalPayload = {
      designId: model.designId || 'SECP-PCB-CANONICAL-UNASSIGNED',
      revisionId: model.revisionId || 'REV-0.1.0',
      boardWidthMm: Number(model.boardWidthMm.toFixed(4)),
      boardHeightMm: Number(model.boardHeightMm.toFixed(4)),
      thicknessMm: Number(model.thicknessMm.toFixed(4)),
      layerCount: model.layerCount,
      rules: {
        minClearanceMm: Number(model.rules.minClearanceMm.toFixed(4)),
        minTraceWidthMm: Number(model.rules.minTraceWidthMm.toFixed(4)),
        boardMarginMm: Number(model.rules.boardMarginMm.toFixed(4))
      },
      components: model.components.map(c => ({
        refDes: c.refDes,
        footprintId: c.footprintId,
        value: c.value
      })).sort((a, b) => a.refDes.localeCompare(b.refDes)),
      schematicNets: model.schematicNets.map(n => ({
        name: n.name,
        pins: n.pins.map(p => `${p.refDes}:${p.pinNumber}`).sort()
      })).sort((a, b) => a.name.localeCompare(b.name)),
      placements: model.placements.map(p => ({
        refDes: p.refDes,
        xMm: Number(p.xMm.toFixed(4)),
        yMm: Number(p.yMm.toFixed(4)),
        layer: p.layer,
        rotationDeg: Number(p.rotationDeg.toFixed(4)),
        widthMm: Number(p.widthMm.toFixed(4)),
        heightMm: Number(p.heightMm.toFixed(4)),
        height3dMm: Number(p.height3dMm.toFixed(4))
      })).sort((a, b) => a.refDes.localeCompare(b.refDes)),
      traces: model.traces.map(t => ({
        id: t.id,
        netName: t.netName,
        layer: t.layer,
        widthMm: Number(t.widthMm.toFixed(4)),
        path: t.path.map(pt => ({ x: Number(pt.x.toFixed(4)), y: Number(pt.y.toFixed(4)) }))
      })).sort((a, b) => a.id.localeCompare(b.id)),
      vias: model.vias.map(v => ({
        id: v.id,
        netName: v.netName,
        xMm: Number(v.xMm.toFixed(4)),
        yMm: Number(v.yMm.toFixed(4)),
        drillDiameterMm: Number(v.drillDiameterMm.toFixed(4)),
        padDiameterMm: Number(v.padDiameterMm.toFixed(4)),
        startLayer: v.startLayer,
        endLayer: v.endLayer
      })).sort((a, b) => a.id.localeCompare(b.id)),
      mountingHoles: model.mountingHoles.map(m => ({
        id: m.id,
        x: Number(m.x.toFixed(4)),
        y: Number(m.y.toFixed(4)),
        diameterMm: Number(m.diameterMm.toFixed(4))
      })).sort((a, b) => a.id.localeCompare(b.id)),
      footprints: Object.keys(model.footprintLibrary || {}).sort().map(fpKey => {
        const fp = model.footprintLibrary[fpKey];
        return {
          id: fp.id,
          bodyWidthMm: Number(fp.bodyWidthMm.toFixed(4)),
          bodyHeightMm: Number(fp.bodyHeightMm.toFixed(4)),
          pins: fp.pins.map(pin => ({
            pinNumber: pin.pinNumber,
            xMm: Number(pin.xMm.toFixed(4)),
            yMm: Number(pin.yMm.toFixed(4)),
            padWidthMm: Number(pin.padWidthMm.toFixed(4)),
            padHeightMm: Number(pin.padHeightMm.toFixed(4))
          })).sort((p1, p2) => p1.pinNumber - p2.pinNumber)
        };
      }),
      targetEnclosure: model.targetEnclosure ? {
        id: model.targetEnclosure.id,
        internalWidthMm: Number(model.targetEnclosure.internalWidthMm.toFixed(4)),
        internalLengthMm: Number(model.targetEnclosure.internalLengthMm.toFixed(4)),
        internalHeightMm: Number(model.targetEnclosure.internalHeightMm.toFixed(4)),
        wallThicknessMm: Number(model.targetEnclosure.wallThicknessMm.toFixed(4)),
        standoffHeightMm: Number(model.targetEnclosure.standoffHeightMm.toFixed(4)),
        screwDiameterMm: Number(model.targetEnclosure.screwDiameterMm.toFixed(4)),
        standoffPosts: model.targetEnclosure.standoffPosts.map(sp => ({
          id: sp.id,
          x: Number(sp.x.toFixed(4)),
          y: Number(sp.y.toFixed(4)),
          diameterMm: Number(sp.diameterMm.toFixed(4))
        })).sort((a, b) => a.id.localeCompare(b.id))
      } : null
    };

    const canonicalJson = deterministicStringify(canonicalPayload);
    return createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
  }

  /**
   * Validates canonical model consistency, rejecting duplicate refDes,
   * unmapped pins, and unphysical dimensions.
   */
  public static validate(model: PcbCanonicalModel): ModelValidationResult {
    const violations: ModelValidationViolation[] = [];

    // PCB-CAN-003: Invalid coordinates and dimension sanity (NaN, Infinity, negative values)
    if (
      !Number.isFinite(model.boardWidthMm) || model.boardWidthMm <= 0 ||
      !Number.isFinite(model.boardHeightMm) || model.boardHeightMm <= 0 ||
      !Number.isFinite(model.thicknessMm) || model.thicknessMm <= 0
    ) {
      violations.push({
        code: 'PCB-CAN-003',
        severity: 'ERROR',
        message: `Board dimensions must be positive finite numbers. Found width=${model.boardWidthMm}, height=${model.boardHeightMm}, thickness=${model.thicknessMm}`,
        affectedEntities: ['board_outline']
      });
    }

    // Check placements coordinates
    for (const p of model.placements) {
      if (
        !Number.isFinite(p.xMm) || !Number.isFinite(p.yMm) ||
        !Number.isFinite(p.widthMm) || p.widthMm <= 0 ||
        !Number.isFinite(p.heightMm) || p.heightMm <= 0 ||
        !Number.isFinite(p.height3dMm) || p.height3dMm < 0 ||
        !Number.isFinite(p.rotationDeg)
      ) {
        violations.push({
          code: 'PCB-CAN-003',
          severity: 'ERROR',
          message: `Placement '${p.refDes}' has non-finite or negative coordinates/dimensions: x=${p.xMm}, y=${p.yMm}, w=${p.widthMm}, h=${p.heightMm}, h3d=${p.height3dMm}`,
          affectedEntities: [p.refDes]
        });
      }
    }

    // Check traces coordinates and widths
    for (const tr of model.traces) {
      if (!Number.isFinite(tr.widthMm) || tr.widthMm <= 0) {
        violations.push({
          code: 'PCB-CAN-003',
          severity: 'ERROR',
          message: `Trace '${tr.id}' has non-positive or non-finite width: ${tr.widthMm}`,
          affectedEntities: [tr.id]
        });
      }
      for (const pt of tr.path) {
        if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
          violations.push({
            code: 'PCB-CAN-003',
            severity: 'ERROR',
            message: `Trace '${tr.id}' has invalid non-finite coordinates: (${pt.x}, ${pt.y})`,
            affectedEntities: [tr.id]
          });
          break;
        }
      }
    }

    // Check mounting holes
    for (const mh of model.mountingHoles) {
      if (!Number.isFinite(mh.x) || !Number.isFinite(mh.y) || !Number.isFinite(mh.diameterMm) || mh.diameterMm <= 0) {
        violations.push({
          code: 'PCB-CAN-003',
          severity: 'ERROR',
          message: `Mounting hole '${mh.id}' has non-finite coordinates or invalid diameter: (${mh.x}, ${mh.y}), dia=${mh.diameterMm}`,
          affectedEntities: [mh.id]
        });
      }
    }

    // Check vias
    for (const via of model.vias) {
      if (
        !Number.isFinite(via.xMm) || !Number.isFinite(via.yMm) ||
        !Number.isFinite(via.drillDiameterMm) || via.drillDiameterMm <= 0 ||
        !Number.isFinite(via.padDiameterMm) || via.padDiameterMm <= via.drillDiameterMm
      ) {
        violations.push({
          code: 'PCB-CAN-003',
          severity: 'ERROR',
          message: `Via '${via.id}' has invalid geometry: drill=${via.drillDiameterMm}, pad=${via.padDiameterMm}`,
          affectedEntities: [via.id]
        });
      }
    }

    // Check footprint pin coordinates
    for (const [fpId, fp] of Object.entries(model.footprintLibrary || {})) {
      if (!Number.isFinite(fp.bodyWidthMm) || fp.bodyWidthMm <= 0 || !Number.isFinite(fp.bodyHeightMm) || fp.bodyHeightMm <= 0) {
        violations.push({
          code: 'PCB-CAN-003',
          severity: 'ERROR',
          message: `Footprint '${fpId}' has invalid body dimensions: ${fp.bodyWidthMm}x${fp.bodyHeightMm}`,
          affectedEntities: [fpId]
        });
      }
      for (const pin of fp.pins) {
        if (!Number.isFinite(pin.xMm) || !Number.isFinite(pin.yMm) || !Number.isFinite(pin.padWidthMm) || pin.padWidthMm <= 0 || !Number.isFinite(pin.padHeightMm) || pin.padHeightMm <= 0) {
          violations.push({
            code: 'PCB-CAN-003',
            severity: 'ERROR',
            message: `Pin ${pin.pinNumber} in footprint '${fpId}' has invalid geometry: offset=(${pin.xMm}, ${pin.yMm}), pad=${pin.padWidthMm}x${pin.padHeightMm}`,
            affectedEntities: [fpId, `Pin_${pin.pinNumber}`]
          });
        }
      }
    }

    // PCB-CAN-001: Reject duplicate refDes in components and placements
    const compRefCounts = new Map<string, number>();
    for (const c of model.components) {
      compRefCounts.set(c.refDes, (compRefCounts.get(c.refDes) || 0) + 1);
    }
    for (const [refDes, count] of compRefCounts.entries()) {
      if (count > 1) {
        violations.push({
          code: 'PCB-CAN-001',
          severity: 'ERROR',
          message: `Duplicate schematic component reference designator detected: '${refDes}' appears ${count} times.`,
          affectedEntities: [refDes]
        });
      }
    }

    const placeRefCounts = new Map<string, number>();
    for (const p of model.placements) {
      placeRefCounts.set(p.refDes, (placeRefCounts.get(p.refDes) || 0) + 1);
    }
    for (const [refDes, count] of placeRefCounts.entries()) {
      if (count > 1) {
        violations.push({
          code: 'PCB-CAN-001',
          severity: 'ERROR',
          message: `Duplicate physical placement reference designator detected: '${refDes}' appears ${count} times in layout.`,
          affectedEntities: [refDes]
        });
      }
    }

    // PCB-CAN-004: Verify all placements correspond to known schematic components
    for (const p of model.placements) {
      const match = model.components.find(c => c.refDes === p.refDes);
      if (!match) {
        violations.push({
          code: 'PCB-CAN-004',
          severity: 'WARNING',
          message: `Placement '${p.refDes}' has no corresponding schematic component.`,
          affectedEntities: [p.refDes]
        });
      }
    }

    // PCB-CAN-002: Detect pins in schematic nets that are not defined in the component's footprint
    for (const net of model.schematicNets) {
      for (const pinRef of net.pins) {
        const comp = model.components.find(c => c.refDes === pinRef.refDes);
        if (!comp) {
          violations.push({
            code: 'PCB-CAN-002',
            severity: 'ERROR',
            message: `Net '${net.name}' connects to component '${pinRef.refDes}' which does not exist in schematic.`,
            affectedEntities: [net.name, pinRef.refDes]
          });
          continue;
        }

        const footprint = model.footprintLibrary ? model.footprintLibrary[comp.footprintId] : undefined;
        if (!footprint) {
          violations.push({
            code: 'PCB-CAN-002',
            severity: 'ERROR',
            message: `Component '${comp.refDes}' references missing footprint '${comp.footprintId}'.`,
            affectedEntities: [comp.refDes, comp.footprintId]
          });
          continue;
        }

        const pinExists = footprint.pins.some(p => p.pinNumber === pinRef.pinNumber);
        if (!pinExists) {
          violations.push({
            code: 'PCB-CAN-002',
            severity: 'ERROR',
            message: `Net '${net.name}' references Pin ${pinRef.pinNumber} on '${pinRef.refDes}', but footprint '${footprint.id}' has no Pin ${pinRef.pinNumber}.`,
            affectedEntities: [net.name, pinRef.refDes, `Pin_${pinRef.pinNumber}`]
          });
        }
      }
    }

    const canonicalHash = this.computeCanonicalHash(model);

    return {
      valid: violations.filter(v => v.severity === 'ERROR').length === 0,
      violations,
      canonicalHash
    };
  }

  /**
   * Computes the exact absolute coordinate of all component pads on the PCB
   * incorporating rotation and center coordinates.
   */
  public static calculateAllPadLocations(model: PcbCanonicalModel): PhysicalPadLocation[] {
    const locations: PhysicalPadLocation[] = [];

    // Map each pin to its assigned net name for fast query
    const pinToNetMap = new Map<string, string>();
    for (const net of model.schematicNets) {
      for (const p of net.pins) {
        pinToNetMap.set(`${p.refDes}:${p.pinNumber}`, net.name);
      }
    }

    for (const placement of model.placements) {
      const comp = model.components.find(c => c.refDes === placement.refDes);
      if (!comp) continue;

      if (!model.footprintLibrary) continue;
      const footprint = model.footprintLibrary[comp.footprintId];
      if (!footprint) continue;

      const rad = (placement.rotationDeg * Math.PI) / 180;
      const cosR = Math.cos(rad);
      const sinR = Math.sin(rad);

      for (const pin of footprint.pins) {
        // Rotate local offset around component centroid
        const rotatedX = pin.xMm * cosR - pin.yMm * sinR;
        const rotatedY = pin.xMm * sinR + pin.yMm * cosR;

        // Invert Y coordinate offset for BOTTOM layer placements if standard SMD
        const absX = placement.xMm + rotatedX;
        const absY = placement.yMm + (placement.layer === 'BOTTOM' ? -rotatedY : rotatedY);

        locations.push({
          refDes: placement.refDes,
          pinNumber: pin.pinNumber,
          netName: pinToNetMap.get(`${placement.refDes}:${pin.pinNumber}`),
          xAbsoluteMm: absX,
          yAbsoluteMm: absY,
          padWidthMm: pin.padWidthMm,
          padHeightMm: pin.padHeightMm,
          layer: placement.layer
        });
      }
    }

    return locations;
  }
}
